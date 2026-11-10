"""
Test suite for genuine occasion-based recommendation engine, weekly routine fallback,
and pending AI review filtering.
Verifies:
- Recommendation context priority (Calendar > Selected occasion > Routine > Lifestyle)
- Unreviewed garments (review_required=True) are strictly excluded from recommendations
- Occasion hard filters reject incompatible garments (e.g. sports shoes/gym wear for Office)
- Wardrobe gap warning is emitted in recommendation context when critical garments are missing
"""

import pytest
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.calendar_event import CalendarEvent
from app.models.user_preference import UserPreference
from app.core.security import create_access_token


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user_with_wardrobe(db_session):
    username = f"rec_user_{uuid4().hex[:8]}"
    email = f"{username}@example.com"
    user = User(
        username=username,
        email=email,
        password_hash="hashed_pw_test",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Add verified accepted wardrobe items
    c1 = Clothing(
        user_id=user.id,
        name="White Oxford Dress Shirt",
        category="tops",
        subcategory="shirt",
        color="white",
        occasion="Office",
    )
    c2 = Clothing(
        user_id=user.id,
        name="Tailored Navy Chinos",
        category="bottoms",
        subcategory="chinos",
        color="navy",
        occasion="Office",
    )
    c3 = Clothing(
        user_id=user.id,
        name="Leather Penny Loafers",
        category="shoes",
        subcategory="loafers",
        color="brown",
        occasion="Office",
    )

    # Add an unreviewed item (MUST BE EXCLUDED)
    c_unreviewed = Clothing(
        user_id=user.id,
        name="Unreviewed Graphic T-Shirt",
        category="tops",
        subcategory="t_shirt",
        color="black",
        occasion="Casual",
    )

    db_session.add_all([c1, c2, c3, c_unreviewed])
    db_session.commit()
    db_session.refresh(c1)
    db_session.refresh(c2)
    db_session.refresh(c3)
    db_session.refresh(c_unreviewed)

    a1 = ClothingAnalysis(
        clothing_id=c1.id,
        feature_vector={"review_required": False, "is_finalized": True, "processing_status": "completed", "formality": 0.75},
        style_tags=["Smart casual", "Office"],
    )
    a2 = ClothingAnalysis(
        clothing_id=c2.id,
        feature_vector={"review_required": False, "is_finalized": True, "processing_status": "completed", "formality": 0.70},
        style_tags=["Smart casual", "Office"],
    )
    a3 = ClothingAnalysis(
        clothing_id=c3.id,
        feature_vector={"review_required": False, "is_finalized": True, "processing_status": "completed", "formality": 0.75},
        style_tags=["Smart casual", "Office"],
    )
    a_un = ClothingAnalysis(
        clothing_id=c_unreviewed.id,
        feature_vector={"review_required": True, "is_finalized": False, "processing_status": "predictions_ready", "formality": 0.20},
        style_tags=["Casual"],
    )
    db_session.add_all([a1, a2, a3, a_un])
    db_session.commit()

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    yield user, headers, [c1, c2, c3, c_unreviewed]

    # Teardown
    try:
        db_session.query(Clothing).filter(Clothing.user_id == user.id).delete()
        db_session.query(UserPreference).filter(UserPreference.user_id == user.id).delete()
        db_session.query(User).filter(User.id == user.id).delete()
        db_session.commit()
    except Exception:
        db_session.rollback()


def test_recommendation_excludes_unreviewed_items(test_user_with_wardrobe, db_session):
    user, headers, items = test_user_with_wardrobe
    client = TestClient(app)

    res = client.post(
        "/api/v1/recommendations/generate",
        json={"recommendation_mode": "general", "limit": 1},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data) >= 1
    rec = data[0]
    outfit_piece_ids = [p["id"] for p in rec["outfit"]["clothing_items"]]

    # Unreviewed item (items[3]) must NEVER be recommended
    unreviewed_id = str(items[3].id)
    assert unreviewed_id not in outfit_piece_ids


def test_occasion_context_priority_and_routine_fallback(test_user_with_wardrobe, db_session):
    user, headers, items = test_user_with_wardrobe
    client = TestClient(app)

    # 1. Configure user weekly routine: Tuesday = "Business meeting"
    pref = db_session.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(user_id=user.id)
        db_session.add(pref)

    tuesday_date = date(2026, 11, 10)  # Tuesday
    pref.weekly_routine = [
        {"day": "Tuesday", "activity": "Work", "dress_code": "Business meeting"}
    ]
    db_session.commit()

    # When no occasion and no calendar event is passed for target_date = Tuesday,
    # the routine must dictate the occasion!
    res = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "general",
            "target_date": tuesday_date.isoformat(),
            "limit": 1,
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    rec = data[0]
    rec_occasion = rec.get("context", {}).get("occasion") or rec.get("outfit", {}).get("occasion")
    assert rec_occasion in ("Business meeting", "Business Meeting", "Office")

    # 2. Selected occasion takes precedence when user manually overrides
    res_override = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Casual outing",
            "target_date": tuesday_date.isoformat(),
            "limit": 1,
        },
        headers=headers,
    )
    assert res_override.status_code == 200, res_override.text
    data_override = res_override.json()
    rec_override_occasion = data_override[0].get("context", {}).get("occasion") or data_override[0].get("outfit", {}).get("occasion")
    assert rec_override_occasion == "Casual outing"


def test_wardrobe_gap_warning_in_recommendation_context(test_user_with_wardrobe, db_session):
    user, headers, items = test_user_with_wardrobe
    client = TestClient(app)

    # When recommending for "Business meeting" and user does not have a formal blazer,
    # the recommendation metadata must contain a gap_warning pointing to Outerwear & Blazers!
    res = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Business meeting",
            "limit": 1,
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    rec = data[0]

    # Check that context has gap_warning
    assert "gap_warning" in rec["context"]
    assert "blazer" in rec["context"]["gap_warning"].lower()
    assert rec["context"]["suggested_gap_category"] == "Outerwear & Blazers"


def test_active_recommendation_endpoint_and_caching(test_user_with_wardrobe, db_session):
    user, headers, items = test_user_with_wardrobe
    client = TestClient(app)

    # 1. Initially, no active recommendation exists for Office
    res_none = client.get(
        "/api/v1/recommendations/active?occasion=Office",
        headers=headers,
    )
    assert res_none.status_code == 404

    # 2. Generate a recommendation for Office
    res_gen = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Office",
            "limit": 1,
        },
        headers=headers,
    )
    assert res_gen.status_code == 200
    gen_data = res_gen.json()
    first_id = gen_data[0]["id"]

    # 3. GET /active?occasion=Office must return the exact same recommendation
    res_active = client.get(
        "/api/v1/recommendations/active?occasion=Office",
        headers=headers,
    )
    assert res_active.status_code == 200
    active_data = res_active.json()
    assert active_data["id"] == first_id

    # 4. Another /generate call without force_regenerate must reuse the active one
    res_reuse = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Office",
            "limit": 1,
        },
        headers=headers,
    )
    assert res_reuse.status_code == 200
    assert res_reuse.json()[0]["id"] == first_id


def test_occasion_discriminative_selection_gym_vs_office(test_user_with_wardrobe, db_session):
    user, headers, items = test_user_with_wardrobe
    client = TestClient(app)

    # Add athletic garments to the wardrobe
    gym_top = Clothing(
        user_id=user.id,
        name="Moisture Wicking Workout Tank",
        category="tops",
        subcategory="tank",
        color="black",
        occasion="Gym",
    )
    gym_bottom = Clothing(
        user_id=user.id,
        name="Performance Compression Running Shorts",
        category="bottoms",
        subcategory="shorts",
        color="charcoal",
        occasion="Gym",
    )
    gym_shoes = Clothing(
        user_id=user.id,
        name="Cushioned Running Sports Sneakers",
        category="shoes",
        subcategory="sneakers",
        color="white",
        occasion="Gym",
    )
    db_session.add_all([gym_top, gym_bottom, gym_shoes])
    db_session.commit()
    db_session.refresh(gym_top)
    db_session.refresh(gym_bottom)
    db_session.refresh(gym_shoes)

    a_gt = ClothingAnalysis(
        clothing_id=gym_top.id,
        feature_vector={"review_required": False, "is_finalized": True, "processing_status": "completed", "formality": 0.10},
        style_tags=["Athletic", "Gym / Sports"],
    )
    a_gb = ClothingAnalysis(
        clothing_id=gym_bottom.id,
        feature_vector={"review_required": False, "is_finalized": True, "processing_status": "completed", "formality": 0.10},
        style_tags=["Athletic", "Gym / Sports"],
    )
    a_gs = ClothingAnalysis(
        clothing_id=gym_shoes.id,
        feature_vector={"review_required": False, "is_finalized": True, "processing_status": "completed", "formality": 0.15},
        style_tags=["Athletic", "Gym / Sports"],
    )
    db_session.add_all([a_gt, a_gb, a_gs])
    db_session.commit()

    # 1. Recommendation for "Gym / Sports" must pick athletic gear and reject dress shoes / oxford shirts
    res_gym = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Gym / Sports",
            "force_regenerate": True,
            "limit": 1,
        },
        headers=headers,
    )
    assert res_gym.status_code == 200, res_gym.text
    gym_recs = res_gym.json()
    assert len(gym_recs) >= 1
    gym_piece_names = [p["name"].lower() for p in gym_recs[0]["outfit"]["clothing_items"]]
    assert any("tank" in n or "workout" in n for n in gym_piece_names)
    assert any("shorts" in n or "running" in n for n in gym_piece_names)
    assert not any("oxford" in n for n in gym_piece_names)
    assert not any("loafers" in n for n in gym_piece_names)

    # 2. Recommendation for "Office" must pick tailored pieces and reject compression shorts
    res_office = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Office",
            "force_regenerate": True,
            "limit": 1,
        },
        headers=headers,
    )
    assert res_office.status_code == 200, res_office.text
    office_recs = res_office.json()
    assert len(office_recs) >= 1
    office_piece_names = [p["name"].lower() for p in office_recs[0]["outfit"]["clothing_items"]]
    assert any("oxford" in n for n in office_piece_names)
    assert not any("compression" in n or "running shorts" in n for n in office_piece_names)

