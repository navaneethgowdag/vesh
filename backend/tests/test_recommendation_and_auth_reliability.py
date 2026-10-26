import uuid
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ai.model_manager import model_manager
from app.ai.recommendation_model import RecommendationModel, recommendation_model
from app.services.recommendation_service import RecommendationService
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_model_manager_interface_and_properties():
    """Verify ModelManager provides get_model() and recommendation_model attribute."""
    model = model_manager.get_model()
    assert model is not None
    assert isinstance(model, RecommendationModel)
    assert model_manager.recommendation_model is model


def test_recommendation_model_deterministic_fallback():
    """Verify deterministic fallback when no trained model is loaded."""
    rec_model = RecommendationModel()
    rec_model.is_trained = False
    rec_model.model = None

    features = {
        "style_match": 0.85,
        "color_match": 0.80,
        "category_match": 0.90,
        "weather_match": 0.75,
        "compatibility_score": 0.82,
        "learned_preference_score": 0.70,
        "explicit_preference_score": 0.80,
    }

    score = rec_model.predict_score(features)
    assert 0.0 <= score <= 1.0
    assert isinstance(score, float)
    assert score > 0.5


def test_recommendation_model_missing_features_resilience():
    """Verify predict_score handles empty or partial feature dictionaries gracefully."""
    rec_model = RecommendationModel()
    rec_model.is_trained = False

    # Completely empty features
    empty_score = rec_model.predict_score({})
    assert 0.0 <= empty_score <= 1.0

    # None and missing feature values
    partial_score = rec_model.predict_score({"compatibility_score": None, "colors": ["black"]})
    assert 0.0 <= partial_score <= 1.0


def test_recommendation_model_with_mock_trained_artifact():
    """Verify ML inference path when an artifact is loaded into RecommendationModel."""
    rec_model = RecommendationModel()
    mock_rf = MagicMock()
    mock_rf.predict.return_value = [0.912]

    rec_model.model = mock_rf
    rec_model.is_trained = True

    features = {
        "style_match": 0.9,
        "color_match": 0.9,
        "category_match": 0.9,
        "weather_match": 0.9,
        "occasion_match": 0.9,
        "season_match": 0.9,
        "learned_preference_score": 0.9,
        "explicit_preference_score": 0.9,
        "compatibility_score": 0.9,
        "wear_count_ratio": 0.5,
    }

    score = rec_model.predict_score(features)
    assert score == 0.912
    assert mock_rf.predict.called


def test_recommendation_model_handles_broken_ml_predict_with_fallback():
    """Verify that an exception in model.predict falls back gracefully to deterministic logic."""
    rec_model = RecommendationModel()
    mock_rf = MagicMock()
    mock_rf.predict.side_effect = RuntimeError("Prediction tensor shape mismatch")

    rec_model.model = mock_rf
    rec_model.is_trained = True

    features = {"compatibility_score": 0.85, "color_match": 0.80, "style_match": 0.80}
    score = rec_model.predict_score(features)
    assert 0.0 <= score <= 1.0


def test_daily_fit_empty_wardrobe_raises_400(client):
    """Verify that a user with an empty wardrobe receives a 400 Bad Request."""
    suffix = uuid.uuid4().hex[:8]
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"empty_user_{suffix}",
            "email": f"empty_{suffix}@test.com",
            "password": "Password123!",
            "display_name": "Empty Wardrobe User",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Request daily fit with empty wardrobe
    res = client.get("/api/v1/recommendations/daily-fit?city=New+York", headers=headers)
    assert res.status_code == 400
    detail = res.json().get("detail", "")
    assert "wardrobe is empty" in detail.lower()


def test_daily_fit_successful_generation_and_schema(client):
    """Verify complete Daily Fit generation with items in wardrobe."""
    suffix = uuid.uuid4().hex[:8]
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"rec_user_{suffix}",
            "email": f"rec_{suffix}@test.com",
            "password": "Password123!",
            "display_name": "Recommended User",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add wardrobe items
    items_to_add = [
        {"name": "White Linen Shirt", "category": "Tops", "color": "White", "season": "Summer", "occasion": "Casual Daily"},
        {"name": "Navy Tailored Trousers", "category": "Bottoms", "color": "Navy", "season": "All-Season", "occasion": "Casual Daily"},
        {"name": "Minimalist Leather Loafers", "category": "Shoes", "color": "Black", "season": "All-Season", "occasion": "Casual Daily"},
    ]
    for item in items_to_add:
        w_res = client.post("/api/v1/wardrobe", headers=headers, json=item)
        assert w_res.status_code == 201

    # Request daily fit
    res = client.get(
        "/api/v1/recommendations/daily-fit?city=London&occasion=Casual+Daily&variation_seed=0",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert "id" in data
    assert "outfit" in data
    assert "score" in data
    assert "reasoning" in data
    assert "context" in data
    assert data["outfit"]["name"] is not None
    assert len(data["outfit"]["clothing_items"]) >= 2
    assert 0.0 <= data["score"] <= 1.0


def test_daily_fit_variation_seed_cycling(client):
    """Verify that changing variation seed does not crash."""
    suffix = uuid.uuid4().hex[:8]
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"var_user_{suffix}",
            "email": f"var_{suffix}@test.com",
            "password": "Password123!",
            "display_name": "Variation User",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add wardrobe items
    for item in [
        {"name": "Top 1", "category": "Tops", "color": "White"},
        {"name": "Top 2", "category": "Tops", "color": "Black"},
        {"name": "Bottom 1", "category": "Bottoms", "color": "Blue"},
        {"name": "Shoes 1", "category": "Shoes", "color": "White"},
    ]:
        client.post("/api/v1/wardrobe", headers=headers, json=item)

    res_seed0 = client.get("/api/v1/recommendations/daily-fit?city=Tokyo&variation_seed=0", headers=headers)
    assert res_seed0.status_code == 200

    res_seed1 = client.get("/api/v1/recommendations/daily-fit?city=Tokyo&variation_seed=1", headers=headers)
    assert res_seed1.status_code == 200


def test_registration_conflict_handling_distinction(client):
    """Verify duplicate registration produces exact 409 Conflict with clear detail."""
    suffix = uuid.uuid4().hex[:8]
    username = f"user_{suffix}"
    email = f"user_{suffix}@stylesphere.dev"
    password = "ValidPassword123!"

    # 1. First registration succeeds
    r1 = client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": email, "password": password, "display_name": "First User"},
    )
    assert r1.status_code == 201

    # 2. Duplicate username returns 409 with username conflict message
    r2 = client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": f"different_{email}", "password": password, "display_name": "Second User"},
    )
    assert r2.status_code == 409
    assert f"Username '{username}' is already taken" in r2.json()["detail"]

    # 3. Duplicate email returns 409 with email conflict message
    r3 = client.post(
        "/api/v1/auth/register",
        json={"username": f"different_{username}", "email": email, "password": password, "display_name": "Third User"},
    )
    assert r3.status_code == 409
    assert f"Email '{email}' is already registered" in r3.json()["detail"]

    # 4. Password validation: less than 6 chars rejected with 422 Unprocessable Entity
    r4 = client.post(
        "/api/v1/auth/register",
        json={"username": f"short_{suffix}", "email": f"short_{suffix}@test.com", "password": "123"},
    )
    assert r4.status_code == 422
