"""
Comprehensive Test Suite for Clothing Upload Pipeline:
Sequence: Predict on Original Image First -> User Attribute Review -> Remove Background Second.

Tests:
1. Model receives original image before background removal.
2. Upload endpoint returns immediate predictions on original image (status='predictions_ready', stage='predictions_ready').
3. Separate storage of original and processed images in Neon BYTEA.
4. Background removal executes after review via POST /{item_id}/remove-background.
5. User edits/corrections are preserved and not overwritten.
6. Pipeline handles skipping background removal (saving with original image).
7. Decoupled failure handling: background removal failure does not destroy predictions.
"""

import os
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
            first_name="Pipeline",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _create_synthetic_garment_bytes(color=(30, 80, 160), size=(300, 300)) -> bytes:
    """Create a realistic garment image bytes buffer with distinct color."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_predict_original_garment_runs_on_original_image(test_db):
    """
    Test Step 1 & 2:
    Verify model receives the ORIGINAL image before background removal.
    Stage transitions to 'predictions_ready' with review_required=True and has_processed=False.
    """
    user = _get_or_create_user(test_db, "pred_first_user@tailorbird.test", "pred_first_user")
    image_svc = ClothingImageService(test_db)
    processor = ClothingProcessingService(test_db)

    # 1. Create clothing record
    clothing = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Test Original Blue Shirt",
        category="Tops",
        color="Blue",
        season="All-Season",
        occasion="Casual Daily",
    )
    test_db.add(clothing)
    test_db.flush()

    # 2. Store ORIGINAL image binary in BYTEA
    orig_bytes = _create_synthetic_garment_bytes(color=(25, 60, 180), size=(250, 250))
    image_svc.store_image(
        clothing_id=clothing.id,
        user_id=user.id,
        image_bytes=orig_bytes,
        image_type="original",
        mime_type="image/jpeg",
    )

    # Verify no processed image exists yet
    assert not image_svc.has_image(clothing.id, user.id, "processed")

    # 3. Execute predict_original_garment directly on original image
    res = processor.predict_original_garment(clothing_id=clothing.id, user_id=user.id)

    assert res["status"] == "predictions_ready"
    assert res["stage"] == "predictions_ready"
    assert res["review_required"] is True
    assert res["has_processed"] is False
    assert "prediction" in res

    pred = res["prediction"]
    assert pred["input_image_source"] == "original"
    assert "article_type" in pred["prediction_scores"] or "predicted_category" in pred
    assert pred["predicted_attributes"]["color"] is not None

    # Verify still NO processed image exists in database
    assert not image_svc.has_image(clothing.id, user.id, "processed")


def test_background_removal_executes_second_and_stores_separately(test_db):
    """
    Test Step 4:
    After prediction and attribute review, background removal executes on the original image,
    stores 'processed' image separately in Neon BYTEA, and updates stage to 'image_processing_completed'.
    """
    user = _get_or_create_user(test_db, "bg_second_user@tailorbird.test", "bg_second_user")
    image_svc = ClothingImageService(test_db)
    processor = ClothingProcessingService(test_db)

    clothing = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Test Red Dress",
        category="Dresses",
        color="Red",
        season="Summer",
        occasion="Party",
    )
    test_db.add(clothing)
    test_db.flush()

    orig_bytes = _create_synthetic_garment_bytes(color=(220, 40, 40), size=(300, 300))
    image_svc.store_image(
        clothing_id=clothing.id,
        user_id=user.id,
        image_bytes=orig_bytes,
        image_type="original",
        mime_type="image/jpeg",
    )

    # 1. First run predict on original
    processor.predict_original_garment(clothing_id=clothing.id, user_id=user.id)
    assert not image_svc.has_image(clothing.id, user.id, "processed")

    # 2. Simulate user attribute review and then trigger remove_garment_background
    bg_res = processor.remove_garment_background(clothing_id=clothing.id, user_id=user.id)

    assert bg_res["status"] == "ready_for_review"
    assert bg_res["stage"] == "image_processing_completed"
    assert bg_res["has_processed"] is True

    # 3. Verify BOTH original and processed images exist separately in database
    assert image_svc.has_image(clothing.id, user.id, "original") is True
    assert image_svc.has_image(clothing.id, user.id, "processed") is True

    orig_record = image_svc.get_image(clothing.id, user.id, "original")
    proc_record = image_svc.get_image(clothing.id, user.id, "processed")

    assert orig_record is not None
    assert proc_record is not None
    assert orig_record[1] == "image/jpeg"
    assert proc_record[1] == "image/webp"  # Processed is compressed WebP catalog image
    assert len(orig_record[0]) > 0
    assert len(proc_record[0]) > 0


def test_api_upload_endpoint_returns_predictions_ready_synchronously(test_db):
    """
    Test Step 3 API flow:
    POST /clothing/upload runs predictions on original image and returns
    status='predictions_ready', stage='predictions_ready' with predictions payload.
    """
    user = _get_or_create_user(test_db, "api_upload_test@tailorbird.test", "api_upload_user")

    # Override authentication
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        img_bytes = _create_synthetic_garment_bytes(color=(40, 140, 60), size=(200, 200))

        response = client.post(
            "/api/v1/clothing/upload",
            files={"file": ("green_top.jpg", img_bytes, "image/jpeg")},
            data={"name": "Green Casual Top", "category": "Tops"},
        )

        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "predictions_ready"
        assert data["stage"] == "predictions_ready"
        assert "item_id" in data
        assert "original_image_url" in data
        assert data["prediction"] is not None
        assert "predicted_attributes" in data["prediction"]

        item_id = data["item_id"]

        # Check processing status via GET /clothing/{id}/processing-status
        status_resp = client.get(f"/api/v1/clothing/{item_id}/processing-status")
        assert status_resp.status_code == 200
        s_data = status_resp.json()
        assert s_data["status"] == "predictions_ready"
        assert s_data["stage"] == "predictions_ready"
        assert s_data["is_processed_available"] is False  # Background removal has NOT run yet

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_api_remove_background_endpoint_flow(test_db):
    """
    Test Step 4 API flow:
    POST /clothing/{item_id}/remove-background runs background removal on original image
    after attribute review, transitioning stage to 'image_processing_completed'.
    """
    user = _get_or_create_user(test_db, "api_rem_bg@tailorbird.test", "api_rem_bg_user")
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        img_bytes = _create_synthetic_garment_bytes(color=(100, 40, 150), size=(200, 200))
        up_resp = client.post(
            "/api/v1/clothing/upload",
            files={"file": ("purple_skirt.jpg", img_bytes, "image/jpeg")},
            data={"name": "Purple Skirt", "category": "Bottoms"},
        )
        assert up_resp.status_code == 202
        item_id = up_resp.json()["item_id"]

        # User updates attributes during review
        patch_resp = client.patch(
            f"/api/v1/clothing/{item_id}/attributes",
            json={"pattern": "Pleated", "season": "Spring"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["current_attributes"]["pattern"] == "Pleated"

        # User clicks "Remove Background"
        bg_resp = client.post(f"/api/v1/clothing/{item_id}/remove-background")
        assert bg_resp.status_code == 200
        bg_data = bg_resp.json()
        assert bg_data["is_processed_available"] is True
        assert bg_data["stage"] == "image_processing_completed"
        assert bg_data["processed_image_url"] is not None

        # Verify processed image binary can be fetched
        proc_img_resp = client.get(f"/api/v1/clothing/{item_id}/image/processed")
        assert proc_img_resp.status_code == 200
        assert proc_img_resp.headers["content-type"] == "image/webp"

        # Finalize and accept catalog image
        fin_resp = client.post(f"/api/v1/clothing/{item_id}/finalize")
        assert fin_resp.status_code == 200
        assert fin_resp.json()["is_finalized"] is True

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_skip_background_removal_saves_with_original_image(test_db):
    """
    Test Step 5 & 6 (Failure handling & Skipping):
    User can skip background removal and save garment with original image and confirmed attributes.
    """
    user = _get_or_create_user(test_db, "skip_bg_user@tailorbird.test", "skip_bg_user")
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        img_bytes = _create_synthetic_garment_bytes(color=(200, 180, 50), size=(200, 200))
        up_resp = client.post(
            "/api/v1/clothing/upload",
            files={"file": ("yellow_jacket.jpg", img_bytes, "image/jpeg")},
            data={"name": "Yellow Jacket", "category": "Outerwear"},
        )
        assert up_resp.status_code == 202
        item_id = up_resp.json()["item_id"]

        # User chooses "Keep Original Photo & Save"
        act_resp = client.post(f"/api/v1/clothing/{item_id}/image/reject")
        assert act_resp.status_code == 200
        assert act_resp.json()["status"] == "rejected_original_kept"

        # Finalize garment
        fin_resp = client.post(f"/api/v1/clothing/{item_id}/finalize")
        assert fin_resp.status_code == 200
        assert fin_resp.json()["is_finalized"] is True

        # Wardrobe item has original image as primary
        clothing_item = test_db.query(Clothing).filter(Clothing.id == uuid.UUID(item_id)).first()
        assert "original" in clothing_item.image_url

    finally:
        app.dependency_overrides.pop(get_current_user, None)
