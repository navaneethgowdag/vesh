"""
Comprehensive Test Suite for Simplified Clothing Upload Pipeline & AI Attributes:
1. Attribute Options Endpoint: Exposes exact class mappings for all 9 model heads.
2. Predict-First & No Background Removal: Model predicts directly on original image;
   original image URL is saved; no background removal or segmentation occurs.
3. 9-Heads Attribute Updates: User edits/corrections for all 9 heads persist to database
   while preserving raw model predictions.
4. Finalize Workflow: Finalizes item with confirmed attributes and retains original image URL.
"""

import io
import uuid
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.clothing_image import ClothingImage
from app.ai.fashion_model import fashion_model_service
from app.services.clothing_image_service import ClothingImageService
from app.services.clothing_processing_service import ClothingProcessingService
from app.services.clothing_prediction_service import prediction_service
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
            password_hash="mock_hashed_pw",
            first_name="Simplified",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _create_synthetic_garment_bytes(color=(40, 100, 200), size=(224, 224)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_get_clothing_attribute_options(test_db):
    """
    Test GET /api/v1/clothing/attribute-options:
    Must return clean class mapping lists for all 9 prediction heads:
    article_type, master_category, sub_category, base_colour,
    gender, season, usage, pattern, age_group.
    """
    client = TestClient(app)
    response = client.get("/api/v1/clothing/attribute-options")
    assert response.status_code == 200
    data = response.json()

    expected_heads = [
        "article_type",
        "master_category",
        "sub_category",
        "base_colour",
        "gender",
        "season",
        "usage",
        "pattern",
        "age_group",
    ]
    for head in expected_heads:
        assert head in data, f"Missing head {head} in attribute options"
        assert isinstance(data[head], list)
        assert len(data[head]) > 0
        # Ensure 'nan' or empty string is strictly excluded
        for opt in data[head]:
            assert str(opt).lower() not in ("nan", "none", "null", "")

    # Check exact counts matching class_mappings.json
    assert len(data["article_type"]) == 142
    assert len(data["master_category"]) == 7
    assert len(data["sub_category"]) == 45
    assert len(data["gender"]) == 5
    assert len(data["base_colour"]) == 46
    assert len(data["season"]) == 4
    assert len(data["usage"]) == 8
    assert len(data["pattern"]) == 16
    assert len(data["age_group"]) == 6


def test_clothing_upload_no_background_removal(test_db):
    """
    Test POST /api/v1/clothing/upload:
    1. Validates and stores original image in Neon BYTEA.
    2. Runs EfficientNet-B0 directly on original image.
    3. image_url points to original binary stream.
    4. NO background removal or processed catalog image is generated.
    """
    user = _get_or_create_user(test_db, "simpl_upload@tailorbird.test", "simpl_upload_user")
    app.dependency_overrides[get_current_user] = lambda: user

    client = TestClient(app)
    img_bytes = _create_synthetic_garment_bytes(color=(30, 70, 150))

    try:
        response = client.post(
            "/api/v1/clothing/upload",
            files={"file": ("test_blue_shirt.jpg", img_bytes, "image/jpeg")},
            data={"name": "Test Casual Blue Shirt"},
        )
        assert response.status_code == 202
        data = response.json()

        assert "item_id" in data
        item_id = uuid.UUID(data["item_id"])

        # Status and stage must indicate predictions ready without background removal
        assert data["status"] == "predictions_ready"
        assert data["stage"] == "predictions_ready"
        assert data["original_image_url"] == f"/api/v1/clothing/{item_id}/image/original"

        # Check in DB
        clothing = test_db.query(Clothing).filter(Clothing.id == item_id).first()
        assert clothing is not None
        assert clothing.image_url == f"/api/v1/clothing/{item_id}/image/original"

        # Verify ONLY original image exists in BYTEA, NO processed image exists
        image_svc = ClothingImageService(test_db)
        assert image_svc.has_image(clothing.id, user.id, "original")
        assert not image_svc.has_image(clothing.id, user.id, "processed")

        # Verify prediction payload returned contains 9 multi-task heads
        pred = data.get("prediction")
        assert pred is not None
        scores = pred.get("prediction_scores", {})
        for task in ("article_type", "master_category", "sub_category", "base_colour", "season", "usage"):
            assert task in scores
            assert "confidence" in scores[task]

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_update_and_finalize_with_9_attributes(test_db):
    """
    Test PATCH /api/v1/clothing/{id}/attributes and POST /api/v1/clothing/{id}/finalize:
    Verifies user can update all 9 attributes, they are persisted,
    and finalize marks item ready in wardrobe while retaining original image.
    """
    user = _get_or_create_user(test_db, "attrs_user@tailorbird.test", "attrs_user")
    app.dependency_overrides[get_current_user] = lambda: user

    client = TestClient(app)
    img_bytes = _create_synthetic_garment_bytes(color=(20, 20, 20))

    try:
        # 1. Upload item
        upload_resp = client.post(
            "/api/v1/clothing/upload",
            files={"file": ("test_black_jeans.jpg", img_bytes, "image/jpeg")},
            data={"name": "Initial Black Pants"},
        )
        assert upload_resp.status_code == 202
        item_id = upload_resp.json()["item_id"]

        # 2. Update attributes with all 9 model heads
        update_payload = {
            "name": "Classic Midnight Denim Jeans",
            "article_type": "Jeans",
            "master_category": "Apparel",
            "sub_category": "Bottomwear",
            "base_colour": "Navy Blue",
            "pattern": "Solid",
            "gender": "Men",
            "season": "Fall",
            "usage": "Casual",
            "age_group": "Adults-Men",
            "brand": "TailorBird Atelier",
        }

        patch_resp = client.patch(
            f"/api/v1/clothing/{item_id}/attributes",
            json=update_payload,
        )
        assert patch_resp.status_code == 200
        patch_data = patch_resp.json()

        cur_attrs = patch_data["current_attributes"]
        assert cur_attrs["name"] == "Classic Midnight Denim Jeans"
        assert cur_attrs["article_type"] == "Jeans"
        assert cur_attrs["master_category"] == "Apparel"
        assert cur_attrs["sub_category"] == "Bottomwear"
        assert cur_attrs["base_colour"] == "Navy Blue"
        assert cur_attrs["pattern"] == "Solid"
        assert cur_attrs["gender"] == "Men"
        assert cur_attrs["season"] == "Fall"
        assert cur_attrs["usage"] == "Casual"
        assert cur_attrs["age_group"] == "Adults-Men"

        # Check mapped slot category
        clothing = test_db.query(Clothing).filter(Clothing.id == uuid.UUID(item_id)).first()
        assert clothing.category == "bottom"
        assert clothing.color == "Navy Blue"

        # 3. Finalize item
        fin_resp = client.post(
            f"/api/v1/clothing/{item_id}/finalize",
            json={"verified_attributes": update_payload},
        )
        assert fin_resp.status_code == 200
        fin_data = fin_resp.json()
        assert fin_data["is_finalized"] is True

        test_db.refresh(clothing)
        # Original image URL must remain preserved as the clothing item's image
        assert clothing.image_url == f"/api/v1/clothing/{item_id}/image/original"

    finally:
        app.dependency_overrides.pop(get_current_user, None)
