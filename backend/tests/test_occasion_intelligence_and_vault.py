"""
Comprehensive automated test suite for:
- Canonical occasion taxonomy & alias resolution
- Occasion discrimination and fashion compatibility rules
- Formality relaxation bounds (casual excluded from formal)
- Occasion Vault settings, reservation, analytics, and event prep
- Luxury garment isolation and user override
- Multi-group wardrobe organization
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
from app.core.security import create_access_token
from app.core.taxonomy import (
    normalize_occasion,
    get_canonical_occasion_id,
    get_occasion_profile_dict,
    OCCASION_DEFINITIONS,
)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session):
    username = f"vault_user_{uuid4().hex[:8]}"
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

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    return user, headers


# -----------------------------------------------------------------------------
# 1. Occasion Normalization & Taxonomy Tests
# -----------------------------------------------------------------------------

def test_occasion_alias_normalization():
    # 1. Office & Work
    assert normalize_occasion("Office").id == "office"
    assert normalize_occasion("Work & Office").id == "office"
    assert normalize_occasion("work_office").id == "office"
    assert normalize_occasion("office_work").id == "office"

    # 2. Party & Evening
    assert normalize_occasion("Party").id == "party"
    assert normalize_occasion("Party & Evening").id == "party"
    assert normalize_occasion("party_nightlife").id == "party"

    # 3. Date & Romantic
    assert normalize_occasion("Date").id == "date"
    assert normalize_occasion("Date Night").id == "date"
    assert normalize_occasion("date_romantic").id == "date"

    # 4. Travel & Airport
    assert normalize_occasion("Travel").id == "travel"
    assert normalize_occasion("Travel & Airport").id == "travel"

    # 5. Gym & Active
    assert normalize_occasion("Gym").id == "gym"
    assert normalize_occasion("Gym / Sports").id == "gym"
    assert normalize_occasion("Gym & Active").id == "gym"
    assert normalize_occasion("sports_fitness").id == "gym"

    # 6. Family Gathering has its own profile and does NOT become everyday
    fam = normalize_occasion("Family gathering")
    assert fam is not None
    assert fam.id == "family_gathering"
    assert fam.target_formality == 0.55
    assert fam.parent_category == "Daily and Casual"

    # 7. Unsupported occasion returns None (no silent Everyday fallback)
    assert normalize_occasion("Space Odyssey") is None
    with pytest.raises(ValueError):
        get_canonical_occasion_id("Space Odyssey")


def test_recommender_rejects_unsupported_occasion(test_user):
    user, headers = test_user
    client = TestClient(app)

    res = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Completely Unsupported Invalid Occasion",
        },
        headers=headers,
    )
    assert res.status_code == 422
    assert "Unsupported occasion" in res.json()["detail"]


# -----------------------------------------------------------------------------
# 2. Occasion Discrimination & Luxury Isolation Tests
# -----------------------------------------------------------------------------

def test_luxury_garment_isolated_from_everyday(test_user, db_session):
    user, headers = test_user
    client = TestClient(app)

    # Add everyday casual garments
    tee = Clothing(
        user_id=user.id,
        name="Grey Slub Cotton Tee",
        category="tops",
        subcategory="t_shirt",
        color="grey",
        occasion="Everyday",
    )
    jeans = Clothing(
        user_id=user.id,
        name="Washed Indigo Slim Jeans",
        category="bottoms",
        subcategory="jeans",
        color="blue",
        occasion="Everyday",
    )
    sneakers = Clothing(
        user_id=user.id,
        name="White Canvas Tennis Sneakers",
        category="shoes",
        subcategory="sneakers",
        color="white",
        occasion="Everyday",
    )

    # Add a luxury tuxedo / designer suit
    tux = Clothing(
        user_id=user.id,
        name="Tom Ford Wool-Silk Dinner Tuxedo",
        category="tops",
        subcategory="tuxedo",
        color="black",
        occasion="Formal event",
    )

    db_session.add_all([tee, jeans, sneakers, tux])
    db_session.commit()
    for it in [tee, jeans, sneakers, tux]:
        db_session.refresh(it)

    # Set up analyses and mark tux as luxury_special
    db_session.add_all([
        ClothingAnalysis(clothing_id=tee.id, feature_vector={"is_finalized": True, "review_required": False, "formality": 0.25}),
        ClothingAnalysis(clothing_id=jeans.id, feature_vector={"is_finalized": True, "review_required": False, "formality": 0.35}),
        ClothingAnalysis(clothing_id=sneakers.id, feature_vector={"is_finalized": True, "review_required": False, "formality": 0.30}),
        ClothingAnalysis(
            clothing_id=tux.id,
            feature_vector={
                "is_finalized": True,
                "review_required": False,
                "formality": 0.95,
                "vault": {
                    "wear_tier": "luxury_special",
                    "is_luxury": True,
                    "special_use_restriction": "special_occasions_only",
                },
            },
        ),
    ])
    db_session.commit()

    # 1. Recommendation for "Everyday" MUST EXCLUDE the Tuxedo!
    res_everyday = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Everyday",
            "force_regenerate": True,
            "limit": 1,
        },
        headers=headers,
    )
    assert res_everyday.status_code == 200, res_everyday.text
    recs = res_everyday.json()
    assert len(recs) >= 1
    names = [p["name"].lower() for p in recs[0]["outfit"]["clothing_items"]]
    assert not any("tuxedo" in n for n in names)
    assert any("tee" in n for n in names)

    # 2. Recommendation for "Gala" with Tuxedo + Formal bottom
    formal_pant = Clothing(
        user_id=user.id,
        name="Black Formal Satin Stripe Trousers",
        category="bottoms",
        subcategory="trousers",
        color="black",
        occasion="Formal event",
    )
    db_session.add(formal_pant)
    db_session.commit()
    db_session.refresh(formal_pant)
    db_session.add(ClothingAnalysis(clothing_id=formal_pant.id, feature_vector={"is_finalized": True, "review_required": False, "formality": 0.90}))
    db_session.commit()

    res_gala = client.post(
        "/api/v1/recommendations/generate",
        json={
            "recommendation_mode": "occasion",
            "occasion": "Gala",
            "force_regenerate": True,
            "limit": 1,
        },
        headers=headers,
    )
    assert res_gala.status_code == 200, res_gala.text
    gala_recs = res_gala.json()
    assert len(gala_recs) >= 1
    gala_names = [p["name"].lower() for p in gala_recs[0]["outfit"]["clothing_items"]]
    assert any("tuxedo" in n for n in gala_names)
    assert not any("jeans" in n for n in gala_names)
    assert not any("tee" in n for n in gala_names)


# -----------------------------------------------------------------------------
# 3. Occasion Vault API & Intelligence Tests
# -----------------------------------------------------------------------------

def test_occasion_vault_endpoints(test_user, db_session):
    user, headers = test_user
    client = TestClient(app)

    # 1. Create a special garment
    sherwani = Clothing(
        user_id=user.id,
        name="Royal Raw Silk Embroidered Sherwani",
        category="tops",
        subcategory="sherwani",
        color="ivory",
        occasion="Wedding",
    )
    db_session.add(sherwani)
    db_session.commit()
    db_session.refresh(sherwani)

    a = ClothingAnalysis(
        clothing_id=sherwani.id,
        feature_vector={
            "is_finalized": True,
            "review_required": False,
            "formality": 0.95,
            "vault": {
                "wear_tier": "luxury_special",
                "is_luxury": True,
                "purchase_price": 850.00,
                "care_type": "dry_clean_only",
                "reserved_status": "available",
            },
        },
    )
    db_session.add(a)
    db_session.commit()

    # 2. List Vault items
    res_list = client.get("/api/v1/vault/items", headers=headers)
    assert res_list.status_code == 200
    v_items = res_list.json()
    assert len(v_items) >= 1
    assert any(i["id"] == str(sherwani.id) for i in v_items)

    # 3. Update Vault Settings
    res_update = client.put(
        f"/api/v1/vault/items/{sherwani.id}/settings",
        json={
            "purchase_price": 1200.0,
            "care_type": "dry_clean_only",
            "notes": "Reserved for brother's wedding",
            "suitable_occasions": ["wedding", "wedding_reception"],
        },
        headers=headers,
    )
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["purchase_price"] == 1200.0
    assert updated["care_type"] == "dry_clean_only"
    assert "wedding" in updated["suitable_occasions"]

    # 4. Toggle reservation
    res_res = client.post(
        f"/api/v1/vault/items/{sherwani.id}/reserve",
        json={"reserved_status": "reserved", "notes": "Hold for Dec 15 event"},
        headers=headers,
    )
    assert res_res.status_code == 200
    assert res_res.json()["reserved_status"] == "reserved"

    # 5. Check Vault Analytics
    res_ana = client.get("/api/v1/vault/analytics", headers=headers)
    assert res_ana.status_code == 200
    ana = res_ana.json()
    assert ana["total_vault_items"] >= 1
    assert ana["luxury_items_count"] >= 1
    assert ana["reserved_count"] >= 1
    assert ana["total_vault_valuation"] >= 1200.0

    # 6. Event Preparation Intelligence
    res_prep = client.post(
        "/api/v1/vault/event-prep",
        json={
            "occasion": "Wedding",
            "attendee_role": "close_family",
        },
        headers=headers,
    )
    assert res_prep.status_code == 200
    prep = res_prep.json()
    assert prep["occasion"] == "Wedding Ceremony"
    assert prep["target_formality"] >= 0.90
    assert len(prep["care_reminders"]) >= 1
    assert any("dry clean only" in r.lower() for r in prep["care_reminders"])


# -----------------------------------------------------------------------------
# 4. Multi-Group Wardrobe Organization Tests
# -----------------------------------------------------------------------------

def test_wardrobe_groups_filtering(test_user, db_session):
    user, headers = test_user
    client = TestClient(app)

    # Garment belonging to both 'daily_work' and 'party_evening'
    polo = Clothing(
        user_id=user.id,
        name="Fine Merino Knit Polo",
        category="tops",
        subcategory="polo",
        color="navy",
        occasion="Work & Office",
    )
    db_session.add(polo)
    db_session.commit()
    db_session.refresh(polo)

    polo.wardrobe_groups = ["daily_work", "party_evening"]
    db_session.commit()

    # Query with wardrobe_group=daily_work
    res_work = client.get("/api/v1/wardrobe?wardrobe_group=daily_work", headers=headers)
    assert res_work.status_code == 200
    assert any(i["id"] == str(polo.id) for i in res_work.json())

    # Query with wardrobe_group=party_evening
    res_party = client.get("/api/v1/wardrobe?wardrobe_group=party_evening", headers=headers)
    assert res_party.status_code == 200
    assert any(i["id"] == str(polo.id) for i in res_party.json())

    # Query with wardrobe_group=luxury_special -> must not include polo
    res_lux = client.get("/api/v1/wardrobe?wardrobe_group=luxury_special", headers=headers)
    assert res_lux.status_code == 200
    assert not any(i["id"] == str(polo.id) for i in res_lux.json())
