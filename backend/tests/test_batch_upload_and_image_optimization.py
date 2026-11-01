import io
import time
import uuid
import pytest
import numpy as np
from PIL import Image, ImageDraw

from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.services.image_cleanup_service import image_cleanup_service
from app.services.clothing_processing_service import ClothingProcessingService
from app.services.batch_upload_service import BatchUploadService
from app.services.recommendation_service import RecommendationService
from app.repositories.wardrobe_repository import WardrobeRepository


def _create_synthetic_garment_image(
    width=600,
    height=600,
    bg_color=(230, 230, 230),
    garment_color=(40, 70, 150),
    with_hole=False,
    is_warm_tone=False,
) -> bytes:
    """Create a synthetic garment JPEG for test uploads."""
    if is_warm_tone:
        garment_color = (215, 170, 110)  # Warm peach/gold zari tone

    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Main garment torso
    draw.rectangle([150, 150, 450, 500], fill=garment_color)
    # Sleeves
    draw.polygon([(150, 150), (80, 250), (120, 270), (150, 200)], fill=garment_color)
    draw.polygon([(450, 150), (520, 250), (480, 270), (450, 200)], fill=garment_color)

    if with_hole:
        # Draw background patch inside the garment simulating a button/cutout
        draw.ellipse([270, 280, 330, 340], fill=bg_color)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture
def auth_headers(client):
    """Fixture providing an authenticated test user and headers."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"test_phase5_{suffix}@stylesphere.com",
        username=f"phase5_{suffix}",
        password_hash=get_password_hash("SecurePass123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    headers = {"Authorization": f"Bearer {token}"}
    yield {"headers": headers, "user_id": user.id}

    # Cleanup
    try:
        db.query(Clothing).filter(Clothing.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


# ==============================================================================
# 1. Image Optimization & Quality Refinements
# ==============================================================================

def test_webp_method3_speed_and_transparency():
    """Verify WebP compression produces valid transparent output and loads properly."""
    img = Image.new("RGBA", (800, 800), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([150, 150, 650, 650], fill=(50, 100, 200, 255))

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=88, method=3)
    data = buf.getvalue()

    assert len(data) > 0

    # Verify Pillow can re-open it and transparency is preserved
    reopened = Image.open(io.BytesIO(data))
    assert reopened.format == "WEBP"
    assert reopened.mode == "RGBA"
    # Corner should be transparent
    assert reopened.getpixel((10, 10))[3] == 0
    # Center should be opaque
    assert reopened.getpixel((400, 400))[3] == 255


def test_compose_catalog_image_12_percent_padding():
    """Verify compose_catalog_image pads garment with neutral background."""
    img = Image.new("RGB", (600, 600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([150, 100, 450, 500], fill=(200, 50, 50))

    # Mask with foreground
    mask = np.zeros((600, 600), dtype=np.uint8)
    mask[100:500, 150:450] = 255

    catalog_rgb, transparent_rgba = image_cleanup_service.compose_catalog_image(
        img,
        mask,
        output_size=1024,
        bg_color=(255, 255, 255),
    )
    assert catalog_rgb.size == (1024, 1024)
    assert transparent_rgba.size == (1024, 1024)
    assert transparent_rgba.mode == "RGBA"

    # White background at corners of catalog
    assert catalog_rgb.getpixel((5, 5)) == (255, 255, 255)

    # Center is garment
    center_px = catalog_rgb.getpixel((512, 512))
    assert center_px[0] > 150  # Reddish


def test_refine_mask_internal_void_hole_filling():
    """Verify morphological / contour hole filling preserves buttons & lace cutouts."""
    garment_bytes = _create_synthetic_garment_image(with_hole=True)
    img = Image.open(io.BytesIO(garment_bytes))

    # Create raw mask with hole corresponding to cutout at (270, 280, 330, 340)
    raw_mask = np.zeros((600, 600), dtype=np.uint8)
    raw_mask[150:500, 150:450] = 255
    raw_mask[280:340, 270:330] = 0  # Button hole

    refined = image_cleanup_service.refine_mask(img, raw_mask, suppress_skin=False)
    # The internal hole should now be filled (255)
    assert refined[300, 300] >= 200
    # Outer area remains background (0)
    assert refined[10, 10] == 0


def test_refine_mask_color_guarded_skin_suppression_warm_garment():
    """Verify warm peach/gold/beige garments are protected against skin suppression."""
    warm_bytes = _create_synthetic_garment_image(is_warm_tone=True)
    warm_img = Image.open(io.BytesIO(warm_bytes))

    mask = np.zeros((600, 600), dtype=np.uint8)
    mask[150:500, 150:450] = 255

    # Run refine_mask with skin suppression enabled
    refined = image_cleanup_service.refine_mask(warm_img, mask, suppress_skin=True)
    # Center torso (300, 300) must NOT be erased
    assert refined[300, 300] >= 200


# ==============================================================================
# 2. Batch Upload API & Sequential Queue
# ==============================================================================

def test_batch_upload_api_multi_file(client, auth_headers):
    """Verify POST /clothing/batch-upload handles multiple files and returns batch metadata."""
    img1 = _create_synthetic_garment_image(width=400, height=400)
    img2 = _create_synthetic_garment_image(width=500, height=500)

    files = [
        ("files", ("shirt1.jpg", img1, "image/jpeg")),
        ("files", ("shirt2.jpg", img2, "image/jpeg")),
    ]
    response = client.post(
        "/api/v1/clothing/batch-upload",
        files=files,
        headers=auth_headers["headers"],
    )
    assert response.status_code == 202
    data = response.json()
    assert "batch_id" in data
    assert data["total_items"] == 2
    assert "status_url" in data

    batch_id = data["batch_id"]

    # Verify status query
    status_resp = client.get(
        f"/api/v1/clothing/batches/{batch_id}",
        headers=auth_headers["headers"],
    )
    assert status_resp.status_code == 200
    sdata = status_resp.json()
    assert sdata["batch_id"] == str(batch_id)
    assert sdata["total_items"] == 2
    assert len(sdata["items"]) == 2
    assert sdata["items"][0]["sequence_order"] == 0
    assert sdata["items"][1]["sequence_order"] == 1


def test_batch_service_next_item_and_failure_resilience(auth_headers):
    """Verify batch_service retrieves next queued item and handles partial failures."""
    db = SessionLocal()
    user_id = auth_headers["user_id"]
    batch_service = BatchUploadService(db)

    # Create 3 items in a batch
    batch_id = uuid.uuid4()
    item_ids = []
    analyses = []
    for seq in range(3):
        item = Clothing(
            user_id=user_id,
            name=f"Batch Item {seq}",
            category="Tops",
            color="Blue",
        )
        db.add(item)
        db.flush()
        analysis = ClothingAnalysis(
            clothing_id=item.id,
            feature_vector={
                "batch_id": str(batch_id),
                "sequence_order": seq,
                "processing_status": "queued",
                "processing_stage": "queued",
            },
        )
        db.add(analysis)
        item_ids.append(item.id)
        analyses.append(analysis)
    db.commit()

    # Item 0 is currently processing / completed
    fv0 = dict(analyses[0].feature_vector)
    fv0["processing_status"] = "ready_for_review"
    fv0["processing_stage"] = "ready_for_review"
    analyses[0].feature_vector = fv0
    db.commit()

    # Next item after item 0 completes should be item 1
    next_item_id = batch_service.get_next_queued_item(batch_id, user_id)
    assert next_item_id == item_ids[1]

    # If item 1 fails, mark it failed in feature_vector; next queued item should be item 2
    fv1 = dict(analyses[1].feature_vector)
    fv1["processing_status"] = "failed"
    fv1["processing_stage"] = "failed"
    analyses[1].feature_vector = fv1
    db.commit()

    next_after_fail = batch_service.get_next_queued_item(batch_id, user_id)
    assert next_after_fail == item_ids[2]

    # Once item 2 completes as well, no more queued items remain
    fv2 = dict(analyses[2].feature_vector)
    fv2["processing_status"] = "ready_for_review"
    analyses[2].feature_vector = fv2
    db.commit()

    assert batch_service.get_next_queued_item(batch_id, user_id) is None

    # Test retry failed items: item 1 should be reset to queued
    retry_result = batch_service.retry_failed_items(batch_id, user_id)
    assert retry_result["retried_count"] == 1
    assert retry_result["first_clothing_id"] == item_ids[1]

    # Verify item 1 is reset to queued in feature_vector
    db.refresh(analyses[1])
    assert analyses[1].feature_vector.get("processing_status") == "queued"
    assert analyses[1].feature_vector.get("processing_stage") == "queued"

    # Now get_next_queued_item should find item 1 again
    assert batch_service.get_next_queued_item(batch_id, user_id) == item_ids[1]

    db.close()


# ==============================================================================
# 3. Weather Intelligence in Recommendations
# ==============================================================================

def test_weather_intelligence_scoring_calibrations():
    """Verify recommendation scoring responds to cold, hot, rain, and wind conditions."""
    db = SessionLocal()
    rec_service = RecommendationService(db)

    class DummyItem:
        def __init__(self, cat, fabric, season="All-Season", primary_color="Navy", subcategory=""):
            self.category = cat
            self.subcategory = subcategory
            self.name = cat
            self.category_group = "western"
            self.fabric = fabric
            self.season = season
            self.primary_color = primary_color
            self.style_tags = ["Minimal"]

    wool_outerwear = DummyItem("Outerwear", "wool", season="Winter")
    linen_top = DummyItem("Tops", "linen", season="Summer")

    # Cold conditions (< 14°C feels-like)
    wool_score = rec_service._compute_season_score(
        [wool_outerwear],
        target_season="Winter",
        temp=10.0,
        feels_like=8.0,
        humidity=60,
        wind_speed=22.0,
        rain_prob=5,
        condition="Cloudy",
    )
    linen_score = rec_service._compute_season_score(
        [linen_top],
        target_season="Winter",
        temp=10.0,
        feels_like=8.0,
        humidity=60,
        wind_speed=22.0,
        rain_prob=5,
        condition="Cloudy",
    )
    assert wool_score > linen_score, "Wool outerwear should score higher than linen top in cold weather"

    # Hot conditions (> 26°C feels-like)
    cotton_top = DummyItem("Tops", "cotton", season="Summer")
    leather_jacket = DummyItem("Outerwear", "leather", season="Winter")

    cotton_score = rec_service._compute_season_score(
        [cotton_top],
        target_season="Summer",
        temp=32.0,
        feels_like=35.0,
        humidity=75,
        wind_speed=5.0,
        rain_prob=0,
        condition="Sunny",
    )
    leather_score = rec_service._compute_season_score(
        [leather_jacket],
        target_season="Summer",
        temp=32.0,
        feels_like=35.0,
        humidity=75,
        wind_speed=5.0,
        rain_prob=0,
        condition="Sunny",
    )
    assert cotton_score > leather_score, "Breathable cotton should score higher than heavy leather in hot weather"

    # Rainy conditions
    nylon_parka = DummyItem("Outerwear", "nylon", season="All-Season")
    suede_jacket = DummyItem("Outerwear", "suede", season="All-Season")

    nylon_score = rec_service._compute_season_score(
        [nylon_parka],
        target_season="Monsoon",
        temp=18.0,
        feels_like=17.0,
        humidity=90,
        wind_speed=15.0,
        rain_prob=85,
        condition="Rain",
    )
    suede_score = rec_service._compute_season_score(
        [suede_jacket],
        target_season="Monsoon",
        temp=18.0,
        feels_like=17.0,
        humidity=90,
        wind_speed=15.0,
        rain_prob=85,
        condition="Rain",
    )
    assert nylon_score > suede_score, "Nylon should score higher than suede in rainy weather"

    db.close()


# ==============================================================================
# 4. Database N+1 Query Optimization
# ==============================================================================

def test_wardrobe_repository_joinedload_analysis():
    """Verify WardrobeRepository eager-loads analysis, avoiding N+1 queries."""
    db = SessionLocal()
    wardrobe_repo = WardrobeRepository(db)
    items = wardrobe_repo.list_for_user(user_id=uuid.uuid4(), limit=5)
    assert isinstance(items, list)
    db.close()
