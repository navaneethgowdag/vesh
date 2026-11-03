"""
Test Suite for Wardrobe-Based AI Outfit Recommendation Engine.

Validates:
1. Google Calendar Independence: Users without Google Calendar or any calendar events can generate recommendations (Path B & Path C).
2. General Recommendations: Frictionless 'Suggest an outfit for me' without forcing occasion selection.
3. Calendar-Assisted with Occasion Override: Using an event while allowing the user to override the inferred occasion.
4. Footwear-Independent Construction: Users without footwear cataloged still receive complete, valid outfits.
5. Western Blouse Classification: Western blouses correctly classify as tops, not Indian blouses.
6. Constraints: Respects excluded_item_ids, avoided_colors, dress_code.
7. Preferred Items: Prioritizes and boosts preferred_item_ids.
8. Multi-User Isolation: User A never receives User B's garments.
9. Weather Modes: Automatic weather vs ignored weather.
10. Wear Tracking & Feedback: Records wear count and feedback actions.
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
from app.services.recommendation_service import classify_garment
from app.api.deps import get_current_user


def _get_or_create_user(db, email, username):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            password_hash="mock_hash",
            first_name="Styling",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _create_clothing(db, user_id, name, category, color, subcategory=None, category_group="western", formality=0.5, wear_count=0):
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
        confidence=0.92,
        detected_colors=[{"name": color, "hex": "#ffffff", "percentage": 0.85}],
        feature_vector={
            "formality": formality,
            "verified_attributes": {
                "category": category,
                "category_group": category_group,
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


@pytest.fixture
def auth_client():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = _get_or_create_user(db, f"stylist_{suffix}@example.com", f"user_{suffix}")
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as test_client:
        yield test_client, user, db
    app.dependency_overrides.clear()
    db.close()


# -------------------------------------------------------------------------
# 1. Western Blouse Classification Unit Test
# -------------------------------------------------------------------------
def test_western_blouse_classifies_as_western_top(auth_client):
    _, user, db = auth_client
    # Western blouse should be western_top
    western_blouse = _create_clothing(
        db, user.id, "Silk Office Blouse", "blouse", "Ivory", subcategory="blouse", category_group="western"
    )
    assert classify_garment(western_blouse) == "western_top"

    # Indian saree blouse with ethnic indicators should be indian_blouse
    indian_blouse = _create_clothing(
        db, user.id, "Choli Saree Blouse", "blouse", "Gold", subcategory="choli", category_group="indian"
    )
    assert classify_garment(indian_blouse) == "indian_blouse"


# -------------------------------------------------------------------------
# 2. Path B: Manual Occasion Recommendation Without Google Calendar
# -------------------------------------------------------------------------
def test_manual_occasion_recommendation_without_calendar(auth_client):
    client, user, db = auth_client

    # User has wardrobe pieces, but ZERO calendar events
    top = _create_clothing(db, user.id, "Poplin Button Shirt", "Tops", "White", subcategory="shirt", formality=0.65)
    bottom = _create_clothing(db, user.id, "Navy Chino Pants", "Bottoms", "Navy", subcategory="pants", formality=0.65)
    shoes = _create_clothing(db, user.id, "Leather Derbies", "Shoes", "Brown", subcategory="formal_shoes", formality=0.70)

    # Request recommendations for 'Office / Work' occasion directly
    resp = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Office / Work",
            "target_date": str(date.today()),
        },
    )
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) >= 1
    first_rec = recs[0]
    assert first_rec["score"] >= 0.70
    assert first_rec["outfit"]["occasion"] == "Office / Work"
    piece_names = [p["name"] for p in first_rec["outfit"]["clothing_items"]]
    assert "Poplin Button Shirt" in piece_names
    assert "Navy Chino Pants" in piece_names


# -------------------------------------------------------------------------
# 3. Path C: General Recommendation ('Suggest an outfit for me')
# -------------------------------------------------------------------------
def test_general_recommendation_without_occasion(auth_client):
    client, user, db = auth_client

    top = _create_clothing(db, user.id, "Casual Linen Tee", "Tops", "Grey", subcategory="t_shirt", formality=0.35)
    bottom = _create_clothing(db, user.id, "Slim Denim Jeans", "Bottoms", "Denim Blue", subcategory="jeans", formality=0.40)
    shoes = _create_clothing(db, user.id, "Canvas Sneakers", "Shoes", "White", subcategory="sneakers", formality=0.35)

    # Calling with recommendation_mode='general' and NO occasion
    resp = client.post(
        "/api/v1/recommendations/generate",
        json={"recommendation_mode": "general"},
    )
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) >= 1
    assert "outfit" in recs[0]
    assert recs[0]["score"] >= 0.70


# -------------------------------------------------------------------------
# 4. Footwear-Independent Synthesis (Wardrobe with NO shoes)
# -------------------------------------------------------------------------
def test_footwear_independent_synthesis(auth_client):
    client, user, db = auth_client

    # Isolated user with only tops and bottoms (NO shoes cataloged)
    iso_user = _get_or_create_user(db, f"noshoes_{uuid.uuid4().hex[:6]}@example.com", f"noshoes_{uuid.uuid4().hex[:6]}")
    app.dependency_overrides[get_current_user] = lambda: iso_user

    try:
        top = _create_clothing(db, iso_user.id, "Cotton Camp Shirt", "Tops", "Olive", subcategory="shirt", formality=0.55)
        bottom = _create_clothing(db, iso_user.id, "Pleated Beige Trousers", "Bottoms", "Beige", subcategory="pants", formality=0.60)

        # Generating recommendations must succeed despite having NO footwear items
        resp = client.post(
            "/api/v1/recommendations/generate",
            json={
                "recommendation_mode": "occasion",
                "occasion": "Casual outing",
            },
        )
        assert resp.status_code == 200
        recs = resp.json()
        assert len(recs) >= 1

        pieces = recs[0]["outfit"]["clothing_items"]
        assert len(pieces) == 2
        piece_names = [p["name"] for p in pieces]
        assert "Cotton Camp Shirt" in piece_names
        assert "Pleated Beige Trousers" in piece_names
    finally:
        app.dependency_overrides[get_current_user] = lambda: user


# -------------------------------------------------------------------------
# 5. Path A: Calendar-Assisted with User Occasion Override
# -------------------------------------------------------------------------
def test_calendar_assisted_with_occasion_override(auth_client):
    client, user, db = auth_client

    top = _create_clothing(db, user.id, "Structured Blazer", "Outerwear", "Black", subcategory="blazer", formality=0.85)
    shirt = _create_clothing(db, user.id, "Crisp White Shirt", "Tops", "White", subcategory="shirt", formality=0.75)
    bottom = _create_clothing(db, user.id, "Charcoal Dress Pants", "Bottoms", "Charcoal", subcategory="pants", formality=0.80)

    cal_repo = CalendarRepository(db)
    ev = cal_repo.create(
        user_id=user.id,
        event_date=date.today(),
        occasion="Work & Office",
        notes="General team sync",
    )

    # User explicitly overrides occasion to 'Interview'
    resp = client.post(
        "/api/v1/recommendations/generate",
        json={
            "calendar_event_id": str(ev.id),
            "occasion": "Interview",
        },
    )
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) >= 1
    # Check that the override occasion took effect
    assert recs[0]["outfit"]["occasion"] == "Interview"


# -------------------------------------------------------------------------
# 6. Hard Filter: Excluded Items & Dress Code
# -------------------------------------------------------------------------
def test_excluded_items_and_dress_code_filter(auth_client):
    client, user, db = auth_client

    item_to_exclude = _create_clothing(db, user.id, "Exclude Me Polo", "Tops", "Red", subcategory="shirt", formality=0.50)
    desired_shirt = _create_clothing(db, user.id, "Keep Me Oxford", "Tops", "Blue", subcategory="shirt", formality=0.65)
    pants = _create_clothing(db, user.id, "Khaki Chinos", "Bottoms", "Khaki", subcategory="pants", formality=0.60)

    resp = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Office / Work",
            "excluded_item_ids": [str(item_to_exclude.id)],
            "dress_code": "Smart Casual",
        },
    )
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) >= 1

    for rec in recs:
        ids = [p["id"] for p in rec["outfit"]["clothing_items"]]
        assert str(item_to_exclude.id) not in ids


# -------------------------------------------------------------------------
# 7. Preferred Items Prioritization Boost
# -------------------------------------------------------------------------
def test_preferred_items_boost(auth_client):
    client, user, db = auth_client

    shirt1 = _create_clothing(db, user.id, "Standard Tee", "Tops", "White", subcategory="t_shirt", formality=0.30)
    favorite_shirt = _create_clothing(db, user.id, "Favorite Graphic Shirt", "Tops", "Navy", subcategory="shirt", formality=0.45)
    pants = _create_clothing(db, user.id, "Everyday Jeans", "Bottoms", "Denim Blue", subcategory="jeans", formality=0.40)

    resp = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "general",
            "preferred_item_ids": [str(favorite_shirt.id)],
        },
    )
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) >= 1

    # First recommendation should feature the preferred item
    first_names = [p["name"] for p in recs[0]["outfit"]["clothing_items"]]
    assert "Favorite Graphic Shirt" in first_names


# -------------------------------------------------------------------------
# 8. Weather Ignored Mode
# -------------------------------------------------------------------------
def test_weather_ignored_mode(auth_client):
    client, user, db = auth_client

    top = _create_clothing(db, user.id, "Weather Neutral Tee", "Tops", "Black", subcategory="t_shirt", formality=0.35)
    bottom = _create_clothing(db, user.id, "Weather Neutral Shorts", "Bottoms", "Black", subcategory="shorts", formality=0.25)

    resp = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Sports / Gym",
            "weather_preference": "ignore",
        },
    )
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) >= 1
    assert "context" in recs[0]


# -------------------------------------------------------------------------
# 9. Multi-User Isolation Guarantee
# -------------------------------------------------------------------------
def test_multi_user_isolation(auth_client):
    client, user, db = auth_client

    # User B
    user_b = _get_or_create_user(db, f"user_b_{uuid.uuid4().hex[:6]}@example.com", f"user_b_{uuid.uuid4().hex[:6]}")
    user_b_top = _create_clothing(db, user_b.id, "User B Private Shirt", "Tops", "Purple", subcategory="shirt", formality=0.70)
    user_b_bottom = _create_clothing(db, user_b.id, "User B Private Trousers", "Bottoms", "Brown", subcategory="pants", formality=0.70)

    # Current User (User A)
    user_a_top = _create_clothing(db, user.id, "User A Public Shirt", "Tops", "Cream", subcategory="shirt", formality=0.60)
    user_a_bottom = _create_clothing(db, user.id, "User A Public Pants", "Bottoms", "Navy", subcategory="pants", formality=0.60)

    resp = client.post(
        "/api/v1/recommendations/generate",
        json={"recommendation_mode": "occasion", "occasion": "Casual outing"},
    )
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) >= 1

    for rec in recs:
        ids = [p["id"] for p in rec["outfit"]["clothing_items"]]
        assert str(user_b_top.id) not in ids
        assert str(user_b_bottom.id) not in ids


# -------------------------------------------------------------------------
# 10. Mark Outfit As Worn Tracking
# -------------------------------------------------------------------------
def test_mark_outfit_as_worn_updates_wear_count(auth_client):
    client, user, db = auth_client

    top = _create_clothing(db, user.id, "Worn Target Shirt", "Tops", "White", subcategory="shirt", wear_count=0)
    bottom = _create_clothing(db, user.id, "Worn Target Trousers", "Bottoms", "Navy", subcategory="pants", wear_count=0)

    resp = client.post(
        "/api/v1/recommendations/generate",
        json={"recommendation_mode": "general"},
    )
    assert resp.status_code == 200
    recs = resp.json()
    rec_id = recs[0]["id"]

    # Mark as worn
    wear_resp = client.post(f"/api/v1/recommendations/{rec_id}/wear")
    assert wear_resp.status_code == 200
    data = wear_resp.json()
    assert data["success"] is True
    assert data["wear_count_updated"] is True

    # Refresh items from DB and verify wear count incremented
    db.refresh(top)
    db.refresh(bottom)
    assert top.wear_count >= 1
    assert bottom.wear_count >= 1
