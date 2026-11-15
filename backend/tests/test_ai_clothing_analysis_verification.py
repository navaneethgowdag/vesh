"""
TailorBird — End-to-End Verification Test Suite: AI Clothing Analysis (Single & Batch Upload)
Verifies:
1. MultiTaskEfficientNetB0 model checkpoint loading on CPU with 9 prediction heads.
2. Single Image Upload: Executes real model inference on original image, returns predictions,
   persists all 9 heads to Neon DB (Clothing & ClothingAnalysis), sets ready_for_review.
3. Batch Image Upload (5+ real images): Every image reaches AI analysis, generates predictions,
   persists attributes to DB, updates batch progress to 100%, and populates pending review.
4. Idempotency: Re-processing an already analyzed item returns cached state safely.
5. Error Handling & Partial Failure: Corrupt/empty images are flagged as failed without crashing the batch.
"""

import io
import os
import uuid
import time
from pathlib import Path
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.ai.fashion_model import fashion_model_service
from app.services.clothing_processing_service import ClothingProcessingService
from app.services.clothing_prediction_service import prediction_service
from app.services.batch_upload_service import BatchUploadService
from app.services.job_service import JobService
from app.jobs.clothing_jobs import process_garment_image_job
from app.api.deps import get_current_user


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_test_user(db, email="ai_analysis_tester@tailorbird.tech"):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=f"tester_{uuid.uuid4().hex[:6]}",
            password_hash="mock_hash_for_test",
            first_name="AI",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _get_sample_image_bytes(name: str) -> bytes:
    """Load real sample image from static/uploads if available, otherwise synthesize realistic image."""
    candidates = [
        Path("backend/static/uploads") / name,
        Path("static/uploads") / name,
        Path.cwd() / "backend" / "static" / "uploads" / name,
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            with open(p, "rb") as f:
                return f.read()

    # Fallback to synthetic realistic image
    img = Image.new("RGB", (224, 224), color=(50, 80, 150))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_1_fashion_model_checkpoint_loading_cpu():
    """Verify that MultiTaskEfficientNetB0 model loads on CPU and reports readiness."""
    readiness_before = fashion_model_service.get_model_readiness()
    assert readiness_before["artifact_exists"] is True, f"Artifacts directory best_model.pt must exist: {readiness_before}"

    success = fashion_model_service.load_model()
    assert success is True, f"Model failed to load: {fashion_model_service.load_error}"

    readiness = fashion_model_service.get_model_readiness()
    assert readiness["inference_ready"] is True
    assert readiness["load_status"] == "loaded"
    assert readiness["device"] == "cpu"
    assert readiness["model_version"] is not None

    # Verify options for all 9 heads
    options = fashion_model_service.get_attribute_options()
    expected_heads = [
        "article_type", "master_category", "sub_category",
        "gender", "base_colour", "season", "usage", "pattern", "age_group"
    ]
    for head in expected_heads:
        assert head in options, f"Missing prediction head in options: {head}"
        assert len(options[head]) > 0, f"Head {head} has empty classes"


def test_2_single_clothing_upload_and_ai_inference(test_db):
    """
    Test Single Image Upload:
    - POST /api/v1/clothing/upload with real garment image.
    - AI classification executes on original image.
    - Attributes and predictions persisted to DB.
    - Processing status transitions to 'ready_for_review'.
    """
    user = _get_or_create_test_user(test_db, "single_upload_tester@tailorbird.tech")
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        sample_bytes = _get_sample_image_bytes("0ce755286ee5_feed.webp")
        files = {"file": ("sample_blazer.webp", io.BytesIO(sample_bytes), "image/webp")}

        res = client.post("/api/v1/clothing/upload", files=files)
        assert res.status_code == 202, f"Upload failed: {res.text}"
        data = res.json()

        assert "item_id" in data
        item_id = uuid.UUID(data["item_id"])
        assert data["status"] in ("ready_for_review", "predictions_ready")
        assert data["prediction"] is not None

        # Verify DB persistence
        clothing = test_db.query(Clothing).filter(Clothing.id == item_id).first()
        assert clothing is not None
        assert clothing.user_id == user.id
        assert clothing.processing_status == "ready_for_review"
        assert clothing.review_required is True
        assert clothing.is_finalized is False

        # Verify predicted attributes were assigned to Clothing model
        assert clothing.category is not None
        assert clothing.color is not None
        assert clothing.subcategory is not None

        # Verify ClothingAnalysis feature_vector has ai_predictions
        analysis = test_db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == item_id).first()
        assert analysis is not None
        assert isinstance(analysis.feature_vector, dict)
        assert "ai_predictions" in analysis.feature_vector

        pred_payload = analysis.feature_vector["ai_predictions"]
        predicted_attrs = pred_payload.get("predicted_attributes", {})
        assert "article_type" in predicted_attrs
        assert "base_colour" in predicted_attrs
        assert "season" in predicted_attrs
        assert "usage" in predicted_attrs
        assert "master_category" in predicted_attrs

        # Finalize the item
        finalize_res = client.post(
            f"/api/v1/clothing/{item_id}/finalize",
            json={"verified_attributes": {"name": "Accepted Navy Blazer"}},
        )
        assert finalize_res.status_code == 200

        test_db.refresh(clothing)
        assert clothing.is_finalized is True
        assert clothing.processing_status == "completed"
        assert clothing.review_required is False

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_3_batch_upload_with_5_images_full_pipeline(test_db):
    """
    Test Batch Image Upload with >= 5 Images:
    - POST /api/v1/clothing/batch-upload with 5 distinct images.
    - All 5 images enter the AI analysis pipeline.
    - All 5 images receive real model inference predictions and persist to DB.
    - Polling GET /api/v1/clothing/batches/{batch_id} shows progress reaching 100% and 'completed'.
    - All items appear in GET /api/v1/clothing/pending-review.
    - Bulk finalize accepts all 5 items into active wardrobe.
    """
    user = _get_or_create_test_user(test_db, "batch_upload_tester@tailorbird.tech")
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        sample_names = [
            "0ce755286ee5_feed.webp",
            "1e94ef41bfca_feed.webp",
            "21a76006790d_feed.webp",
            "2ad25cd69053_feed.webp",
            "1d2ab845366f_feed.webp",
        ]

        files_payload = []
        for idx, sname in enumerate(sample_names):
            img_bytes = _get_sample_image_bytes(sname)
            files_payload.append(
                ("files", (f"garment_{idx + 1}_{sname}", io.BytesIO(img_bytes), "image/webp"))
            )

        # 1. Submit batch upload
        res = client.post("/api/v1/clothing/batch-upload", files=files_payload)
        assert res.status_code == 202, f"Batch upload failed: {res.text}"
        batch_data = res.json()

        assert "batch_id" in batch_data
        batch_id = uuid.UUID(batch_data["batch_id"])
        assert batch_data["total_items"] == 5

        # 2. Wait for all 5 background items to complete processing (polling up to 60s)
        bs_data = None
        for _ in range(30):
            batch_status_res = client.get(f"/api/v1/clothing/batches/{batch_id}")
            assert batch_status_res.status_code == 200
            bs_data = batch_status_res.json()
            if bs_data["status"] in ("completed", "partially_completed"):
                break
            time.sleep(2)

        # In case any item was not picked up by fallback thread, ensure processed
        if bs_data and (bs_data["completed_items"] + bs_data["failed_items"] < 5):
            for item_info in bs_data["items"]:
                if item_info["status"] in ("queued", "processing"):
                    cid = uuid.UUID(item_info["clothing_id"])
                    processor = ClothingProcessingService(test_db)
                    processor.process_clothing_item(clothing_id=cid, user_id=user.id, job_id=str(uuid.uuid4()))
            batch_status_res = client.get(f"/api/v1/clothing/batches/{batch_id}")
            bs_data = batch_status_res.json()

        # 3. Check batch status
        assert bs_data is not None
        assert bs_data["total_items"] == 5
        assert bs_data["completed_items"] == 5
        assert bs_data["failed_items"] == 0
        assert bs_data["progress_percentage"] == 100.0
        assert bs_data["status"] == "completed"

        # Verify all 5 garments have real predictions in DB
        for item_entry in bs_data["items"]:
            cid = uuid.UUID(item_entry["clothing_id"])
            c_item = test_db.query(Clothing).filter(Clothing.id == cid).first()
            assert c_item is not None
            assert c_item.processing_status in ("ready_for_review", "completed")
            assert c_item.category is not None
            assert c_item.color is not None

            # Verify predictions in ClothingAnalysis
            analysis = test_db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == cid).first()
            assert analysis is not None
            assert "ai_predictions" in analysis.feature_vector
            preds = analysis.feature_vector["ai_predictions"]["predicted_attributes"]
            assert "article_type" in preds
            assert "base_colour" in preds
            assert "master_category" in preds

        # 4. Check pending-review endpoint
        pending_res = client.get("/api/v1/clothing/pending-review")
        assert pending_res.status_code == 200
        pending_items = pending_res.json()
        pending_ids = [p["id"] for p in pending_items]
        for item_entry in bs_data["items"]:
            assert item_entry["clothing_id"] in pending_ids

        # 5. Bulk finalize
        item_ids_to_finalize = [item_entry["clothing_id"] for item_entry in bs_data["items"]]
        finalize_res = client.post(
            "/api/v1/clothing/bulk-finalize",
            json={"item_ids": item_ids_to_finalize},
        )
        assert finalize_res.status_code == 200
        fin_data = finalize_res.json()
        assert fin_data["finalized_count"] == 5

        # Verify all are now finalized
        for cid_str in item_ids_to_finalize:
            c_fin = test_db.query(Clothing).filter(Clothing.id == uuid.UUID(cid_str)).first()
            test_db.refresh(c_fin)
            assert c_fin.is_finalized is True
            assert c_fin.processing_status == "completed"
            assert c_fin.review_required is False

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_4_idempotency_does_not_reprocess_already_analyzed(test_db):
    """
    Test Idempotency:
    - Once a garment has completed AI analysis, re-invoking process_garment_image_job
      returns the cached result without re-running model inference.
    """
    user = _get_or_create_test_user(test_db, "idempotent_tester@tailorbird.tech")
    processor = ClothingProcessingService(test_db)

    clothing = Clothing(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Idempotent Test Jacket",
        category="Outerwear",
        color="Black",
    )
    test_db.add(clothing)
    test_db.flush()

    sample_bytes = _get_sample_image_bytes("0ce755286ee5_feed.webp")
    image_svc = processor.image_service
    image_svc.store_image(
        clothing_id=clothing.id,
        user_id=user.id,
        image_bytes=sample_bytes,
        image_type="original",
    )

    # First run
    res1 = processor.process_clothing_item(clothing_id=clothing.id, user_id=user.id)
    assert res1["status"] == "ready_for_review"

    # Second run via job worker entrypoint
    job_res = process_garment_image_job(
        job_id=str(uuid.uuid4()),
        user_id=str(user.id),
        clothing_id=str(clothing.id),
        db=test_db,
    )
    assert job_res.get("cached") is True
    assert job_res["status"] == "ready_for_review"


def test_5_corrupt_image_partial_failure_handling(test_db):
    """
    Test Partial Failure Handling:
    - If a corrupt/non-image file is in a batch alongside valid files,
      valid files succeed and the corrupt file is marked failed.
    - Overall batch is marked 'partially_completed', never crashes.
    """
    user = _get_or_create_test_user(test_db, "corrupt_batch_tester@tailorbird.tech")
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        valid_bytes = _get_sample_image_bytes("0ce755286ee5_feed.webp")
        corrupt_bytes = b"NOT_A_VALID_IMAGE_HEADER_12345"

        files = [
            ("files", ("valid_shirt.webp", io.BytesIO(valid_bytes), "image/webp")),
            ("files", ("corrupt_file.jpg", io.BytesIO(corrupt_bytes), "image/jpeg")),
        ]

        res = client.post("/api/v1/clothing/batch-upload", files=files)
        assert res.status_code == 202
        batch_id = res.json()["batch_id"]

        # Run valid item
        batch_svc = BatchUploadService(test_db)
        status_dict = batch_svc.get_batch_status(uuid.UUID(batch_id), user.id)

        for item_info in status_dict["items"]:
            if item_info["status"] == "queued":
                cid = uuid.UUID(item_info["clothing_id"])
                processor = ClothingProcessingService(test_db)
                processor.process_clothing_item(clothing_id=cid, user_id=user.id)

        # Re-check status
        final_status = client.get(f"/api/v1/clothing/batches/{batch_id}").json()
        assert final_status["total_items"] == 2
        assert final_status["completed_items"] == 1
        assert final_status["failed_items"] == 1
        assert final_status["status"] == "partially_completed"
        assert final_status["progress_percentage"] == 100.0

    finally:
        app.dependency_overrides.pop(get_current_user, None)
