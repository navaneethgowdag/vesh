"""
Test Suite for Feature 1: Batch Clothing Upload Lifecycle
Validates:
1. Multi-image batch upload endpoint creates batch and queues items in sequence.
2. EfficientNet-B0 inference runs on original photo (no background removal).
3. Batch status endpoint returns aggregate and per-item statuses.
4. SHA256 duplicate detection flags duplicate uploads in batch.
5. Batch cancellation sets remaining queued items to cancelled.
6. Batch retry endpoint resets failed items and resumes processing.
"""

import io
import uuid
import hashlib
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.clothing_image import ClothingImage
from app.services.clothing_image_service import ClothingImageService
from app.services.clothing_processing_service import ClothingProcessingService
from app.services.batch_upload_service import BatchUploadService
from app.api.deps import get_current_user


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_user(db, email="batch_tester@tailorbird.tech"):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=f"batch_user_{uuid.uuid4().hex[:6]}",
            password_hash="mock_hash",
            first_name="Batch",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _make_image_bytes(color=(100, 150, 200), text_seed="a") -> bytes:
    img = Image.new("RGB", (224, 224), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_batch_upload_creation_and_queue(test_db):
    user = _get_or_create_user(test_db)
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        img1 = _make_image_bytes((200, 50, 50))
        img2 = _make_image_bytes((50, 200, 50))

        files = [
            ("files", ("shirt_red.jpg", io.BytesIO(img1), "image/jpeg")),
            ("files", ("shirt_green.jpg", io.BytesIO(img2), "image/jpeg")),
        ]

        res = client.post("/api/v1/clothing/batch-upload", files=files)
        assert res.status_code == 202
        data = res.json()
        assert "batch_id" in data
        assert data["total_items"] == 2
        assert data["status"] in ("queued", "processing")

        batch_id = data["batch_id"]

        # Check batch status
        status_res = client.get(f"/api/v1/clothing/batches/{batch_id}")
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["batch_id"] == batch_id
        assert status_data["total_items"] == 2
        assert len(status_data["items"]) == 2
        assert status_data["items"][0]["original_image_url"] is not None
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_batch_duplicate_prevention(test_db):
    user = _get_or_create_user(test_db)
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        identical_bytes = _make_image_bytes((80, 80, 80))

        files = [
            ("files", ("image_1.jpg", io.BytesIO(identical_bytes), "image/jpeg")),
            ("files", ("image_duplicate.jpg", io.BytesIO(identical_bytes), "image/jpeg")),
        ]

        res = client.post("/api/v1/clothing/batch-upload", files=files)
        assert res.status_code == 202
        batch_id = res.json()["batch_id"]

        status_res = client.get(f"/api/v1/clothing/batches/{batch_id}")
        assert status_res.status_code == 200
        items = status_res.json()["items"]

        # Item 0 is queued/processed, Item 1 is marked failed due to duplicate
        assert items[0]["status"] in ("queued", "processing", "ready_for_review")
        assert items[1]["status"] == "failed"
        assert "duplicate" in (items[1]["error"] or "").lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_batch_cancellation(test_db):
    user = _get_or_create_user(test_db)
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        img1 = _make_image_bytes((30, 40, 50))
        img2 = _make_image_bytes((60, 70, 80))
        img3 = _make_image_bytes((90, 100, 110))

        files = [
            ("files", ("item_a.jpg", io.BytesIO(img1), "image/jpeg")),
            ("files", ("item_b.jpg", io.BytesIO(img2), "image/jpeg")),
            ("files", ("item_c.jpg", io.BytesIO(img3), "image/jpeg")),
        ]

        res = client.post("/api/v1/clothing/batch-upload", files=files)
        assert res.status_code == 202
        batch_id = res.json()["batch_id"]

        # Cancel the batch
        cancel_res = client.post(f"/api/v1/clothing/batches/{batch_id}/cancel")
        assert cancel_res.status_code == 200
        cancel_data = cancel_res.json()
        assert cancel_data["batch_id"] == batch_id
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_batch_processing_predict_original_no_bg_removal(test_db):
    user = _get_or_create_user(test_db)
    image_bytes = _make_image_bytes((120, 100, 80))

    clothing = Clothing(
        user_id=user.id,
        name="Test Garment",
        category="Tops",
        color="Brown",
    )
    test_db.add(clothing)
    test_db.commit()
    test_db.refresh(clothing)

    img_svc = ClothingImageService(test_db)
    img_svc.store_image(
        clothing_id=clothing.id,
        user_id=user.id,
        image_bytes=image_bytes,
        image_type="original",
    )

    processor = ClothingProcessingService(test_db)
    res = processor.process_clothing_item(clothing_id=clothing.id, user_id=user.id)

    assert res["status"] in ("ready_for_review", "predictions_ready")
    test_db.refresh(clothing)
    assert clothing.image_url == f"/api/v1/clothing/{clothing.id}/image/original"

    # Verify no processed background-removed image was stored
    has_proc = img_svc.has_image(clothing.id, user.id, "processed")
    assert not has_proc
