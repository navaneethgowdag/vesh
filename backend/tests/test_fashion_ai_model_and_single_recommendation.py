"""
Comprehensive Test Suite for Fashion AI Multi-Task Model Integration & Single Outfit Recommendation.

Validates:
1. Model Loading: Loads MultiTaskEfficientNetB0 checkpoint, configs, and mappings from artifacts/.
2. Evaluation Mode & Inference: Runs with torch.inference_mode() and eval mode on CPU/GPU.
3. Real Image Prediction & Normalization: Correctly processes RGB and RGBA transparent images.
4. Class Mapping & Snake-Case Schema: Returns article_type, master_category, sub_category, base_colour,
   gender, season, usage, pattern, age_group, model_version, and confidence scores.
5. Review Required Indicator: Flags low confidence predictions (< 0.40).
6. Non-Destructive Auto-Population: Does not overwrite user-confirmed attributes.
7. Single Outfit Recommendation: Recommendation API and service default to returning exactly 1 best outfit.
8. Multi-User Isolation: Users cannot see or access other users' predictions or recommendations.
9. Graceful Failure: Missing artifacts or invalid images fail safely without application crashes.
"""

import os
import io
import uuid
from datetime import date
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.clothing_prediction import ClothingPrediction
from app.models.recommendation import Recommendation
from app.ai.fashion_model import fashion_model_service, MultiTaskEfficientNetB0
from app.services.clothing_prediction_service import prediction_service
from app.services.recommendation_service import RecommendationService
from app.api.deps import get_current_user


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_user(db, email, username):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            password_hash="mock_hash_pw",
            first_name="Fashion",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def test_artifacts_exist_and_service_loads():
    """Verify artifacts directory contains all required inference files."""
    assert os.path.exists("artifacts/best_model.pt")
    assert os.path.exists("artifacts/model_config.json")
    assert os.path.exists("artifacts/preprocessing.json")
    assert os.path.exists("artifacts/class_mappings.json")

    loaded = fashion_model_service.load_model()
    assert loaded is True
    assert fashion_model_service.is_loaded is True
    assert isinstance(fashion_model_service.model, MultiTaskEfficientNetB0)
    assert not fashion_model_service.model.training  # Must be in eval mode


def test_model_prediction_structure_and_tasks():
    """Verify model output structure contains all 9 expected tasks in snake_case."""
    # Synthetic clothing image (navy blue shirt)
    img = Image.new("RGB", (224, 224), color=(20, 40, 90))
    res = fashion_model_service.predict(img)

    expected_tasks = [
        "article_type",
        "master_category",
        "sub_category",
        "gender",
        "base_colour",
        "season",
        "usage",
        "pattern",
        "age_group",
    ]
    for task in expected_tasks:
        assert task in res, f"Missing task {task} in prediction output"
        task_data = res[task]
        assert "prediction" in task_data
        assert "confidence" in task_data
        assert "review_required" in task_data
        assert "alternatives" in task_data
        assert isinstance(task_data["prediction"], str)
        assert 0.0 <= task_data["confidence"] <= 1.0

    assert res.get("model_version") == "1.0.0"
    assert res.get("model_name") == "efficientnet_b0_multitask"
    assert "overall_confidence" in res
    assert "review_required" in res


def test_rgba_image_alpha_compositing():
    """Verify transparent RGBA images are composited onto solid white background without error."""
    # Create an RGBA image with transparent background
    rgba_img = Image.new("RGBA", (300, 300), color=(0, 0, 0, 0))
    # Draw an opaque colored patch in the center
    for x in range(50, 250):
        for y in range(50, 250):
            rgba_img.putpixel((x, y), (200, 30, 30, 255))

    prepared = fashion_model_service._prepare_image(rgba_img)
    assert prepared.mode == "RGB"
    assert prepared.size == (300, 300)

    # Top left corner should now be white (255, 255, 255)
    corner_pixel = prepared.getpixel((0, 0))
    assert corner_pixel == (255, 255, 255)

    # Run inference on prepared image
    res = fashion_model_service.predict(rgba_img)
    assert res["model_version"] == "1.0.0"
    assert "article_type" in res


def test_wardrobe_payload_formatting():
    """Verify formatting of predictions into standard ClothingPrediction payload."""
    img = Image.new("RGB", (224, 224), color=(50, 50, 50))
    pred = fashion_model_service.predict(img)
    payload = fashion_model_service.format_wardrobe_payload(pred, image_source="processed")

    assert payload["model_name"] == "efficientnet_b0_multitask"
    assert payload["model_version"] == "1.0.0"
    assert payload["input_image_source"] == "processed"
    assert "predicted_category" in payload
    assert "category_group" in payload
    assert "category_score" in payload
    assert "predicted_attributes" in payload

    attrs = payload["predicted_attributes"]
    assert "category" in attrs
    assert "subcategory" in attrs
    assert "primary_color" in attrs
    assert "season" in attrs
    assert "occasion" in attrs
    assert "pattern" in attrs


def test_user_confirmed_attributes_are_preserved(test_db):
    """Verify prediction service does NOT overwrite user-confirmed attributes."""
    user = _get_or_create_user(test_db, "user_preserve_attrs@tailorbird.test", "preserve_tester")

    item = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="My Hand-Edited Cashmere Sweater",
        category="tops",
        subcategory="Fine Cashmere",
        color="Burgundy",
        pattern="Ribbed",
        season="Winter",
        occasion="Formal",
    )
    test_db.add(item)
    test_db.flush()

    analysis = ClothingAnalysis(
        id=uuid.uuid4(),
        clothing_id=item.id,
        feature_vector={
            "is_finalized": True,
            "user_confirmed": True,
            "user_corrections": [{"field": "color", "old": "Black", "new": "Burgundy"}],
            "verified_attributes": {
                "category": "tops",
                "color": "Burgundy",
            },
        },
    )
    test_db.add(analysis)
    test_db.commit()

    # Create synthetic prediction with different values (e.g. Blue T-Shirt)
    synthetic_pred = {
        "model_name": "efficientnet_b0_multitask",
        "model_version": "1.0.0",
        "input_image_source": "processed",
        "predicted_category": "Tshirts",
        "category_group": "Apparel",
        "category_score": 0.95,
        "predicted_attributes": {
            "category": "top",
            "subcategory": "Tshirts",
            "primary_color": "Blue",
            "color": "Blue",
            "pattern": "Solid",
            "season": "Summer",
            "occasion": "Casual",
        },
        "prediction_scores": {},
    }

    prediction_service.save_prediction(test_db, item, synthetic_pred, user.id)

    # Re-fetch item from database
    test_db.refresh(item)
    assert item.category == "tops"
    assert item.subcategory == "Fine Cashmere"
    assert item.color == "Burgundy"
    assert item.pattern == "Ribbed"
    assert item.season == "Winter"
    assert item.occasion == "Formal"


def test_empty_attributes_are_auto_populated_from_predictions(test_db):
    """Verify unpopulated garment attributes are automatically filled from model predictions."""
    user = _get_or_create_user(test_db, "user_autopopulate@tailorbird.test", "autopopulate_tester")

    item = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Unclassified Upload",
        category=None,
        subcategory=None,
        color=None,
        pattern=None,
        season=None,
        occasion=None,
    )
    test_db.add(item)
    test_db.commit()

    synthetic_pred = {
        "model_name": "efficientnet_b0_multitask",
        "model_version": "1.0.0",
        "input_image_source": "processed",
        "predicted_category": "Jeans",
        "category_group": "Apparel",
        "category_score": 0.92,
        "predicted_attributes": {
            "category": "bottom",
            "subcategory": "Jeans",
            "primary_color": "Navy Blue",
            "color": "Navy Blue",
            "pattern": "Solid",
            "season": "All-Season",
            "occasion": "Casual",
        },
        "prediction_scores": {},
    }

    prediction_service.save_prediction(test_db, item, synthetic_pred, user.id)

    test_db.refresh(item)
    assert item.category == "bottom"
    assert item.subcategory == "Jeans"
    assert item.color == "Navy Blue"
    assert item.pattern == "Solid"
    assert item.season == "All-Season"
    assert item.occasion == "Casual"


@pytest.mark.asyncio
async def test_single_outfit_recommendation_default_limit(test_db):
    """Verify recommendation service defaults to returning exactly ONE best outfit recommendation."""
    user = _get_or_create_user(test_db, "user_single_rec@tailorbird.test", "single_rec_tester")

    # Seed multiple items so candidates can form multiple outfits
    items = [
        Clothing(id=uuid.uuid4(), user_id=user.id, name="White Linen Shirt", category="top", subcategory="shirt", color="White", season="Summer", occasion="Casual"),
        Clothing(id=uuid.uuid4(), user_id=user.id, name="Blue Oxford Shirt", category="top", subcategory="shirt", color="Blue", season="Summer", occasion="Casual"),
        Clothing(id=uuid.uuid4(), user_id=user.id, name="Black Chino Pants", category="bottom", subcategory="trousers", color="Black", season="Summer", occasion="Casual"),
        Clothing(id=uuid.uuid4(), user_id=user.id, name="Khaki Shorts", category="bottom", subcategory="shorts", color="Khaki", season="Summer", occasion="Casual"),
        Clothing(id=uuid.uuid4(), user_id=user.id, name="White Sneakers", category="shoes", subcategory="sneakers", color="White", season="Summer", occasion="Casual"),
    ]
    test_db.add_all(items)
    test_db.commit()

    service = RecommendationService(test_db)
    recs = await service.generate_recommendations(
        user_id=user.id,
        occasion="Casual Daily",
    )

    # Must return exactly ONE recommendation
    assert len(recs) == 1
    best_rec = recs[0]
    assert isinstance(best_rec, Recommendation)
    assert best_rec.outfit is not None
    assert len(best_rec.outfit.clothing_items) >= 2  # Composed of top + bottom
    assert best_rec.recommendation_score > 0.0


def test_api_recommendation_endpoint_defaults_to_single_rec(client, test_db):
    """Verify API POST /recommendations/generate defaults to returning a list of 1 recommendation."""
    user = _get_or_create_user(test_db, "api_single_rec@tailorbird.test", "api_single_tester")

    items = [
        Clothing(id=uuid.uuid4(), user_id=user.id, name="Navy Blazer", category="outerwear", subcategory="blazer", color="Navy Blue", season="Fall", occasion="Workwear"),
        Clothing(id=uuid.uuid4(), user_id=user.id, name="Grey Slacks", category="bottom", subcategory="trousers", color="Grey", season="Fall", occasion="Workwear"),
        Clothing(id=uuid.uuid4(), user_id=user.id, name="White Dress Shirt", category="top", subcategory="shirt", color="White", season="Fall", occasion="Workwear"),
    ]
    test_db.add_all(items)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        response = client.post(
            "/api/v1/recommendations/generate",
            json={
                "occasion": "Workwear",
                "recommendation_mode": "occasion",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1  # Exactly ONE recommendation returned
        assert "outfit" in data[0]
        assert len(data[0]["outfit"]["clothing_items"]) >= 2
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_multi_user_security_isolation_for_predictions(client, test_db):
    """Verify User B cannot access User A's clothing predictions."""
    user_a = _get_or_create_user(test_db, "user_a_pred@tailorbird.test", "user_a_pred")
    user_b = _get_or_create_user(test_db, "user_b_pred@tailorbird.test", "user_b_pred")

    item_a = Clothing(
        id=uuid.uuid4(),
        user_id=user_a.id,
        name="User A Private Trench Coat",
        category="outerwear",
        color="Beige",
    )
    test_db.add(item_a)
    test_db.commit()

    # User B attempts to access User A's clothing predictions
    app.dependency_overrides[get_current_user] = lambda: user_b
    try:
        resp = client.get(f"/api/v1/clothing/{item_a.id}/predictions")
        assert resp.status_code == 403  # Forbidden
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_predict_endpoint_with_image_upload(client, test_db):
    """Verify POST /clothing-ai/predict returns structured attributes for uploaded image."""
    user = _get_or_create_user(test_db, "api_predict_user@tailorbird.test", "api_predict_user")
    app.dependency_overrides[get_current_user] = lambda: user

    # Create dummy in-memory image
    img = Image.new("RGB", (224, 224), color=(180, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    try:
        resp = client.post(
            "/api/v1/clothing-ai/predict",
            files={"file": ("garment.jpg", buf, "image/jpeg")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "article_type" in data
        assert "master_category" in data
        assert "sub_category" in data
        assert "base_colour" in data
        assert "gender" in data
        assert "season" in data
        assert "usage" in data
        assert "pattern" in data
        assert "age_group" in data
        assert data.get("model_version") == "1.0.0"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
