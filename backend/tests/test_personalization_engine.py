"""
Unit and Integration Test Suite for Phase 4: Personalization and Continuous Learning Engine.
Tests:
1. User preference properties & default fallbacks.
2. Feedback reason encoding and decoding.
3. Mathematical time decay (half-life T_half = 30 days).
4. Cold-start confidence initialization and dynamic weighting.
5. Inferred profile formatting (top styles, top colors, evidence summary).
6. Positive feedback (like, wear) updates learned affinities.
7. Targeted negative feedback (reject with 'not_my_style' and 'dont_like_colors').
8. 5-minute feedback deduplication idempotency.
9. Wear tracking persistence and constituent clothing wear_count increments.
10. Same-day wear deduplication idempotency.
11. Personalization toggle bypass (personalization_enabled=False restores Phase 3 baseline).
12. Reset endpoint (POST /api/v1/users/me/personalization/reset).
"""

import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.learned_preference import LearnedPreference
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.calendar_event import CalendarEvent
from app.repositories.calendar_repository import CalendarRepository
from app.models.outfit import Outfit
from app.models.recommendation import Recommendation
from app.models.recommendation_feedback import (
    RecommendationFeedback,
    encode_feedback_reason,
    decode_feedback_reason,
)
from app.models.wear_history import WearHistory
from app.services.personalization_service import PersonalizationService
from app.services.recommendation_service import RecommendationService
from app.api.deps import get_current_user


# -------------------------------------------------------------------------
# Test Helpers & Fixtures
# -------------------------------------------------------------------------

def _create_test_user(db, email_prefix="phase4"):
    uid = uuid.uuid4()
    user = User(
        id=uid,
        email=f"{email_prefix}_{uid.hex[:8]}@example.com",
        username=f"user_{uid.hex[:8]}",
        password_hash="mock_hash",
        first_name="Phase 4",
        last_name="Learner",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    prefs = UserPreference(
        id=uuid.uuid4(),
        user_id=user.id,
        preferred_styles=["Minimal", "Casual"],
        preferred_colors=["White", "Navy", "Black"],
        preferred_fits={
            "personalization_enabled": True,
            "diversity_preference": "balanced",
            "avoid_recently_worn_days": 3,
            "avoided_colors": ["Neon Yellow"],
            "disliked_styles": ["Bohemian"],
        },
    )
    db.add(prefs)
    db.commit()
    return user


def _create_clothing(db, user_id, name, category, color, style="Casual", formality=0.5, wear_count=0):
    cid = uuid.uuid4()
    item = Clothing(
        id=cid,
        user_id=user_id,
        name=name,
        category=category,
        subcategory=category.lower(),
        color=color,
        season="All-Season",
        occasion="Casual Daily",
        image_url=f"/mock/{name.lower().replace(' ', '_')}.jpg",
        is_favorite=False,
        wear_count=wear_count,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    analysis = ClothingAnalysis(
        id=uuid.uuid4(),
        clothing_id=item.id,
        detected_category=category,
        style_tags=[style],
        confidence=0.92,
        detected_colors=[{"name": color, "hex": "#111111", "percentage": 0.85}],
        feature_vector={
            "formality": formality,
            "verified_attributes": {
                "category": category,
                "primary_color": color,
                "formality": formality,
                "is_finalized": True,
            },
        },
    )
    db.add(analysis)
    db.commit()
    db.refresh(item)
    return item


def _create_test_outfit_and_rec(db, user_id, event_id, top, bottom, shoes, occasion="Work & Office"):
    outfit = Outfit(
        id=uuid.uuid4(),
        user_id=user_id,
        name=f"Test Look {uuid.uuid4().hex[:6]}",
        clothing_items=[top, bottom, shoes],
        occasion=occasion,
    )
    db.add(outfit)
    db.commit()
    db.refresh(outfit)

    rec = Recommendation(
        id=uuid.uuid4(),
        user_id=user_id,
        outfit_id=outfit.id,
        recommendation_score=0.88,
        occasion=occasion,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return outfit, rec


@pytest.fixture
def auth_client():
    db = SessionLocal()
    user = _create_test_user(db)
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as test_client:
        yield test_client, user, db
    app.dependency_overrides.clear()
    db.close()


# -------------------------------------------------------------------------
# 1. Models, Encodings & Mathematical Formula Tests
# -------------------------------------------------------------------------

def test_feedback_reason_encoding_and_properties():
    assert encode_feedback_reason("not_my_style") == -2.0
    assert encode_feedback_reason("dont_like_colors") == -3.0
    assert encode_feedback_reason("too_formal") == -4.0
    assert encode_feedback_reason("too_casual") == -5.0
    assert encode_feedback_reason("not_suitable_for_occasion") == -6.0
    assert encode_feedback_reason("prefer_different") == -7.0
    assert encode_feedback_reason(None) is None

    assert decode_feedback_reason(-2.0) == "not_my_style"
    assert decode_feedback_reason(-3.0) == "dont_like_colors"
    assert decode_feedback_reason(-4.0) == "too_formal"
    assert decode_feedback_reason(1.0) is None

    fb = RecommendationFeedback(
        id=uuid.uuid4(),
        recommendation_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        action="reject",
        feedback_value=-2.0,
    )
    assert fb.reason == "not_my_style"


def test_time_decay_halflife(auth_client):
    _, _, db = auth_client
    svc = PersonalizationService(db)

    # Delta = 0 days -> decay = 1.0
    now = datetime.now(timezone.utc)
    decay_0 = svc.calculate_time_decay(now, now)
    assert pytest.approx(decay_0, 0.01) == 1.0

    # Delta = 30 days -> half-life (0.50)
    past_30 = now - timedelta(days=30)
    decay_30 = svc.calculate_time_decay(past_30, now)
    assert pytest.approx(decay_30, 0.05) == 0.50

    # Delta = 60 days -> 2 half-lives (0.25)
    past_60 = now - timedelta(days=60)
    decay_60 = svc.calculate_time_decay(past_60, now)
    assert pytest.approx(decay_60, 0.05) == 0.25


def test_cold_start_confidence_and_weights(auth_client):
    _, user, db = auth_client
    svc = PersonalizationService(db)

    profile = svc.get_inferred_profile(user.id)
    assert profile["confidence"] == 0.05
    assert profile["total_interactions"] == 0
    assert profile["top_styles"] == []
    assert profile["top_colors"] == []

    # Dynamic weights for cold-start
    w_pref = 0.25 * profile["confidence"]
    w_div = 0.10
    w_compat = 1.0 - w_pref - w_div
    assert pytest.approx(w_pref, 0.001) == 0.0125
    assert pytest.approx(w_compat, 0.001) == 0.8875


# -------------------------------------------------------------------------
# 2. Feedback Updates & Continuous Learning Tests
# -------------------------------------------------------------------------

def test_positive_feedback_learns_affinities(auth_client):
    client, user, db = auth_client

    # Create event & outfit
    cal_repo = CalendarRepository(db)
    cal_event = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Work & Office",
        notes="Strategy Review",
    )

    top = _create_clothing(db, user.id, "Silk Shirt", "Tops", "Navy", style="Minimal")
    bottom = _create_clothing(db, user.id, "Trousers", "Bottoms", "Grey", style="Minimal")
    shoes = _create_clothing(db, user.id, "Brogues", "Shoes", "Black", style="Formal")
    outfit, rec = _create_test_outfit_and_rec(db, user.id, cal_event.id, top, bottom, shoes)

    # Post like feedback
    resp = client.post(
        "/api/v1/recommendations/feedback",
        json={"recommendation_id": str(rec.id), "action": "like"},
    )
    assert resp.status_code == 200

    # Check learned preferences endpoint
    get_resp = client.get("/api/v1/users/me/learned-preferences")
    assert get_resp.status_code == 200
    learned = get_resp.json()

    assert learned["total_interactions"] >= 1
    assert learned["confidence"] > 0.05
    # Navy, Grey, Minimal affinities increased
    style_names = [s["style"] for s in learned.get("top_styles", [])]
    color_names = [c["color"] for c in learned.get("top_colors", [])]
    assert "Minimal" in style_names or learned["style_scores"].get("Minimal", 0) > 0
    assert "Navy" in color_names or learned["color_scores"].get("Navy", 0) > 0


def test_targeted_negative_feedback_not_my_style(auth_client):
    client, user, db = auth_client

    cal_repo = CalendarRepository(db)
    cal_event = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Party",
        notes="Art Gala",
    )

    top = _create_clothing(db, user.id, "Pattern Shirt", "Tops", "Beige", style="Vintage")
    bottom = _create_clothing(db, user.id, "Corduroys", "Bottoms", "Brown", style="Vintage")
    shoes = _create_clothing(db, user.id, "Boots", "Shoes", "Brown", style="Vintage")
    outfit, rec = _create_test_outfit_and_rec(db, user.id, cal_event.id, top, bottom, shoes)

    # Reject with 'not_my_style'
    resp = client.post(
        "/api/v1/recommendations/feedback",
        json={
            "recommendation_id": str(rec.id),
            "action": "reject",
            "reason": "not_my_style",
        },
    )
    assert resp.status_code == 200

    # Verify vintage style received negative delta
    get_resp = client.get("/api/v1/users/me/learned-preferences")
    learned = get_resp.json()
    assert learned["style_scores"].get("Vintage", 0) < 0


def test_targeted_negative_feedback_dont_like_colors(auth_client):
    client, user, db = auth_client

    cal_repo = CalendarRepository(db)
    cal_event = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Casual Daily",
        notes="Brunch",
    )

    top = _create_clothing(db, user.id, "Tee", "Tops", "Yellow", style="Casual")
    bottom = _create_clothing(db, user.id, "Shorts", "Bottoms", "Yellow", style="Casual")
    shoes = _create_clothing(db, user.id, "Sneakers", "Shoes", "White", style="Casual")
    outfit, rec = _create_test_outfit_and_rec(db, user.id, cal_event.id, top, bottom, shoes)

    # Reject with 'dont_like_colors'
    resp = client.post(
        "/api/v1/recommendations/feedback",
        json={
            "recommendation_id": str(rec.id),
            "action": "reject",
            "reason": "dont_like_colors",
        },
    )
    assert resp.status_code == 200

    get_resp = client.get("/api/v1/users/me/learned-preferences")
    learned = get_resp.json()
    assert learned["color_scores"].get("Yellow", 0) < 0


def test_feedback_idempotency_deduplication(auth_client):
    client, user, db = auth_client

    cal_repo = CalendarRepository(db)
    cal_event = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Casual Daily",
        notes="Check-in",
    )

    top = _create_clothing(db, user.id, "Polo", "Tops", "White")
    bottom = _create_clothing(db, user.id, "Chinos", "Bottoms", "Navy")
    shoes = _create_clothing(db, user.id, "Kicks", "Shoes", "White")
    outfit, rec = _create_test_outfit_and_rec(db, user.id, cal_event.id, top, bottom, shoes)

    # First like
    resp1 = client.post(
        "/api/v1/recommendations/feedback",
        json={"recommendation_id": str(rec.id), "action": "like"},
    )
    assert resp1.status_code == 200

    # Immediate duplicate like within debounce window
    resp2 = client.post(
        "/api/v1/recommendations/feedback",
        json={"recommendation_id": str(rec.id), "action": "like"},
    )
    assert resp2.status_code == 200

    # Ensure duplicate row was not added
    all_fb = (
        db.query(RecommendationFeedback)
        .filter(RecommendationFeedback.recommendation_id == rec.id)
        .all()
    )
    assert len(all_fb) == 1


# -------------------------------------------------------------------------
# 3. Wear Tracking & Deduplication Tests
# -------------------------------------------------------------------------

def test_wear_tracking_and_clothing_wear_count(auth_client):
    client, user, db = auth_client

    cal_repo = CalendarRepository(db)
    cal_event = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Work & Office",
        notes="Conference",
    )

    top = _create_clothing(db, user.id, "Oxford", "Tops", "Blue", wear_count=2)
    bottom = _create_clothing(db, user.id, "Slacks", "Bottoms", "Navy", wear_count=1)
    shoes = _create_clothing(db, user.id, "Derbies", "Shoes", "Black", wear_count=0)
    outfit, rec = _create_test_outfit_and_rec(db, user.id, cal_event.id, top, bottom, shoes)

    # Wear the recommendation
    resp = client.post(f"/api/v1/recommendations/{rec.id}/wear")
    assert resp.status_code == 200
    wear_data = resp.json()
    assert wear_data["success"] is True

    # Check clothing items wear_count incremented
    db.refresh(top)
    db.refresh(bottom)
    db.refresh(shoes)
    assert top.wear_count == 3
    assert bottom.wear_count == 2
    assert shoes.wear_count == 1

    # Check wear_history row created
    wear_entry = (
        db.query(WearHistory)
        .filter(WearHistory.outfit_id == outfit.id, WearHistory.user_id == user.id)
        .first()
    )
    assert wear_entry is not None
    assert wear_entry.worn_date == date.today()


def test_same_day_wear_deduplication(auth_client):
    client, user, db = auth_client

    cal_repo = CalendarRepository(db)
    cal_event = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Casual Daily",
        notes="Day Trip",
    )

    top = _create_clothing(db, user.id, "Linen Top", "Tops", "Beige", wear_count=0)
    bottom = _create_clothing(db, user.id, "Linen Pants", "Bottoms", "White", wear_count=0)
    shoes = _create_clothing(db, user.id, "Sandals", "Shoes", "Brown", wear_count=0)
    outfit, rec = _create_test_outfit_and_rec(db, user.id, cal_event.id, top, bottom, shoes)

    # First wear
    resp1 = client.post(f"/api/v1/recommendations/{rec.id}/wear")
    assert resp1.status_code == 200

    # Repeat wear on same calendar day
    resp2 = client.post(f"/api/v1/recommendations/{rec.id}/wear")
    assert resp2.status_code == 200

    # Wear count must NOT have incremented twice
    db.refresh(top)
    assert top.wear_count == 1

    # Only one wear_history record
    wears = (
        db.query(WearHistory)
        .filter(WearHistory.outfit_id == outfit.id)
        .all()
    )
    assert len(wears) == 1


# -------------------------------------------------------------------------
# 4. Personalization Toggle & Reset Tests
# -------------------------------------------------------------------------

def test_personalization_toggle_bypass(auth_client):
    _, user, db = auth_client
    pers_svc = PersonalizationService(db)

    # Toggle off in user preferences
    from sqlalchemy.orm.attributes import flag_modified
    prefs = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    raw_fits = dict(prefs.preferred_fits or {})
    raw_fits["personalization_enabled"] = False
    prefs.preferred_fits = raw_fits
    flag_modified(prefs, "preferred_fits")
    db.commit()
    db.refresh(prefs)

    top = _create_clothing(db, user.id, "Classic Oxford", "Tops", "White")
    bottom = _create_clothing(db, user.id, "Navy Chinos", "Bottoms", "Navy")
    shoes = _create_clothing(db, user.id, "Loafers", "Shoes", "Brown")
    candidate_items = [top, bottom, shoes]

    # Score personalization
    s_pref, s_div, res, rationales = pers_svc.score_candidate_personalization(
        items=candidate_items,
        target_occasion="Work & Office",
        user_id=user.id,
        user_pref=prefs,
    )
    # When disabled, weights are strictly 0.0 and final personalization score is neutral 0.5
    assert res["pref_weight"] == 0.0
    assert res["div_weight"] == 0.0


def test_reset_personalization_endpoint(auth_client):
    client, user, db = auth_client

    # Add artificial learned scores
    learned = db.query(LearnedPreference).filter(LearnedPreference.user_id == user.id).first()
    if not learned:
        learned = LearnedPreference(
            id=uuid.uuid4(),
            user_id=user.id,
            style_scores={"Vintage": 0.8},
            color_scores={"Teal": 0.7},
            confidence_score=0.75,
            interaction_count=15,
        )
        db.add(learned)
    else:
        learned.style_scores = {"Vintage": 0.8}
        learned.color_scores = {"Teal": 0.7}
        learned.confidence_score = 0.75
        learned.interaction_count = 15
    db.commit()

    # Call reset endpoint
    resp = client.post("/api/v1/users/me/personalization/reset")
    assert resp.status_code == 200
    reset_data = resp.json()
    assert reset_data["success"] is True

    # Inferred profile must be cold start
    get_resp = client.get("/api/v1/users/me/learned-preferences")
    assert get_resp.status_code == 200
    profile = get_resp.json()
    assert profile["confidence"] == 0.05
    assert profile["total_interactions"] == 0
    assert profile["style_scores"] == {}
    assert profile["color_scores"] == {}
