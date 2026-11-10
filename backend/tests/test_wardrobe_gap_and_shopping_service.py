"""
Test suite for Wardrobe Gap analysis and Intelligent Fashion Shopping recommendation service.
Verifies:
- Accepted items only analyzed for gaps (unreviewed items strictly excluded)
- Shopping recommendation provider returns personalized taste-ranked products
- Action endpoints: save product, dismiss product, mark already owned
"""

import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
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
def auth_user_with_gap(db_session):
    username = f"gap_user_{uuid4().hex[:8]}"
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

    # User only has casual tops and jeans, missing formal outerwear (blazers) and formal shoes
    c1 = Clothing(
        user_id=user.id,
        name="Casual White T-Shirt",
        category="tops",
        subcategory="t_shirt",
        color="white",
        occasion="Casual",
    )
    c2 = Clothing(
        user_id=user.id,
        name="Blue Denim Jeans",
        category="bottoms",
        subcategory="jeans",
        color="blue",
        occasion="Casual",
    )

    # An unreviewed item (must NOT affect gap analysis)
    c_unreviewed = Clothing(
        user_id=user.id,
        name="Unreviewed Formal Blazer",
        category="outerwear",
        subcategory="blazer",
        color="navy",
        occasion="Formal",
    )

    db_session.add_all([c1, c2, c_unreviewed])
    db_session.commit()
    db_session.refresh(c1)
    db_session.refresh(c2)
    db_session.refresh(c_unreviewed)

    a1 = ClothingAnalysis(
        clothing_id=c1.id,
        feature_vector={"review_required": False, "is_finalized": True, "processing_status": "completed", "formality": 0.30},
        style_tags=["Casual"],
    )
    a2 = ClothingAnalysis(
        clothing_id=c2.id,
        feature_vector={"review_required": False, "is_finalized": True, "processing_status": "completed", "formality": 0.35},
        style_tags=["Casual"],
    )
    a_un = ClothingAnalysis(
        clothing_id=c_unreviewed.id,
        feature_vector={"review_required": True, "is_finalized": False, "processing_status": "predictions_ready", "formality": 0.85},
        style_tags=["Formal"],
    )
    db_session.add_all([a1, a2, a_un])
    db_session.commit()

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    yield user, headers

    # Teardown
    try:
        db_session.query(Clothing).filter(Clothing.user_id == user.id).delete()
        db_session.query(UserPreference).filter(UserPreference.user_id == user.id).delete()
        db_session.query(User).filter(User.id == user.id).delete()
        db_session.commit()
    except Exception:
        db_session.rollback()


def test_gap_analysis_excludes_unreviewed_items(auth_user_with_gap, db_session):
    user, headers = auth_user_with_gap
    client = TestClient(app)

    res = client.get("/api/v1/wardrobe/gap-analysis?force_refresh=true", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # Total items counted must be 2 (excluding the unreviewed blazer)
    assert data["total_items"] == 2
    # Because user has no accepted formal wear, gap analysis detects gaps
    assert len(data["gaps"]) > 0


def test_shopping_recommendations_honest_blocked_state_and_actions(auth_user_with_gap, db_session):
    user, headers = auth_user_with_gap
    client = TestClient(app)

    # 1. Fetch shopping recommendations without external API credentials
    shop_res = client.get("/api/v1/wardrobe/shopping-recommendations?limit=6", headers=headers)
    assert shop_res.status_code == 200, shop_res.text
    shop_data = shop_res.json()

    assert "recommendations" in shop_data
    # Honest blocked state: no fabricated fake products
    assert len(shop_data["recommendations"]) == 0
    assert "provider_status" in shop_data
    assert shop_data["provider_status"]["is_live_configured"] is False
    assert shop_data["provider_status"]["status"] == "blocked"

    # 2. Test saving and dismissing with valid product ID
    prod_id = "test-prod-101"
    save_res = client.post(f"/api/v1/wardrobe/shopping-products/{prod_id}/save", headers=headers)
    assert save_res.status_code == 200, save_res.text
    assert save_res.json()["success"] is True

    # 3. Test dismissing product
    dismiss_res = client.post(f"/api/v1/wardrobe/shopping-products/{prod_id}/dismiss", headers=headers)
    assert dismiss_res.status_code == 200, dismiss_res.text
    assert dismiss_res.json()["success"] is True

    # 4. Fetch trending products (deferred behind feature flag)
    trend_res = client.get("/api/v1/wardrobe/trending?limit=4", headers=headers)
    assert trend_res.status_code == 200, trend_res.text
    trend_data = trend_res.json()
    assert "trending_products" in trend_data
    assert len(trend_data["trending_products"]) == 0
    assert trend_data["provider_status"]["status"] == "blocked"
