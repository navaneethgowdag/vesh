"""
Automated Test Suite for TailorBird Admin Authentication, Model Management,
and 42-Feature Recommendation ML Integration.
"""

import os
import sys
import pytest
from uuid import uuid4
from dotenv import load_dotenv

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.services.recommendation_ml_service import (
    recommendation_ml_service,
    ALL_42_FEATURES,
    CATEGORICAL_FEATURES,
    NUMERICAL_FEATURES,
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def regular_user_token():
    session = SessionLocal()
    try:
        # Create or fetch temporary regular user
        user = session.query(User).filter(User.username == "test_regular_user").first()
        if not user:
            user = User(
                id=uuid4(),
                username="test_regular_user",
                email="test_regular@example.com",
                password_hash=get_password_hash("RegularPass123!"),
                first_name="Regular",
                last_name="Customer",
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
        token = create_access_token(subject=str(user.id), role="user")
        return token
    finally:
        session.close()


@pytest.fixture(scope="module")
def admin_token(client):
    admin_pwd = settings.ADMIN_PASSWORD or "AdminSecure2026!"
    admin_user = settings.ADMIN_USERNAME or "admin"
    res = client.post("/api/v1/admin/auth/login", json={"username": admin_user, "password": admin_pwd})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()["access_token"]


# =========================================================================
# 1. Admin Security and Authorization Tests
# =========================================================================

def test_admin_unauthorized_rejection(client):
    """Unauthenticated calls to admin endpoints must return 401 Unauthorized."""
    res = client.get("/api/v1/admin/dashboard/overview")
    assert res.status_code == 401


def test_regular_user_forbidden(client, regular_user_token):
    """Normal customer tokens must receive 403 Forbidden on all admin endpoints."""
    headers = {"Authorization": f"Bearer {regular_user_token}"}
    
    endpoints = [
        ("GET", "/api/v1/admin/dashboard/overview"),
        ("GET", "/api/v1/admin/models/clothing"),
        ("GET", "/api/v1/admin/models/recommendation"),
        ("GET", "/api/v1/admin/training/history"),
        ("POST", "/api/v1/admin/models/clothing/train"),
        ("POST", "/api/v1/admin/models/recommendation/train"),
    ]
    for method, path in endpoints:
        if method == "GET":
            r = client.get(path, headers=headers)
        else:
            r = client.post(path, json={}, headers=headers)
        assert r.status_code == 403, f"Expected 403 for {path}, got {r.status_code}"


def test_admin_login_success(client):
    """Admin login with valid credentials returns access token and role=admin."""
    admin_pwd = settings.ADMIN_PASSWORD or "AdminSecure2026!"
    admin_user = settings.ADMIN_USERNAME or "admin"
    res = client.post("/api/v1/admin/auth/login", json={"username": admin_user, "password": admin_pwd})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"
    assert data["user"]["is_admin"] is True


def test_admin_login_invalid_password(client):
    """Admin login with wrong password returns 401 Unauthorized."""
    admin_user = settings.ADMIN_USERNAME or "admin"
    res = client.post("/api/v1/admin/auth/login", json={"username": admin_user, "password": "WrongPassword999!"})
    assert res.status_code == 401


def test_admin_me_endpoint(client, admin_token):
    """Admin profile endpoint returns admin details."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/auth/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "admin"
    assert data["is_admin"] is True


# =========================================================================
# 2. Recommendation ML 42-Feature Schema & Inference Tests
# =========================================================================

def test_recommendation_ml_model_loading():
    """Trained Random Forest model bundle must load cleanly in memory."""
    assert recommendation_ml_service.is_loaded is True
    assert recommendation_ml_service.pipeline is not None
    assert recommendation_ml_service.active_version != "none"


def test_42_features_schema_completeness():
    """Features schema must match the exact 42 features from tailorbird_preference_model.json."""
    assert len(ALL_42_FEATURES) == 42
    assert len(CATEGORICAL_FEATURES) == 27
    assert len(NUMERICAL_FEATURES) == 15


def test_feature_extraction_and_prediction():
    """Extract features from sample garments and verify RF regressor prediction."""
    # Create mock clothing items
    top = Clothing(
        id=uuid4(),
        name="White Oxford Shirt",
        category="Tops",
        subcategory="Shirts",
        color="White",
        pattern="Solid",
        season="All-Season",
        fit="Regular",
    )
    bottom = Clothing(
        id=uuid4(),
        name="Navy Chinos",
        category="Bottoms",
        subcategory="Trousers",
        color="Navy",
        pattern="Solid",
        season="All-Season",
        fit="Regular",
    )
    shoes = Clothing(
        id=uuid4(),
        name="Brown Leather Loafers",
        category="Shoes",
        subcategory="Loafers",
        color="Brown",
        pattern="Solid",
        season="All-Season",
        fit="Regular",
    )
    items = [top, bottom, shoes]

    occasion_prof = {"target_formality": 0.70, "min_formality": 0.55, "max_formality": 0.85}
    color_analysis = {"score": 0.92, "harmony_type": "Neutral Classic", "chromatic_count": 1}

    # Construct features
    features = recommendation_ml_service.construct_42_features(
        items=items,
        user=None,
        user_pref=None,
        target_occasion="office",
        occasion_prof=occasion_prof,
        temp=22.0,
        condition="clear",
        color_analysis=color_analysis,
        compat_score=0.88,
        score_occasion=0.85,
        hard_eligible=True,
    )

    # Verify all 42 keys exist in output dictionary
    for feat in ALL_42_FEATURES:
        assert feat in features, f"Missing required feature: {feat}"

    # Verify model prediction
    score = recommendation_ml_service.predict_preference_score(features)
    assert score is not None
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0


# =========================================================================
# 3. Admin Dashboard & Model Console Endpoints Tests
# =========================================================================

def test_admin_dashboard_overview(client, admin_token):
    """Admin overview returns clothing model, recommendation model, and live feedback statistics."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/dashboard/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "clothing_model" in data
    assert data["clothing_model"]["architecture"] == "EfficientNet-B0 Multi-Task (PyTorch)"
    assert data["clothing_model"]["supported_heads_count"] == 9

    assert "recommendation_model" in data
    assert data["recommendation_model"]["algorithm"] == "RandomForestRegressor"
    assert data["recommendation_model"]["feature_count"] == 42
    assert "metrics" in data["recommendation_model"]

    assert "feedback_statistics" in data
    assert data["feedback_statistics"]["total_impressions"] >= 0
    assert data["feedback_statistics"]["available_training_records"] >= 0


def test_recommendation_model_endpoints(client, admin_token):
    """Recommendation model fine-tuning console endpoints."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Model details
    res = client.get("/api/v1/admin/models/recommendation", headers=headers)
    assert res.status_code == 200
    assert res.json()["feature_count"] == 42

    # 2. Dataset preview
    res = client.post("/api/v1/admin/models/recommendation/dataset/preview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "validation_checks" in data
    assert data["validation_checks"]["all_42_features_defined"] is True

    # 3. Metrics
    res = client.get("/api/v1/admin/models/recommendation/metrics", headers=headers)
    assert res.status_code == 200
    assert "mae" in res.json()["metrics"]


def test_clothing_model_endpoints(client, admin_token):
    """Clothing classifier fine-tuning console endpoints."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Details
    res = client.get("/api/v1/admin/models/clothing", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["heads_count"] == 9
    assert "training_dataset_info" in data

    # 2. Metrics
    res = client.get("/api/v1/admin/models/clothing/metrics", headers=headers)
    assert res.status_code == 200
    assert "overall_metrics" in res.json()


def test_training_history_endpoint(client, admin_token):
    """Training history endpoint returns persisted audit logs."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/training/history", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_model_versions_registry(client, admin_token):
    """Version registry returns both clothing and recommendation model versions."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/models/versions", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "clothing_classifier_versions" in data
    assert "recommendation_model_versions" in data
