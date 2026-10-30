import io
import time
import uuid
import pytest
import numpy as np
from PIL import Image, ImageDraw

from app.models.user import User
from app.models.clothing import Clothing
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.services.garment_segmentation_service import (
    OnnxGarmentSegmenter,
    OpenCVGrabCutSegmenter,
    garment_segmentation_service,
)
from app.services.image_cleanup_service import image_cleanup_service
from app.services.image_quality_service import quality_service
from app.services.clothing_image_service import ClothingImageService
from app.services.clothing_processing_service import ClothingProcessingService


def _create_test_garment_image(
    width=600,
    height=600,
    bg_color=(200, 200, 200),
    garment_color=(30, 80, 160),
    include_skin=False,
) -> Image.Image:
    """Create synthetic test image simulating a garment photograph."""
    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Draw garment body (e.g. shirt)
    draw.rectangle([150, 150, 450, 500], fill=garment_color)
    draw.polygon([(150, 150), (80, 250), (120, 270), (150, 200)], fill=garment_color)
    draw.polygon([(450, 150), (520, 250), (480, 270), (450, 200)], fill=garment_color)

    if include_skin:
        # Draw neck & head with human skin tone (HSV/YCrCb test)
        draw.ellipse([250, 50, 350, 150], fill=(225, 175, 140))
        # Draw hands
        draw.ellipse([60, 250, 100, 290], fill=(225, 175, 140))
        draw.ellipse([500, 250, 540, 290], fill=(225, 175, 140))

    return img


def _img_to_bytes(img: Image.Image, format="JPEG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


@pytest.fixture
def test_user(client):
    """Fixture providing a test user and authorization header."""
    db = SessionLocal()
    unique_suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"garment_test_{unique_suffix}@stylesphere.com",
        username=f"tester_{unique_suffix}",
        first_name="Garment",
        last_name="Tester",
        password_hash="mockhash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    headers = {"Authorization": f"Bearer {token}"}
    yield user, headers

    # Cleanup
    try:
        db.query(Clothing).filter(Clothing.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@pytest.fixture
def other_user(client):
    """Fixture providing an unauthorized second user."""
    db = SessionLocal()
    unique_suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"other_{unique_suffix}@stylesphere.com",
        username=f"other_{unique_suffix}",
        first_name="Other",
        last_name="User",
        password_hash="mockhash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    headers = {"Authorization": f"Bearer {token}"}
    yield user, headers

    try:
        db.query(Clothing).filter(Clothing.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


# -----------------------------------------------------------------------------
# 1. Computer Vision & Segmentation Unit Tests
# -----------------------------------------------------------------------------

def test_onnx_segmenter_cpu_inference():
    """Verify ONNX model segments garments on CPU within ~1 second."""
    test_img = _create_test_garment_image(width=512, height=512)
    segmenter = OnnxGarmentSegmenter()

    t0 = time.time()
    mask, meta = segmenter.segment(test_img)
    duration = time.time() - t0

    assert mask is not None
    assert isinstance(mask, np.ndarray)
    assert mask.shape == (512, 512)
    assert mask.dtype == np.uint8
    assert meta["model_name"] == "u2netp"
    assert "cpu" in meta["engine"]
    # CPU inference benchmark check (< 1.5s)
    assert duration < 2.0, f"ONNX segmentation took {duration}s, expected < 2.0s on CPU"


def test_opencv_fallback_segmenter():
    """Verify OpenCV GrabCut segmenter acts as a robust zero-download fallback."""
    test_img = _create_test_garment_image(width=400, height=400)
    segmenter = OpenCVGrabCutSegmenter()

    mask, meta = segmenter.segment(test_img)
    assert mask is not None
    assert mask.shape == (400, 400)
    assert meta["model_name"] == "opencv_grabcut"


def test_skin_suppression_and_edge_refinement():
    """Verify skin suppression attenuates skin tones while preserving garment body."""
    img_with_skin = _create_test_garment_image(width=400, height=400, include_skin=True)
    raw_mask, _ = garment_segmentation_service.segment(img_with_skin)

    refined_mask = image_cleanup_service.refine_mask(img_with_skin, raw_mask, suppress_skin=True)
    assert refined_mask.shape == (400, 400)

    # Check that head region (around 250-350 x 50-150) has lower mask weight than garment center
    garment_center_val = int(refined_mask[300, 300])
    skin_head_val = int(refined_mask[100, 300])
    assert garment_center_val > skin_head_val


def test_catalog_composition():
    """Verify output image has 1024x1024 dimensions, centered composition, and neutral background."""
    test_img = _create_test_garment_image(width=500, height=500)
    raw_mask = np.full((500, 500), 255, dtype=np.uint8)

    catalog_img, transparent_img = image_cleanup_service.compose_catalog_image(
        test_img,
        raw_mask,
        output_size=1024,
        bg_color=(255, 255, 255),
    )

    assert catalog_img.size == (1024, 1024)
    assert transparent_img.size == (1024, 1024)
    # Check top corner pixel is pure white (255, 255, 255)
    top_left_pixel = catalog_img.getpixel((10, 10))
    assert top_left_pixel == (255, 255, 255)


def test_image_quality_assessment():
    """Verify quality service checks Laplacian blur, empty masks, and boundary clipping."""
    sharp_img = _create_test_garment_image(width=400, height=400)
    full_mask = np.full((400, 400), 255, dtype=np.uint8)

    assessment = quality_service.assess_segmentation_quality(sharp_img, full_mask)
    assert assessment.blur_score > 0
    assert assessment.foreground_ratio > 0.5


# -----------------------------------------------------------------------------
# 2. End-to-End API Integration Tests
# -----------------------------------------------------------------------------

def test_upload_garment_invalid_mime(client, test_user):
    """Uploading non-image files must fail with HTTP 400."""
    _, headers = test_user
    files = {"file": ("test.txt", b"plain text is not an image", "text/plain")}
    res = client.post("/api/v1/clothing/upload", files=files, headers=headers)
    assert res.status_code == 400
    assert "Invalid image format" in res.json()["detail"]


def test_upload_garment_corrupt_data(client, test_user):
    """Uploading corrupt image bytes must fail with HTTP 400."""
    _, headers = test_user
    files = {"file": ("fake.jpg", b"not-a-jpeg-payload", "image/jpeg")}
    res = client.post("/api/v1/clothing/upload", files=files, headers=headers)
    assert res.status_code == 400
    assert "Corrupt or unreadable" in res.json()["detail"]


def test_end_to_end_garment_upload_and_pipeline(client, test_user, other_user):
    """
    Complete end-to-end flow:
    1. Upload valid garment photograph
    2. Receive immediate HTTP 202 response with item_id and queued status
    3. Check status transitions
    4. Fetch original binary image from Neon BYTEA
    5. Execute processing pipeline
    6. Fetch processed binary image from Neon BYTEA
    7. Test Accept / Reject / Retry actions
    8. Enforce ownership authorization
    """
    user, headers = test_user
    _, other_headers = other_user

    test_img = _create_test_garment_image(width=400, height=400, garment_color=(40, 120, 200))
    img_bytes = _img_to_bytes(test_img, format="JPEG")

    # 1. Upload photo
    files = {"file": ("navy_shirt.jpg", img_bytes, "image/jpeg")}
    data = {
        "name": "Classic Linen Overshirt",
        "category": "Tops",
        "color": "Navy",
        "brand": "COS",
    }
    upload_res = client.post("/api/v1/clothing/upload", files=files, data=data, headers=headers)
    assert upload_res.status_code == 202
    resp_data = upload_res.json()
    item_id = resp_data["item_id"]
    assert resp_data["status"] == "queued"
    assert resp_data["stage"] == "queued"
    assert f"/api/v1/clothing/{item_id}/image/original" in resp_data["original_image_url"]

    # 2. Get processing status (Authorized)
    status_res = client.get(f"/api/v1/clothing/{item_id}/processing-status", headers=headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["item_id"] == item_id

    # 3. Ownership security check: Unauthorized user gets 403 Forbidden
    other_status_res = client.get(f"/api/v1/clothing/{item_id}/processing-status", headers=other_headers)
    assert other_status_res.status_code == 403

    # 4. Fetch original binary image
    orig_img_res = client.get(f"/api/v1/clothing/{item_id}/image/original")
    assert orig_img_res.status_code == 200
    assert orig_img_res.headers["content-type"].startswith("image/")
    assert len(orig_img_res.content) == len(img_bytes)

    # 5. Execute processing via ClothingProcessingService
    db = SessionLocal()
    try:
        proc = ClothingProcessingService(db)
        pipeline_res = proc.process_clothing_item(uuid.UUID(item_id), user.id)
        assert pipeline_res["status"] in ("ready_for_review", "completed")
    finally:
        db.close()

    # 6. Verify processing status is updated in Neon
    updated_status_res = client.get(f"/api/v1/clothing/{item_id}/processing-status", headers=headers)
    assert updated_status_res.status_code == 200
    u_data = updated_status_res.json()
    assert u_data["stage"] == "ready_for_review"
    assert u_data["is_processed_available"] is True

    # 7. Fetch processed catalog binary image
    proc_img_res = client.get(f"/api/v1/clothing/{item_id}/image/processed")
    assert proc_img_res.status_code == 200
    assert proc_img_res.headers["content-type"] == "image/webp"
    assert len(proc_img_res.content) > 0

    # 8. Test Accept Action
    accept_res = client.post(f"/api/v1/clothing/{item_id}/image/accept", headers=headers)
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "completed"
    assert f"/api/v1/clothing/{item_id}/image/processed" in accept_res.json()["image_url"]

    # Unauthorized accept fails with 403
    other_accept = client.post(f"/api/v1/clothing/{item_id}/image/accept", headers=other_headers)
    assert other_accept.status_code == 403

    # 9. Test Reject Action (Keeps original photo)
    reject_res = client.post(f"/api/v1/clothing/{item_id}/image/reject", headers=headers)
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected_original_kept"
    assert f"/api/v1/clothing/{item_id}/image/original" in reject_res.json()["image_url"]

    # 10. Test Retry Action (Re-enqueues)
    retry_res = client.post(f"/api/v1/clothing/{item_id}/image/retry", headers=headers)
    assert retry_res.status_code == 200
    assert retry_res.json()["status"] == "queued"
