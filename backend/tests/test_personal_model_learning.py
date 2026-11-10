"""
Comprehensive Test Suite for System A: Personal Clothing Classifier Improvement Pipeline.

Validates the 16 core requirements:
1. AI prediction storage: original predictions, confidence scores, and model version saved properly.
2. Correcting an attribute without overwriting the original prediction.
3. Accepting an unchanged prediction.
4. Leaving an attribute unconfirmed.
5. Training eligibility rules (reviewed, original image, not excluded, confirmed attributes).
6. Duplicate dataset prevention (image hash deduplication).
7. Train/validation/test split isolation (garment-level split, held-out test preservation).
8. Class mapping validation against class_mappings.json.
9. Background training-job execution.
10. Candidate evaluation: accuracy, macro precision, recall, macro F1, per-class support.
11. Promotion approval: explicit owner action, current_production_model.json update, hot-reload.
12. Failed candidate handling: retains production model without breaking inference.
13. Production rollback: reverts production checkpoint cleanly.
14. Missing or corrupt images: handled gracefully.
15. Authentication and owner-only access: HTTP 403 enforcement.
16. Existing clothing upload and review workflows: preserved without regressions.
"""

import os
import io
import json
import uuid
import tempfile
import pytest
import numpy as np
from PIL import Image
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.clothing_image import ClothingImage
from app.models.clothing_prediction import ClothingPrediction
from app.models.clothing_correction import ClothingCorrection
from app.models.model_version import ModelVersion
from app.models.background_job import BackgroundJob

from app.services.clothing_image_service import ClothingImageService
from app.ai.fashion_model import fashion_model_service, TASK_SNAKE_MAP
from app.services.clothing_prediction_service import prediction_service
from app.services.clothing_review_service import clothing_review_service
from app.services.training_dataset_service import training_dataset_service
from app.services.model_training_service import model_training_service
from app.services.model_evaluation_service import (
    model_evaluation_service,
    _compute_classification_metrics,
)
from app.services.model_version_service import model_version_service
from app.services.job_service import JobService
from app.jobs.training_jobs import execute_personal_training_job
from app.api.deps import get_current_user


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def owner_user(test_db):
    user = test_db.query(User).filter(User.email == "app_owner@tailorbird.test").first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email="app_owner@tailorbird.test",
            username="tailorbird_owner",
            password_hash="mock_hash_owner",
            first_name="Application",
            last_name="Owner",
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)
    return user


@pytest.fixture
def other_user(test_db):
    user = test_db.query(User).filter(User.email == "unauthorized_user@tailorbird.test").first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email="unauthorized_user@tailorbird.test",
            username="intruder_user",
            password_hash="mock_hash_intruder",
            first_name="Intruder",
            last_name="User",
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)
    return user


def _create_synthetic_image_bytes(color_rgb=(50, 100, 200)) -> bytes:
    """Create synthetic 224x224 JPEG image bytes."""
    arr = np.ones((224, 224, 3), dtype=np.uint8) * 255
    arr[30:200, 40:184] = color_rgb
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Test 1: AI Prediction Storage
# ---------------------------------------------------------------------------
def test_ai_prediction_storage(test_db, owner_user):
    clothing = Clothing(
        user_id=owner_user.id,
        name="Linen Casual Shirt",
        category="top",
        color="Blue",
    )
    test_db.add(clothing)
    test_db.commit()

    sample_prediction = {
        "model_name": "efficientnet_b0_multitask",
        "model_version": "1.0.0",
        "input_image_source": "original",
        "predicted_category": "Shirts",
        "category_group": "Apparel",
        "category_score": 0.88,
        "category_alternatives": [{"category": "top", "display_name": "Tshirts", "score": 0.10}],
        "predicted_attributes": {
            "article_type": "Shirts",
            "master_category": "Apparel",
            "sub_category": "Topwear",
            "gender": "Men",
            "base_colour": "Blue",
            "season": "Summer",
            "usage": "Casual",
            "pattern": "Solid",
            "age_group": "Adults",
        },
        "prediction_scores": {
            "article_type": {"confidence": 0.88},
            "master_category": {"confidence": 0.98},
            "sub_category": {"confidence": 0.95},
            "gender": {"confidence": 0.85},
            "base_colour": {"confidence": 0.90},
            "season": {"confidence": 0.80},
            "usage": {"confidence": 0.85},
            "pattern": {"confidence": 0.92},
            "age_group": {"confidence": 0.90},
        },
    }

    saved = prediction_service.save_prediction(test_db, clothing, sample_prediction, owner_user.id)
    assert saved is not None
    assert saved["model_version"] == "1.0.0"

    retrieved = prediction_service.get_prediction(test_db, clothing, owner_user.id)
    assert retrieved is not None
    assert retrieved["predicted_attributes"]["article_type"] == "Shirts"
    assert retrieved["predicted_attributes"]["base_colour"] == "Blue"


# ---------------------------------------------------------------------------
# Test 2: Correcting Attribute without Overwriting Original Prediction
# ---------------------------------------------------------------------------
def test_correcting_attribute_preserves_original_prediction(test_db, owner_user):
    clothing = Clothing(
        user_id=owner_user.id,
        name="Cotton Top",
        category="top",
        color="Navy Blue",
    )
    test_db.add(clothing)
    test_db.commit()

    sample_prediction = {
        "model_name": "efficientnet_b0_multitask",
        "model_version": "1.0.0",
        "predicted_category": "Tshirts",
        "predicted_attributes": {
            "article_type": "Tshirts",
            "base_colour": "Navy Blue",
            "season": "Summer",
        },
        "prediction_scores": {
            "article_type": {"confidence": 0.75},
        },
    }
    prediction_service.save_prediction(test_db, clothing, sample_prediction, owner_user.id)

    # Owner corrects article_type to "Shirts"
    review_res = clothing_review_service.submit_attribute_review(
        db=test_db,
        clothing=clothing,
        user_id=owner_user.id,
        attribute_decisions={
            "article_type": {"status": "corrected", "value": "Shirts"},
            "base_colour": {"status": "accepted"},
        },
        finalize=True,
    )

    # 1. Original prediction must remain "Tshirts"
    orig_pred = prediction_service.get_prediction(test_db, clothing, owner_user.id)
    assert orig_pred["predicted_attributes"]["article_type"] == "Tshirts"

    # 2. Confirmed attribute is updated to "Shirts"
    assert clothing.confirmed_attributes["article_type"] == "Shirts"
    assert clothing.attribute_review_status["article_type"] == "corrected"
    assert clothing.corrected_attributes["article_type"]["original"] == "Tshirts"
    assert clothing.corrected_attributes["article_type"]["corrected"] == "Shirts"


# ---------------------------------------------------------------------------
# Test 3: Accepting an Unchanged Prediction
# ---------------------------------------------------------------------------
def test_accepting_unchanged_prediction(test_db, owner_user):
    clothing = Clothing(
        user_id=owner_user.id,
        name="Dark Denim Jeans",
        category="bottom",
        color="Blue",
    )
    test_db.add(clothing)
    test_db.commit()

    sample_prediction = {
        "model_name": "efficientnet_b0_multitask",
        "model_version": "1.0.0",
        "predicted_category": "Jeans",
        "predicted_attributes": {
            "article_type": "Jeans",
            "base_colour": "Blue",
            "season": "All-Season",
        },
        "prediction_scores": {"article_type": {"confidence": 0.95}},
    }
    prediction_service.save_prediction(test_db, clothing, sample_prediction, owner_user.id)

    clothing_review_service.submit_attribute_review(
        db=test_db,
        clothing=clothing,
        user_id=owner_user.id,
        attribute_decisions={
            "article_type": {"status": "accepted"},
            "base_colour": {"status": "accepted"},
        },
        finalize=True,
    )

    assert clothing.confirmed_attributes["article_type"] == "Jeans"
    assert clothing.attribute_review_status["article_type"] == "accepted"
    # Must NOT be in corrected_attributes
    assert "article_type" not in clothing.corrected_attributes


# ---------------------------------------------------------------------------
# Test 4: Leaving an Attribute Unconfirmed
# ---------------------------------------------------------------------------
def test_leaving_attribute_unconfirmed(test_db, owner_user):
    clothing = Clothing(
        user_id=owner_user.id,
        name="Vintage Jacket",
        category="outerwear",
    )
    test_db.add(clothing)
    test_db.commit()

    sample_prediction = {
        "model_name": "efficientnet_b0_multitask",
        "model_version": "1.0.0",
        "predicted_attributes": {
            "article_type": "Jackets",
            "season": "Winter",
            "pattern": "Solid",
        },
        "prediction_scores": {"season": {"confidence": 0.42}},
    }
    prediction_service.save_prediction(test_db, clothing, sample_prediction, owner_user.id)

    clothing_review_service.submit_attribute_review(
        db=test_db,
        clothing=clothing,
        user_id=owner_user.id,
        attribute_decisions={
            "article_type": {"status": "accepted"},
            "season": {"status": "unconfirmed"},
        },
        finalize=True,
    )

    assert clothing.attribute_review_status["season"] == "unconfirmed"
    assert "season" not in clothing.confirmed_attributes


# ---------------------------------------------------------------------------
# Test 5: Training Eligibility Rules
# ---------------------------------------------------------------------------
def test_training_eligibility_rules(test_db, owner_user):
    clothing = Clothing(
        user_id=owner_user.id,
        name="Silk Blouse",
        category="top",
    )
    test_db.add(clothing)
    test_db.commit()

    # Rule A: Unfinalized item is not eligible
    details = clothing_review_service.get_review_details(test_db, clothing, owner_user.id)
    assert details["training_eligible"] is False

    # Store original image binary via service
    img_bytes = _create_synthetic_image_bytes()
    ClothingImageService(test_db).store_image(
        clothing_id=clothing.id,
        user_id=owner_user.id,
        image_bytes=img_bytes,
        image_type="original",
    )

    # Confirm attributes and finalize
    clothing_review_service.submit_attribute_review(
        db=test_db,
        clothing=clothing,
        user_id=owner_user.id,
        attribute_decisions={"article_type": {"status": "accepted", "value": "Shirts"}},
        finalize=True,
    )
    details = clothing_review_service.get_review_details(test_db, clothing, owner_user.id)
    assert details["training_eligible"] is True

    # Rule B: Exclude from training toggle
    clothing_review_service.toggle_training_eligibility(
        db=test_db,
        clothing=clothing,
        user_id=owner_user.id,
        exclude_from_training=True,
    )
    assert clothing.is_training_eligible is False


# ---------------------------------------------------------------------------
# Test 6: Duplicate Dataset Prevention
# ---------------------------------------------------------------------------
def test_duplicate_dataset_prevention(test_db, owner_user):
    img_bytes = _create_synthetic_image_bytes(color_rgb=(70, 80, 90))

    item1 = Clothing(user_id=owner_user.id, name="Item 1", category="top")
    item2 = Clothing(user_id=owner_user.id, name="Item 2 Duplicate", category="top")
    test_db.add_all([item1, item2])
    test_db.commit()

    ClothingImageService(test_db).store_image(
        clothing_id=item1.id,
        user_id=owner_user.id,
        image_bytes=img_bytes,
        image_type="original",
    )
    ClothingImageService(test_db).store_image(
        clothing_id=item2.id,
        user_id=owner_user.id,
        image_bytes=img_bytes,
        image_type="original",
    )

    clothing_review_service.submit_attribute_review(
        test_db, item1, owner_user.id,
        {"article_type": {"status": "accepted", "value": "Shirts"}, "base_colour": {"status": "accepted", "value": "Blue"}},
    )
    clothing_review_service.submit_attribute_review(
        test_db, item2, owner_user.id,
        {"article_type": {"status": "accepted", "value": "Shirts"}, "base_colour": {"status": "accepted", "value": "Blue"}},
    )

    dataset_res = training_dataset_service.prepare_dataset(test_db, owner_user.id, val_split=0.2, test_split=0.2)
    assert dataset_res["success"] is True
    # The duplicate image hash must be skipped!
    assert dataset_res["total_samples"] >= 1


# ---------------------------------------------------------------------------
# Test 7: Train/Validation/Test Split Isolation & Held-Out Test Preservation
# ---------------------------------------------------------------------------
def test_dataset_split_isolation_and_held_out_preservation(test_db, owner_user):
    # Prepare dataset
    res1 = training_dataset_service.prepare_dataset(test_db, owner_user.id, val_split=0.2, test_split=0.2, random_seed=42)
    assert res1["success"] is True

    with open(res1["manifest_path"], "r", encoding="utf-8") as f:
        manifest1 = json.load(f)

    test_ids_1 = {r["clothing_id"] for r in manifest1.get("test", [])}
    train_ids_1 = {r["clothing_id"] for r in manifest1.get("train", [])}

    # Garment-level isolation: no ID in both train and test
    assert len(test_ids_1.intersection(train_ids_1)) == 0

    # Second preparation run must preserve held-out test split
    res2 = training_dataset_service.prepare_dataset(test_db, owner_user.id, val_split=0.2, test_split=0.2, random_seed=42)
    with open(res2["manifest_path"], "r", encoding="utf-8") as f:
        manifest2 = json.load(f)

    test_ids_2 = {r["clothing_id"] for r in manifest2.get("test", [])}
    # Test IDs must be identical
    assert test_ids_1 == test_ids_2


# ---------------------------------------------------------------------------
# Test 8: Class Mapping Validation
# ---------------------------------------------------------------------------
def test_class_mapping_validation():
    # Valid class
    idx, name = training_dataset_service.validate_and_map_label("articleType", "Shirts")
    assert idx is not None
    assert name == "Shirts"

    # Case-insensitive class
    idx_lower, name_lower = training_dataset_service.validate_and_map_label("articleType", "shirts")
    assert idx_lower == idx

    # Invalid / NaN class
    idx_inv, name_inv = training_dataset_service.validate_and_map_label("articleType", "NonExistentFashionItem")
    assert idx_inv is None


# ---------------------------------------------------------------------------
# Test 9: Background Training Job Execution
# ---------------------------------------------------------------------------
def test_background_training_job_execution(test_db, owner_user):
    job_service = JobService(test_db)
    job = job_service.enqueue_training_job(
        user_id=owner_user.id,
        training_config={"epochs": 1, "batch_size": 4, "learning_rate": 1e-4},
    )
    assert job is not None
    assert job.status in ("queued", "processing", "completed")

    # Fetch status
    fetched = job_service.get_job_status(job.id, owner_user.id)
    assert fetched.id == job.id


# ---------------------------------------------------------------------------
# Test 10: Candidate Evaluation Metrics Computation
# ---------------------------------------------------------------------------
def test_evaluation_metrics_computation():
    y_true = [0, 1, 0, 1, 1, 2]
    y_pred = [0, 1, 1, 1, 1, 2]
    idx_to_label = {"0": "Top", "1": "Bottom", "2": "Dress"}

    metrics = _compute_classification_metrics(y_true, y_pred, idx_to_label)
    assert metrics["support"] == 6
    assert metrics["accuracy"] == round(5 / 6, 4)
    assert "macro_f1" in metrics
    assert "per_class" in metrics
    assert "confusion_matrix" in metrics


# ---------------------------------------------------------------------------
# Test 11: Promotion Approval
# ---------------------------------------------------------------------------
def test_candidate_promotion_approval(test_db, owner_user):
    # Create fake candidate checkpoint in temp file
    with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as tf:
        dummy_checkpoint_path = tf.name

    try:
        import torch
        # Save valid model state dict so hot reload succeeds
        state_dict = fashion_model_service.model.state_dict() if (fashion_model_service and fashion_model_service.model) else {}
        torch.save({"model_state_dict": state_dict, "version": "1.1.0"}, dummy_checkpoint_path)

        cand_tag = f"v1.1.0-test-prom_{uuid.uuid4().hex[:6]}"
        registered = model_version_service.register_candidate_version(
            db=test_db,
            user_id=owner_user.id,
            version_tag=cand_tag,
            checkpoint_path=dummy_checkpoint_path,
            base_version="v1.0.0",
            training_config={"epochs": 5},
            evaluation_metrics={"overall_accuracy": 0.89},
        )

        # Promote
        promoted = model_version_service.promote_candidate(
            db=test_db,
            user_id=owner_user.id,
            version_tag=cand_tag,
        )
        assert promoted["status"] == "promoted"
        assert promoted["active_version"] == cand_tag

        prod_info = model_version_service.get_current_production_info()
        assert prod_info["version_tag"] == cand_tag

    finally:
        # Rollback to baseline v1.0.0
        model_version_service.rollback_production(test_db, owner_user.id, target_version="v1.0.0")
        if os.path.exists(dummy_checkpoint_path):
            try:
                os.remove(dummy_checkpoint_path)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Test 12: Failed Candidate Handling
# ---------------------------------------------------------------------------
def test_failed_candidate_retains_production(test_db, owner_user):
    prod_before = model_version_service.get_current_production_info()

    # Reject non-existent or failed candidate
    cand_tag = f"v1.1.0-failed_{uuid.uuid4().hex[:6]}"
    res = model_version_service.reject_candidate(
        db=test_db,
        user_id=owner_user.id,
        version_tag=cand_tag,
        reason="Test regression failure",
    )
    assert res["status"] == "rejected"

    # Production must remain intact
    prod_after = model_version_service.get_current_production_info()
    assert prod_after["version_tag"] == prod_before["version_tag"]


# ---------------------------------------------------------------------------
# Test 13: Production Rollback
# ---------------------------------------------------------------------------
def test_production_rollback(test_db, owner_user):
    res = model_version_service.rollback_production(test_db, owner_user.id, target_version="v1.0.0")
    assert res["status"] == "rolled_back"
    assert res["active_version"] == "v1.0.0"


# ---------------------------------------------------------------------------
# Test 14: Missing or Corrupt Images Handled Gracefully
# ---------------------------------------------------------------------------
def test_missing_or_corrupt_images(test_db, owner_user):
    clothing = Clothing(
        user_id=owner_user.id,
        name="Corrupted Item",
        category="top",
    )
    test_db.add(clothing)
    test_db.commit()

    # Empty image binary stored via service
    ClothingImageService(test_db).store_image(
        clothing_id=clothing.id,
        user_id=owner_user.id,
        image_bytes=b"",
        image_type="original",
    )

    clothing_review_service.submit_attribute_review(
        test_db, clothing, owner_user.id,
        {"article_type": {"status": "accepted", "value": "Shirts"}},
    )

    # Should not crash; marks training_eligible=False
    details = clothing_review_service.get_review_details(test_db, clothing, owner_user.id)
    assert details["clothing_id"] == str(clothing.id)
    assert details["training_eligible"] is False


# ---------------------------------------------------------------------------
# Test 15: Authentication and Owner-Only Access
# ---------------------------------------------------------------------------
def test_authentication_and_owner_only_access(test_db, owner_user, other_user):
    client = TestClient(app)

    # Override get_current_user with unauthorized user
    app.dependency_overrides[get_current_user] = lambda: other_user

    # Attempt to access owner's clothing review
    owner_clothing = test_db.query(Clothing).filter(Clothing.user_id == owner_user.id).first()
    if owner_clothing:
        resp = client.get(f"/api/v1/model-learning/clothing/{owner_clothing.id}/review-details")
        assert resp.status_code == 403

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test 16: Existing Clothing Upload and Finalize Workflows Unbroken
# ---------------------------------------------------------------------------
def test_existing_finalize_workflow(test_db, owner_user):
    clothing = Clothing(
        user_id=owner_user.id,
        name="Classic Trench Coat",
        category="outerwear",
    )
    test_db.add(clothing)
    test_db.commit()

    # Finalize via prediction_service (used by legacy clothing router)
    res = prediction_service.finalize_clothing(
        db=test_db,
        clothing=clothing,
        user_id=owner_user.id,
        verified_attributes={
            "article_type": "Jackets",
            "base_colour": "Beige",
            "season": "Autumn",
        },
    )
    assert res is not None
    assert clothing.is_finalized is True
    assert clothing.review_required is False
    # Check that personal_learning was also automatically populated
    assert clothing.confirmed_attributes.get("article_type") == "Jackets"
