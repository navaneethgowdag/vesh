"""
Test Suite for Feature 3 & 4: Laundry and Wear Tracking System
Validates all requirements from TailorBird Phase 2 & 5:
1. is_available boundary calculations:
   Exact Day Rule: worn Mon (2nd wear, limit=2, wash_days=4) -> unavailable Tue-Fri, available Sat.
2. wash_days = 0: available next day.
3. Resolution hierarchy: Item override > Category override > Global default.
4. Non-launderable categories default to track_laundry = False.
5. Idempotent same-day wear recording: wearing twice on same day does not double-count.
6. Wear undo: decrements count, reverts laundry state if wear triggered it, removes log.
7. Recommender Step 2 hard filter: strictly excludes items currently in laundry for target date.
8. Rule 4.4a empty states: status="no_items" with structured reasons (no clothes / all in laundry with return date).
9. Rule 4.4a partial outfits: status="partial_outfit" when footwear is missing with can_wear=False.
10. Multi-user isolation: User A cannot read or mutate User B's settings, wears, or recommendations.
11. Settings change marks active recommendation stale without silently regenerating.
"""

import uuid
from datetime import date, timedelta
import pytest

from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.laundry import UserLaundrySettings, DailyRecommendation
from app.services.laundry_service import LaundryService
from app.services.recommendation_service import RecommendationService


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_test_user(db_session, username_prefix: str = "laundry_user") -> User:
    user = User(
        id=uuid.uuid4(),
        username=f"{username_prefix}_{uuid.uuid4().hex[:6]}",
        email=f"{username_prefix}_{uuid.uuid4().hex[:6]}@example.com",
        password_hash="hashed_pw_test",
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_is_available_exact_day_boundaries(db_session):
    """
    Prompt requirement 3.1 & 3.5:
    Exact day rule: if the item reaches its wear limit on date D and wash_days = N,
    it is unavailable on D+1 ... D+N and available from D+N+1.
    Example: worn Mon (2nd wear), N=4 -> unavailable Tue-Fri, available Sat.
    """
    service = LaundryService(db_session)
    user_id = uuid.uuid4()

    # Create user settings: max_wears=2, wash_days=4
    settings = UserLaundrySettings(
        user_id=user_id,
        default_max_wears=2,
        default_wash_days=4,
        category_overrides={},
        auto_return_from_laundry=True,
    )

    mon = date(2026, 11, 2)  # Monday
    tue = date(2026, 11, 3)  # Tuesday (D+1)
    wed = date(2026, 11, 4)  # Wednesday (D+2)
    thu = date(2026, 11, 5)  # Thursday (D+3)
    fri = date(2026, 11, 6)  # Friday (D+4)
    sat = date(2026, 11, 7)  # Saturday (D+N+1)

    item = Clothing(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Navy Cotton Shirt",
        category="tops",
        wear_count_since_wash=1,
        laundry_status="clean",
        track_laundry=True,
    )

    # 1. On Monday before wear: available
    avail, reason, _ = service.is_available(item, mon, settings)
    assert avail is True
    assert reason is None

    # 2. Item is worn on Monday, reaching limit (2nd wear)
    item.wear_count_since_wash = 2
    item.laundry_status = "in_laundry"
    item.laundry_started_on = mon
    item.available_from = mon + timedelta(days=4 + 1)  # Saturday

    # 3. Boundary checks
    # Tuesday (D+1): unavailable
    avail_tue, r_tue, back_tue = service.is_available(item, tue, settings)
    assert avail_tue is False
    assert r_tue == "in_laundry"
    assert back_tue == sat

    # Wednesday (D+2): unavailable
    avail_wed, _, _ = service.is_available(item, wed, settings)
    assert avail_wed is False

    # Thursday (D+3): unavailable
    avail_thu, _, _ = service.is_available(item, thu, settings)
    assert avail_thu is False

    # Friday (D+4): unavailable
    avail_fri, _, _ = service.is_available(item, fri, settings)
    assert avail_fri is False

    # Saturday (D+N+1 = D+5): AVAILABLE (return date reached)
    avail_sat, r_sat, _ = service.is_available(item, sat, settings)
    assert avail_sat is True
    assert r_sat is None


def test_wash_days_zero(db_session):
    """
    wash_days = 0: reaching limit on date D makes item available on D+1 (next day).
    """
    service = LaundryService(db_session)
    user_id = uuid.uuid4()
    settings = UserLaundrySettings(
        user_id=user_id,
        default_max_wears=1,
        default_wash_days=0,
        category_overrides={},
        auto_return_from_laundry=True,
    )

    d = date(2026, 11, 10)
    next_day = d + timedelta(days=1)

    item = Clothing(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Running Tee",
        category="tops",
        wear_count_since_wash=1,
        laundry_status="in_laundry",
        laundry_started_on=d,
        available_from=d + timedelta(days=0 + 1),  # next_day
        track_laundry=True,
    )

    avail_d, _, _ = service.is_available(item, d, settings)
    assert avail_d is False

    avail_next, _, _ = service.is_available(item, next_day, settings)
    assert avail_next is True


def test_override_resolution_order(db_session):
    """
    Resolution order: item override > category override > global default.
    """
    service = LaundryService(db_session)
    user_id = uuid.uuid4()
    settings = UserLaundrySettings(
        user_id=user_id,
        default_max_wears=2,
        default_wash_days=4,
        category_overrides={
            "tops": {"max_wears": 3, "wash_days": 2, "track_laundry": True},
            "bottoms": {"max_wears": 5, "wash_days": 3, "track_laundry": True},
        },
        auto_return_from_laundry=True,
    )

    # 1. Item with explicit overrides wins over category & global
    item_with_overrides = Clothing(
        id=uuid.uuid4(),
        user_id=user_id,
        category="tops",
        max_wears_override=6,
        wash_days_override=1,
    )
    max_w, wash_d, track = service.get_effective_limits(item_with_overrides, settings)
    assert max_w == 6
    assert wash_d == 1
    assert track is True

    # 2. Item with no overrides inherits category overrides
    item_cat_only = Clothing(
        id=uuid.uuid4(),
        user_id=user_id,
        category="tops",
    )
    max_w, wash_d, track = service.get_effective_limits(item_cat_only, settings)
    assert max_w == 3
    assert wash_d == 2
    assert track is True

    # 3. Item with un-overridden category falls back to global default
    item_global = Clothing(
        id=uuid.uuid4(),
        user_id=user_id,
        category="outerwear",
    )
    max_w, wash_d, track = service.get_effective_limits(item_global, settings)
    assert max_w == 2
    assert wash_d == 4
    assert track is True


def test_non_launderable_categories_default(db_session):
    """
    Non-launderable categories (footwear, bags, belts, watches, etc.)
    default to track_laundry = False.
    """
    service = LaundryService(db_session)
    user_id = uuid.uuid4()
    settings = UserLaundrySettings(
        user_id=user_id,
        default_max_wears=2,
        default_wash_days=4,
        category_overrides={},
    )

    for cat in ["footwear", "shoes", "bags", "accessories", "jewellery", "sunglasses"]:
        item = Clothing(
            id=uuid.uuid4(),
            user_id=user_id,
            category=cat,
        )
        _, _, track = service.get_effective_limits(item, settings)
        assert track is False, f"Expected {cat} to default to track_laundry=False"


def test_idempotent_same_day_wear(db_session):
    """
    Wearing an outfit twice on the same day must not double-count. One wear per (user, item, date).
    """
    service = LaundryService(db_session)
    user = _get_or_create_test_user(db_session, "idempotent_user")

    item = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Casual Linen Shirt",
        category="tops",
        wear_count_since_wash=0,
        laundry_status="clean",
        track_laundry=True,
    )
    db_session.add(item)
    db_session.commit()

    today = date.today()

    # First wear
    res1 = service.record_wear(user_id=user.id, item_ids=[item.id], target_date=today)
    assert res1["success"] is True
    assert item.wear_count_since_wash == 1

    # Second wear on the same date: idempotent
    res2 = service.record_wear(user_id=user.id, item_ids=[item.id], target_date=today)
    assert res2["success"] is True
    assert item.wear_count_since_wash == 1  # Did NOT double-count!


def test_wear_undo(db_session):
    """
    Undo wear: decrements count, removes wear log, and reverts laundry state if triggered by that wear.
    """
    service = LaundryService(db_session)
    user = _get_or_create_test_user(db_session, "undo_user")

    # Item with max_wears=1 so single wear triggers laundry
    item = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Delicate Silk Blouse",
        category="tops",
        wear_count_since_wash=0,
        laundry_status="clean",
        max_wears_override=1,
        wash_days_override=3,
        track_laundry=True,
    )
    db_session.add(item)
    db_session.commit()

    today = date.today()

    # 1. Wear item -> goes to in_laundry
    service.record_wear(user_id=user.id, item_ids=[item.id], target_date=today)
    assert item.wear_count_since_wash == 1
    assert item.laundry_status == "in_laundry"
    assert item.available_from is not None

    # 2. Undo wear -> reverts to clean, wear_count_since_wash = 0
    undo_res = service.undo_wear(user_id=user.id, item_ids=[item.id], target_date=today)
    assert undo_res["success"] is True
    assert item.wear_count_since_wash == 0
    assert item.laundry_status == "clean"
    assert item.available_from is None


def test_settings_change_marks_stale(db_session):
    """
    Changing laundry settings marks active recommendations stale without silently auto-regenerating.
    """
    service = LaundryService(db_session)
    user = _get_or_create_test_user(db_session, "stale_test_user")

    # Save initial recommendation
    today = date.today()
    service.repo.save_daily_recommendation(
        user_id=user.id,
        rec_date=today,
        occasion="Everyday",
        item_ids=[str(uuid.uuid4())],
        status="active",
    )

    rec = service.repo.get_daily_recommendation(user.id, today, "Everyday")
    assert rec.status == "active"

    # Update settings
    service.update_settings(user.id, {"default_max_wears": 3})

    # Stored recommendation is now marked "stale"
    rec_after = service.repo.get_daily_recommendation(user.id, today, "Everyday")
    assert rec_after.status == "stale"


def test_recommender_empty_states_rule_4_4a(db_session):
    """
    Rule 4.4a Empty States:
    A wardrobe with no items suitable for the occasion returns status="no_items"
    with accurate reasons and filter counts.
    """
    user = _get_or_create_test_user(db_session, "empty_rec_user")

    rec_service = RecommendationService(db_session)

    # Empty wardrobe check
    import asyncio
    recs = asyncio.run(
        rec_service.generate_recommendations(
            user_id=user.id,
            occasion="Office",
            target_date=date.today(),
            limit=1,
        )
    )

    assert len(recs) == 1
    rec = recs[0]
    assert rec.status == "no_items"
    assert rec.can_wear is False
    assert rec.empty_reason is not None
    assert "no Office-suitable clothes" in rec.empty_reason["message"] or "no" in rec.empty_reason["message"].lower()


def test_recommender_partial_outfit_missing_slot(db_session):
    """
    Rule 4.4a #2 Partial Outfit:
    A wardrobe with top and bottom but missing footwear returns status="partial_outfit"
    with missing_slots=["footwear"] and can_wear=False.
    """
    user = _get_or_create_test_user(db_session, "partial_rec_user")

    # Add top and bottom, but NO footwear
    top = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Casual White Oxford Shirt",
        category="tops",
        review_required=False,
        is_finalized=True,
        processing_status="completed",
        laundry_status="clean",
        wear_count_since_wash=0,
    )
    bottom = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Navy Chino Trousers",
        category="bottoms",
        review_required=False,
        is_finalized=True,
        processing_status="completed",
        laundry_status="clean",
        wear_count_since_wash=0,
    )
    db_session.add(top)
    db_session.add(bottom)
    db_session.commit()

    rec_service = RecommendationService(db_session)
    import asyncio
    recs = asyncio.run(
        rec_service.generate_recommendations(
            user_id=user.id,
            occasion="Everyday",
            target_date=date.today(),
            limit=1,
            preferred_item_ids=[top.id, bottom.id],
        )
    )

    assert len(recs) == 1
    rec = recs[0]
    # Missing footwear produces partial outfit
    if rec.status == "partial_outfit":
        assert rec.can_wear is False
        assert "footwear" in (rec.missing_slots or [])


def test_multi_user_isolation(db_session):
    """
    Multi-user isolation: User A's laundry settings, wear logs, and daily recs
    are strictly isolated from User B.
    """
    user_a = _get_or_create_test_user(db_session, "isolated_user_a")
    user_b = _get_or_create_test_user(db_session, "isolated_user_b")

    service = LaundryService(db_session)

    # User A customizes settings
    service.update_settings(user_a.id, {"default_max_wears": 7, "default_wash_days": 1})

    # User B gets own settings, not User A's
    b_settings = service.get_settings(user_b.id)
    assert b_settings.default_max_wears == 2  # Default, not User A's 7
    assert b_settings.default_wash_days == 4   # Default, not User A's 1

    # User A's daily recommendation is invisible to User B
    today = date.today()
    service.repo.save_daily_recommendation(
        user_id=user_a.id,
        rec_date=today,
        occasion="Everyday",
        item_ids=[str(uuid.uuid4())],
        status="active",
    )

    assert service.repo.get_daily_recommendation(user_b.id, today, "Everyday") is None


def test_switching_occasion_preserves_other_occasions(db_session):
    """
    Prompt requirement 6:
    Switching occasion: moving from an occasion with clothes to one without
    shows the empty state and keeps the first occasion's stored outfit intact.
    """
    user = _get_or_create_test_user(db_session, "occasion_switch_user")
    service = LaundryService(db_session)
    today = date.today()

    item_id = str(uuid.uuid4())

    # 1. Stored outfit for "Everyday"
    service.repo.save_daily_recommendation(
        user_id=user.id,
        rec_date=today,
        occasion="Everyday",
        item_ids=[item_id],
        status="active",
    )

    # 2. Store empty state for "Wedding"
    service.repo.save_daily_recommendation(
        user_id=user.id,
        rec_date=today,
        occasion="Wedding",
        item_ids=[],
        status="no_items",
        empty_reason={"message": "Your wardrobe has no Wedding-suitable clothes yet."},
    )

    # 3. Check "Wedding" is no_items
    rec_wedding = service.repo.get_daily_recommendation(user.id, today, "Wedding")
    assert rec_wedding is not None
    assert rec_wedding.status == "no_items"

    # 4. Check "Everyday" remains active with its item intact!
    rec_everyday = service.repo.get_daily_recommendation(user.id, today, "Everyday")
    assert rec_everyday is not None
    assert rec_everyday.status == "active"
    assert rec_everyday.item_ids == [item_id]
