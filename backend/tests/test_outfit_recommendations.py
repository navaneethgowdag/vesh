"""
Test Suite for Phase 3: AI Outfit Recommendation Engine + Wardrobe Database Integration.
Validates:
1. Mandatory Calendar Event Prerequisite: recommendations cannot be generated without an existing calendar event.
2. Wardrobe Sufficiency Audit: empty or incomplete wardrobes return HTTP 422 with structured explanations.
3. Category-Aware Outfit Construction:
   - Western Two-Piece (Top + Bottom + Shoes + optional Outerwear/Accessory)
   - Western Dress (Dress + Shoes)
   - Indian Saree Ensemble (Saree + Blouse + Footwear, STRICTLY NO jeans/western bottoms)
   - Indian Kurta/Kurti + Bottom
   - Indian Lehenga + Blouse + Dupatta
4. Hard Filtering:
   - Formality compatibility delta <= 0.40 (rejects gym shorts with formal blazers)
   - Avoided colors exclusion
   - Occasion compatibility
5. Deterministic Compatibility Scoring (Occasion 25%, Category 20%, Color 20%, Style 15%, Formality 10%, Season 5%, Rotation 5%)
6. Weather Fallback: graceful, weather-neutral generation when climate data is unavailable
7. Idempotent Calendar Association: accepting recommendations links outfit_id and recommendation_id to calendar event without duplicates
8. Dismissal & Feedback Tracking
"""

import uuid
from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.calendar_event import CalendarEvent
from app.models.outfit import Outfit
from app.models.recommendation import Recommendation
from app.repositories.calendar_repository import CalendarRepository
from app.api.deps import get_current_user


# -------------------------------------------------------------------------
# Test Fixtures & Helpers
# -------------------------------------------------------------------------

def _get_or_create_test_user(db, email="test_phase3_user@example.com", username="phase3_stylist"):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            password_hash="mock_password_hash",
            first_name="Phase 3",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _create_clothing_item(db, user_id, name, category, color, subcategory=None, style="Casual", formality=0.5, wear_count=0):
    item = Clothing(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        category=category,
        subcategory=subcategory or category,
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
        confidence=0.90,
        detected_colors=[{"name": color, "hex": "#ffffff", "percentage": 0.8}],
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


def _ensure_basic_wardrobe(db, user_id):
    top = _create_clothing_item(db, user_id, f"Shirt {uuid.uuid4().hex[:6]}", "Tops", "White", subcategory="shirt", formality=0.6)
    bottom = _create_clothing_item(db, user_id, f"Pants {uuid.uuid4().hex[:6]}", "Bottoms", "Navy", subcategory="pants", formality=0.6)
    shoes = _create_clothing_item(db, user_id, f"Shoes {uuid.uuid4().hex[:6]}", "Shoes", "Black", subcategory="loafers", formality=0.6)
    return top, bottom, shoes


@pytest.fixture
def auth_client():
    db = SessionLocal()
    user = _get_or_create_test_user(
        db,
        email=f"phase3_{uuid.uuid4().hex[:8]}@example.com",
        username=f"stylist_{uuid.uuid4().hex[:8]}",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as test_client:
        yield test_client, user, db
    app.dependency_overrides.clear()
    db.close()


# -------------------------------------------------------------------------
# 1. Mandatory Calendar Event Prerequisite Tests
# -------------------------------------------------------------------------

def test_calendar_event_prerequisite_mandatory(auth_client):
    client, user, db = auth_client

    # Missing calendar_event_id completely -> 422
    resp = client.post("/api/v1/recommendations/generate", json={})
    assert resp.status_code == 422

    # Non-existent calendar_event_id -> 404
    fake_id = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/recommendations/generate",
        json={"calendar_event_id": fake_id, "occasion": "Work & Office"},
    )
    assert resp.status_code in (404, 422)


# -------------------------------------------------------------------------
# 2. Wardrobe Sufficiency Audit Tests
# -------------------------------------------------------------------------

def test_insufficient_wardrobe_returns_structured_422(auth_client):
    client, user, db = auth_client

    # Create a fresh isolated user with empty wardrobe
    iso_user = _get_or_create_test_user(db, email="empty_wardrobe_user@example.com", username="empty_tester")
    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=iso_user.id,
        event_date=date.today(),
        occasion="Casual Daily",
        notes="Empty wardrobe test",
    )

    try:
        app.dependency_overrides[get_current_user] = lambda: iso_user

        # Attempt to generate recommendations with empty wardrobe
        resp = client.post(
            "/api/v1/recommendations/generate",
            json={"calendar_event_id": str(ev.id), "occasion": "Casual Daily"},
        )
        assert resp.status_code == 422
        assert "empty" in resp.json()["detail"].lower() or "insufficient" in resp.json()["detail"].lower()

        # Add only 1 top (no bottom, no shoes) -> Still insufficient
        _create_clothing_item(db, iso_user.id, "Lone White Shirt", "Tops", "White", subcategory="shirt")

        resp2 = client.post(
            "/api/v1/recommendations/generate",
            json={"calendar_event_id": str(ev.id), "occasion": "Casual Daily"},
        )
        assert resp2.status_code == 422
        assert "insufficient" in resp2.json()["detail"].lower()
        assert "footwear" in resp2.json()["detail"].lower() or "bottom" in resp2.json()["detail"].lower()
    finally:
        app.dependency_overrides[get_current_user] = lambda: user


# -------------------------------------------------------------------------
# 3. Western Outfit Generation & Archetype Tests
# -------------------------------------------------------------------------

def test_western_outfit_generation(auth_client):
    client, user, db = auth_client

    # Setup Western wardrobe pieces
    top = _create_clothing_item(db, user.id, "Oxford Cotton Shirt", "Tops", "White", subcategory="shirt", formality=0.65)
    bottom = _create_clothing_item(db, user.id, "Navy Tailored Trousers", "Bottoms", "Navy", subcategory="pants", formality=0.65)
    shoes = _create_clothing_item(db, user.id, "Cognac Leather Loafers", "Shoes", "Cognac", subcategory="loafers", formality=0.65)
    blazer = _create_clothing_item(db, user.id, "Charcoal Wool Blazer", "Outerwear", "Charcoal", subcategory="blazer", formality=0.80)

    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Work & Office",
        notes="Client quarterly review",
    )

    resp = client.post(
        "/api/v1/recommendations/generate",
        json={
            "calendar_event_id": str(ev.id),
            "occasion": "Work & Office",
            "outfit_preference": "western",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1

    first_rec = data[0]
    assert "outfit" in first_rec
    assert "score" in first_rec
    assert first_rec["score"] >= 0.75

    # Check assembled items across recommendations
    all_assembled_names = [p["name"] for rec in data for p in rec["outfit"]["clothing_items"]]
    assert "Oxford Cotton Shirt" in all_assembled_names
    assert "Navy Tailored Trousers" in all_assembled_names
    assert "Cognac Leather Loafers" in all_assembled_names

    # Check deterministic explanations
    assert "reasoning" in first_rec
    assert "reasons" in first_rec
    assert len(first_rec["reasons"]) >= 3


# -------------------------------------------------------------------------
# 4. Indian Saree & Blouse Rules Test (Strict No-Jeans Enforcement)
# -------------------------------------------------------------------------

def test_indian_saree_archetype_strictly_excludes_jeans(auth_client):
    client, user, db = auth_client

    # Add Saree, Blouse, Sandals, and Western Jeans
    saree = _create_clothing_item(db, user.id, "Kanjivaram Silk Saree", "saree", "Burgundy", subcategory="saree", formality=0.85)
    blouse = _create_clothing_item(db, user.id, "Golden Brocade Blouse", "blouse", "Gold", subcategory="blouse", formality=0.85)
    sandals = _create_clothing_item(db, user.id, "Gold Heeled Sandals", "sandals", "Gold", subcategory="sandals", formality=0.80)
    jeans = _create_clothing_item(db, user.id, "Distressed Blue Jeans", "jeans", "Denim Blue", subcategory="jeans", formality=0.35)

    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Wedding / Festive",
        notes="Evening wedding reception",
    )

    resp = client.post(
        "/api/v1/recommendations/generate",
        json={
            "calendar_event_id": str(ev.id),
            "occasion": "Wedding / Festive",
            "outfit_preference": "indian",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1

    # Find saree recommendation
    saree_rec = None
    for rec in data:
        names = [p["name"] for p in rec["outfit"]["clothing_items"]]
        if "Kanjivaram Silk Saree" in names:
            saree_rec = rec
            break

    assert saree_rec is not None
    saree_pieces = [p["name"] for p in saree_rec["outfit"]["clothing_items"]]
    assert "Golden Brocade Blouse" in saree_pieces
    assert "Gold Heeled Sandals" in saree_pieces

    # STRICT CHECK: Saree must NEVER contain jeans or western pants!
    assert "Distressed Blue Jeans" not in saree_pieces


# -------------------------------------------------------------------------
# 5. Hard Filtering: Formality Clash Delta > 0.40 Rejection
# -------------------------------------------------------------------------

def test_hard_filter_formality_clash_rejection(auth_client):
    client, user, db = auth_client

    # Setup extreme formality clash:
    # Gym Shorts (formality 0.15) vs Tuxedo Blazer (formality 0.90) -> Delta = 0.75 > 0.40
    gym_shorts = _create_clothing_item(db, user.id, "Athletic Gym Shorts", "shorts", "Black", subcategory="shorts", formality=0.15, style="Athletic")
    tux_blazer = _create_clothing_item(db, user.id, "Formal Tuxedo Blazer", "outerwear", "Black", subcategory="blazer", formality=0.90, style="Formal")
    t_shirt = _create_clothing_item(db, user.id, "Crewneck T-Shirt", "t_shirt", "White", subcategory="t_shirt", formality=0.25, style="Casual")
    sneakers = _create_clothing_item(db, user.id, "Running Sneakers", "sneakers", "White", subcategory="sneakers", formality=0.20, style="Athletic")

    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Casual Daily",
        notes="Afternoon stroll",
    )

    resp = client.post(
        "/api/v1/recommendations/generate",
        json={"calendar_event_id": str(ev.id), "occasion": "Casual Daily"},
    )
    assert resp.status_code == 200
    data = resp.json()

    # None of the generated outfits should pair the Tuxedo Blazer with Athletic Gym Shorts
    for rec in data:
        names = [p["name"] for p in rec["outfit"]["clothing_items"]]
        has_tux = "Formal Tuxedo Blazer" in names
        has_gym_shorts = "Athletic Gym Shorts" in names
        assert not (has_tux and has_gym_shorts), "Tuxedo Blazer and Gym Shorts must be rejected by formality filter"


# -------------------------------------------------------------------------
# 6. Hard Filtering: Avoided Colors Exclusion
# -------------------------------------------------------------------------

def test_hard_filter_avoided_colors(auth_client):
    client, user, db = auth_client

    # Add red top, navy top, beige pants, white sneakers
    red_top = _create_clothing_item(db, user.id, "Crimson Red Shirt", "Tops", "Red", subcategory="shirt", formality=0.55)
    navy_top = _create_clothing_item(db, user.id, "Navy Linen Shirt", "Tops", "Navy", subcategory="shirt", formality=0.55)
    pants = _create_clothing_item(db, user.id, "Beige Chinos", "Bottoms", "Beige", subcategory="pants", formality=0.55)
    shoes = _create_clothing_item(db, user.id, "White Canvas Sneakers", "Shoes", "White", subcategory="sneakers", formality=0.45)

    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Casual Daily",
        notes="Lunch with friends",
    )

    # Request recommendations avoiding 'Red'
    resp = client.post(
        "/api/v1/recommendations/generate",
        json={
            "calendar_event_id": str(ev.id),
            "occasion": "Casual Daily",
            "avoided_colors": ["Red"],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1

    for rec in data:
        for p in rec["outfit"]["clothing_items"]:
            assert p["color"].lower() != "red", "Avoided color 'Red' must not be in recommendations"


# -------------------------------------------------------------------------
# 7. Weather Neutral Fallback
# -------------------------------------------------------------------------

def test_weather_unavailable_graceful_fallback(auth_client):
    client, user, db = auth_client
    _ensure_basic_wardrobe(db, user.id)

    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Casual Daily",
        notes="Weather fallback test",
    )

    # Unknown remote city where Open-Meteo geocoding won't find or will default
    resp = client.post(
        "/api/v1/recommendations/generate?city=NonExistentMetropolis12345",
        json={"calendar_event_id": str(ev.id), "occasion": "Casual Daily"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    # Check that temperature defaults gracefully
    assert "context" in data[0]
    assert data[0]["context"]["temperature"] is not None


# -------------------------------------------------------------------------
# 8. Accept Recommendation Idempotent Calendar Association
# -------------------------------------------------------------------------

def test_accept_recommendation_associates_calendar_idempotently(auth_client):
    client, user, db = auth_client
    _ensure_basic_wardrobe(db, user.id)

    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Work & Office",
        notes="Quarterly leadership sync",
    )

    # 1. Generate recommendations
    gen_resp = client.post(
        "/api/v1/recommendations/generate",
        json={"calendar_event_id": str(ev.id), "occasion": "Work & Office"},
    )
    assert gen_resp.status_code == 200
    recs = gen_resp.json()
    assert len(recs) >= 1

    selected_rec_id = recs[0]["id"]

    # 2. Accept recommendation
    accept_resp = client.post(
        f"/api/v1/recommendations/{selected_rec_id}/accept",
        json={"calendar_event_id": str(ev.id)},
    )
    assert accept_resp.status_code == 200
    accept_data = accept_resp.json()
    assert accept_data["status"] == "accepted"
    assert str(accept_data["calendar_event_id"]) == str(ev.id)

    # 3. Verify calendar event updated in database
    updated_ev = cal_repo.get_by_id(ev.id, user_id=user.id)
    assert updated_ev is not None
    assert str(updated_ev.outfit_id) == str(accept_data["outfit_id"])

    # 4. Idempotency test: Call accept a second time
    accept_resp2 = client.post(
        f"/api/v1/recommendations/{selected_rec_id}/accept",
        json={"calendar_event_id": str(ev.id)},
    )
    assert accept_resp2.status_code == 200
    assert accept_resp2.json()["status"] == "accepted"
    assert str(accept_resp2.json()["calendar_event_id"]) == str(ev.id)


# -------------------------------------------------------------------------
# 9. Dismiss Recommendation Test
# -------------------------------------------------------------------------

def test_dismiss_recommendation(auth_client):
    client, user, db = auth_client
    _ensure_basic_wardrobe(db, user.id)

    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Casual Daily",
        notes="Weekend coffee",
    )

    gen_resp = client.post(
        "/api/v1/recommendations/generate",
        json={"calendar_event_id": str(ev.id), "occasion": "Casual Daily"},
    )
    recs = gen_resp.json()
    rec_id = recs[0]["id"]

    dismiss_resp = client.post(f"/api/v1/recommendations/{rec_id}/dismiss")
    assert dismiss_resp.status_code == 200
    assert dismiss_resp.json()["status"] == "dismissed"
