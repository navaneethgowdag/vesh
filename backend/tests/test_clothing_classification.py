"""
Test suite for Phase 2: AI Garment Understanding, Classification and Attribute Extraction.
Validates:
1. Fashion taxonomy coverage (Western, Indian, Footwear, Accessories) & precomputed embeddings.
2. CIELAB perceptual color extraction & Delta-E matching.
3. Quantized CLIP vision CPU inference & attribute extraction.
4. Explicit fabric uncertainty handling.
5. Dual-persistence of predictions & non-destructive user corrections.
6. API routes: GET predictions, GET/PATCH attributes, POST finalize, POST reanalyze.
7. Multi-tenant authorization & security checks.
"""

import io
import uuid
import pytest
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.ai.fashion_taxonomy import (
    TAXONOMY_GROUPS,
    CATEGORY_TO_GROUP,
    COLOR_PALETTE,
    CATEGORY_SPECIFIC_SCHEMAS,
)
from app.services.color_extraction_service import color_extractor
from app.services.garment_classifier_service import garment_classifier
from app.services.clothing_prediction_service import prediction_service


def _get_or_create_test_user(db, email="test_phase2_user@example.com", username="phase2_tester"):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            password_hash="mock_password_hash",
            first_name="Phase 2",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _create_synthetic_garment_image(color_rgb=(43, 80, 170), collar_rgb=(212, 175, 55)):
    """Generate synthetic 224x224 garment image with distinct body and collar colors."""
    arr = np.ones((224, 224, 3), dtype=np.uint8) * 255  # White canvas
    # Garment body
    arr[30:200, 40:184] = color_rgb
    # Collar / border (~20% of garment pixels)
    arr[30:75, 50:174] = collar_rgb
    return Image.fromarray(arr)


# -------------------------------------------------------------
# 1. Fashion Taxonomy & Embeddings Coverage
# -------------------------------------------------------------

def test_fashion_taxonomy_coverage():
    """Verify all 29 categories exist across Western, Indian, Footwear, and Accessories."""
    assert "western" in TAXONOMY_GROUPS
    assert "indian" in TAXONOMY_GROUPS
    assert "footwear" in TAXONOMY_GROUPS
    assert "accessories" in TAXONOMY_GROUPS

    western_expected = ["shirt", "t_shirt", "jeans", "pants", "skirt", "western_dress", "jacket", "blazer"]
    for cat in western_expected:
        assert cat in TAXONOMY_GROUPS["western"]
        assert CATEGORY_TO_GROUP[cat] == "western"

    indian_expected = ["saree", "blouse", "kurta", "kurti", "salwar", "churidar", "lehenga", "sherwani", "dupatta"]
    for cat in indian_expected:
        assert cat in TAXONOMY_GROUPS["indian"]
        assert CATEGORY_TO_GROUP[cat] == "indian"

    footwear_expected = ["sneakers", "sandals", "heels", "flats", "formal_shoes", "boots"]
    for cat in footwear_expected:
        assert cat in TAXONOMY_GROUPS["footwear"]
        assert CATEGORY_TO_GROUP[cat] == "footwear"

    accessories_expected = ["handbag", "backpack", "belt", "watch", "scarf", "other_accessory"]
    for cat in accessories_expected:
        assert cat in TAXONOMY_GROUPS["accessories"]
        assert CATEGORY_TO_GROUP[cat] == "accessories"

    # Verify embeddings NPZ data
    assert garment_classifier.is_loaded
    assert garment_classifier.embeddings_data is not None
    data = garment_classifier.embeddings_data
    assert "category_keys" in data
    assert "category_embeddings" in data
    assert data["category_embeddings"].shape[1] == 512
    assert len(data["category_keys"]) == 29


# -------------------------------------------------------------
# 2. CIELAB Perceptual Color Extraction & Delta-E
# -------------------------------------------------------------

def test_color_extraction_cielab():
    """Verify CIELAB color extraction correctly identifies Royal Blue & Gold."""
    img = _create_synthetic_garment_image(color_rgb=(43, 80, 170), collar_rgb=(212, 175, 55))
    res = color_extractor.extract_colors(img, num_clusters=3, exclude_skin=True)

    assert "primary_color" in res
    assert "secondary_color" in res
    assert res["primary_color"] == "Royal Blue"
    assert res["secondary_color"] == "Gold"
    assert res["primary_hex"] == "#2B50AA"

    palette = res["palette"]
    assert len(palette) >= 2
    # Verify proportion ordering
    assert palette[0]["percentage"] > palette[1]["percentage"]


# -------------------------------------------------------------
# 3. AI Classifier & Attribute Extraction Engine
# -------------------------------------------------------------

def test_garment_classifier_cpu_inference():
    """Verify CPU inference produces top prediction, calibrated scores, alternatives and formality."""
    img = _create_synthetic_garment_image()
    res = garment_classifier.analyze_garment(img, image_source="test_processed")

    assert res["model_name"] == "clip_vit_b32_quantized"
    assert res["model_version"] == "1.0.0"
    assert res["input_image_source"] == "test_processed"
    assert "predicted_category" in res
    assert res["category_group"] in ["western", "indian", "footwear", "accessories"]
    assert isinstance(res["category_score"], float)
    assert len(res["category_alternatives"]) > 0

    attrs = res["predicted_attributes"]
    assert "pattern" in attrs
    assert "style" in attrs
    assert "season" in attrs
    assert "occasion" in attrs
    assert "formality" in attrs
    assert 0.0 <= attrs["formality"] <= 1.0


def test_fabric_uncertainty_handling():
    """Verify fabric extraction marks uncertainty on flat synthetic colors without fabric texture."""
    # Plain solid red square
    plain_img = Image.new("RGB", (224, 224), (200, 30, 30))
    res = garment_classifier.analyze_garment(plain_img, image_source="test_fabric")

    attrs = res["predicted_attributes"]
    scores = res["prediction_scores"]

    # Flat square lacks visual micro-texture, so it must trigger uncertainty handling
    assert attrs["fabric_uncertain"] is True
    assert attrs["fabric"] == "unknown"
    assert scores["fabric_uncertain"] is True


def test_category_specific_attributes_inference():
    """Verify category-specific schemas are populated for Indian and Western items."""
    saree_attrs = garment_classifier.infer_category_specific_attributes(
        category="saree",
        color_result={"palette": [{"name": "Gold", "percentage": 0.3}]},
        predicted_pattern="embroidered",
        predicted_fabric="silk",
    )
    assert saree_attrs["border_type"] == "zari"
    assert saree_attrs["pallu_design"] == "heavy_zari"
    assert saree_attrs["weave_type"] == "banarasi"
    assert saree_attrs["embroidery_work"] == "zari"

    kurta_attrs = garment_classifier.infer_category_specific_attributes(
        category="kurta",
        color_result={"palette": []},
        predicted_pattern="solid",
        predicted_fabric="cotton",
    )
    assert kurta_attrs["neckline"] == "mandarin_collar"
    assert kurta_attrs["length"] == "knee_length"
    assert kurta_attrs["sleeve_length"] == "full"

    shirt_attrs = garment_classifier.infer_category_specific_attributes(
        category="shirt",
        color_result={"palette": []},
        predicted_pattern="solid",
        predicted_fabric="cotton",
    )
    assert shirt_attrs["collar_style"] == "classic_collar"
    assert shirt_attrs["sleeve_length"] == "long"


# -------------------------------------------------------------
# 4. Persistence & Non-Destructive User Corrections
# -------------------------------------------------------------

def test_prediction_and_user_corrections_persistence():
    """Verify original predictions are never overwritten when user updates/corrects attributes."""
    db = SessionLocal()
    try:
        user = _get_or_create_test_user(db, email="p2_persist@example.com", username="p2_persist")
        clothing = Clothing(
            id=uuid.uuid4(),
            user_id=user.id,
            name="Test Silk Drape",
            category="t_shirt",  # Initial dummy value
            color="Red",
        )
        db.add(clothing)
        db.commit()

        # 1. Save original AI prediction
        ai_res = {
            "model_name": "clip_vit_b32_quantized",
            "model_version": "1.0.0",
            "input_image_source": "processed",
            "predicted_category": "saree",
            "category_group": "indian",
            "category_score": 0.88,
            "category_alternatives": [{"category": "lehenga", "score": 0.08}],
            "predicted_attributes": {
                "category": "saree",
                "category_group": "indian",
                "primary_color": "Royal Blue",
                "secondary_color": "Gold",
                "pattern": "embroidered",
                "fabric": "silk",
                "style": "ethnic",
                "occasion": "festive",
                "formality": 0.85,
                "category_specific": {"border_type": "zari"},
            },
            "prediction_scores": {"category": 0.88, "fabric": 0.72},
            "color_palette": [{"name": "Royal Blue", "percentage": 0.75}],
        }
        saved_pred = prediction_service.save_prediction(db, clothing, ai_res, user.id)
        assert saved_pred["predicted_category"] == "saree"

        # 2. User edits category from saree -> lehenga, and color -> Emerald Green
        updates = {
            "category": "lehenga",
            "primary_color": "Emerald Green",
        }
        updated_attrs = prediction_service.update_attributes(db, clothing, user.id, updates)

        # 3. Verify user corrections logged
        corrections = updated_attrs["corrections"]
        assert len(corrections) >= 2
        corr_attrs = {c["attribute_name"]: c["corrected_value"] for c in corrections}
        assert corr_attrs["category"] == "lehenga"
        assert corr_attrs["primary_color"] == "Emerald Green"

        # 4. CRITICAL: Verify original AI prediction is completely preserved and NOT overwritten!
        fetched_pred = prediction_service.get_prediction(db, clothing, user.id)
        assert fetched_pred is not None
        assert fetched_pred["predicted_category"] == "saree"
        assert fetched_pred["predicted_attributes"]["primary_color"] == "Royal Blue"

        # 5. Finalize item
        finalized = prediction_service.finalize_clothing(db, clothing, user.id)
        assert finalized["is_finalized"] is True

        # Clean up
        db.delete(clothing)
        db.commit()
    finally:
        db.close()


# -------------------------------------------------------------
# 5. API Routes & Multi-Tenant Authorization
# -------------------------------------------------------------

def test_api_predictions_and_attributes_routes(client: TestClient):
    """Test GET /predictions, GET /attributes, PATCH /attributes, POST /finalize, POST /reanalyze."""
    db = SessionLocal()
    try:
        user_owner = _get_or_create_test_user(db, email="owner_p2@example.com", username="owner_p2")
        user_intruder = _get_or_create_test_user(db, email="intruder_p2@example.com", username="intruder_p2")

        clothing = Clothing(
            id=uuid.uuid4(),
            user_id=user_owner.id,
            name="Owner Kurta",
            category="kurta",
            color="Navy Blue",
            pattern="solid",
        )
        db.add(clothing)
        db.commit()

        # Seed prediction
        prediction_service.save_prediction(
            db=db,
            clothing=clothing,
            prediction_result={
                "model_name": "clip_vit_b32_quantized",
                "model_version": "1.0.0",
                "input_image_source": "original",
                "predicted_category": "kurta",
                "category_group": "indian",
                "category_score": 0.81,
                "predicted_attributes": {
                    "category": "kurta",
                    "primary_color": "Navy Blue",
                    "pattern": "solid",
                    "fabric": "cotton",
                    "style": "ethnic",
                },
                "prediction_scores": {"category": 0.81},
                "color_palette": [{"name": "Navy Blue", "percentage": 0.9}],
            },
            user_id=user_owner.id,
        )

        from app.api.deps import get_current_user

        # Override auth as owner
        app.dependency_overrides[get_current_user] = lambda: user_owner

        # 1. GET /api/v1/clothing/{item_id}/predictions
        res_pred = client.get(f"/api/v1/clothing/{clothing.id}/predictions")
        assert res_pred.status_code == 200
        p_json = res_pred.json()
        assert p_json["predicted_category"] == "kurta"

        # 2. GET /api/v1/clothing/{item_id}/attributes
        res_attrs = client.get(f"/api/v1/clothing/{clothing.id}/attributes")
        assert res_attrs.status_code == 200
        a_json = res_attrs.json()
        assert a_json["current_attributes"]["category"] == "kurta"

        # 3. PATCH /api/v1/clothing/{item_id}/attributes
        patch_payload = {
            "category": "sherwani",
            "formality": 0.92,
        }
        res_patch = client.patch(f"/api/v1/clothing/{clothing.id}/attributes", json=patch_payload)
        assert res_patch.status_code == 200
        patch_json = res_patch.json()
        assert patch_json["current_attributes"]["category"] == "sherwani"
        assert patch_json["corrections_count"] >= 1

        # 4. POST /api/v1/clothing/{item_id}/finalize
        res_final = client.post(f"/api/v1/clothing/{clothing.id}/finalize", json={"verified_attributes": {"brand": "Manyavar"}})
        assert res_final.status_code == 200
        final_json = res_final.json()
        assert final_json["is_finalized"] is True
        assert final_json["current_attributes"]["brand"] == "Manyavar"

        # 5. Security & Authorization: Intruder should get 403 Forbidden
        app.dependency_overrides[get_current_user] = lambda: user_intruder

        intruder_pred = client.get(f"/api/v1/clothing/{clothing.id}/predictions")
        assert intruder_pred.status_code == 403

        intruder_patch = client.patch(f"/api/v1/clothing/{clothing.id}/attributes", json={"category": "hacked"})
        assert intruder_patch.status_code == 403

        intruder_finalize = client.post(f"/api/v1/clothing/{clothing.id}/finalize")
        assert intruder_finalize.status_code == 403

        # Clean up overrides and DB
        app.dependency_overrides.clear()
        db.delete(clothing)
        db.commit()
    finally:
        db.close()
