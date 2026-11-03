import io
import uuid
import pytest
from PIL import Image, ImageDraw

from app.models.user import User
from app.models.clothing import Clothing
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.services.clothing_image_service import ClothingImageService


def _create_synthetic_test_image(width=600, height=800, color=(50, 100, 200)) -> bytes:
    """Create a synthetic JPEG image for testing."""
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)
    draw.rectangle([100, 100, 500, 700], fill=(220, 180, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture
def auth_context(client):
    """Authenticated user fixture for thumbnail and performance tests."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"perf_user_{suffix}@stylesphere.com",
        username=f"perf_{suffix}",
        password_hash=get_password_hash("PerfSecret123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    headers = {"Authorization": f"Bearer {token}"}
    yield {"headers": headers, "user_id": user.id, "user": user}

    try:
        db.query(Clothing).filter(Clothing.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_thumbnail_generation_and_bytea_storage():
    """Verify on-demand thumbnail generation and caching directly in ClothingImageService."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"thumb_svc_{suffix}@stylesphere.com",
        username=f"thumb_{suffix}",
        password_hash=get_password_hash("Pass123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    clothing = Clothing(
        user_id=user.id,
        category="Tops",
        name="Thumbnail Unit Test Garment",
    )
    db.add(clothing)
    db.commit()
    db.refresh(clothing)

    img_service = ClothingImageService(db)
    original_bytes = _create_synthetic_test_image(width=900, height=1200)

    # 1. Store original image in BYTEA
    img_service.store_image(
        clothing_id=clothing.id,
        user_id=user.id,
        image_bytes=original_bytes,
        image_type="original",
        mime_type="image/jpeg",
    )

    # Verify original is intact
    orig_res = img_service.get_image(clothing_id=clothing.id, user_id=user.id, image_type="original")
    assert orig_res is not None
    assert orig_res[0] == original_bytes

    # 2. Generate thumbnail on-demand
    thumb_res = img_service.get_or_create_thumbnail(clothing_id=clothing.id, user_id=user.id)
    assert thumb_res is not None
    thumb_bytes, thumb_mime = thumb_res

    assert thumb_mime == "image/webp"
    with Image.open(io.BytesIO(thumb_bytes)) as pil_thumb:
        assert pil_thumb.format == "WEBP"
        assert pil_thumb.width <= 360
        assert pil_thumb.height <= 480

    # 3. Verify original image is STILL intact (Strict Original Preservation)
    orig_res_after = img_service.get_image(clothing_id=clothing.id, user_id=user.id, image_type="original")
    assert orig_res_after is not None
    assert orig_res_after[0] == original_bytes, "Original image in PostgreSQL BYTEA must never be overwritten"

    # Cleanup
    img_service.delete_images_for_clothing(clothing_id=clothing.id, user_id=user.id)
    db.query(Clothing).filter(Clothing.id == clothing.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
    db.close()


def test_thumbnail_api_endpoint_caching_and_etag(client, auth_context):
    """Verify HTTP endpoint GET /api/v1/clothing/{id}/image/thumbnail with ETag and Cache-Control headers."""
    db = SessionLocal()
    user_id = auth_context["user_id"]
    headers = auth_context["headers"]

    clothing = Clothing(
        user_id=user_id,
        category="Outerwear",
        name="Thumbnail Endpoint Test Blazer",
    )
    db.add(clothing)
    db.commit()
    db.refresh(clothing)

    img_service = ClothingImageService(db)
    original_bytes = _create_synthetic_test_image(width=800, height=1000)
    img_service.store_image(
        clothing_id=clothing.id,
        user_id=user_id,
        image_bytes=original_bytes,
        image_type="original",
        mime_type="image/jpeg",
    )

    # First request: generates and caches thumbnail
    resp1 = client.get(f"/api/v1/clothing/{clothing.id}/image/thumbnail", headers=headers)
    assert resp1.status_code == 200
    assert resp1.headers["content-type"] == "image/webp"
    assert "public, max-age=" in resp1.headers["cache-control"]
    assert "etag" in resp1.headers
    etag = resp1.headers["etag"]

    # Second request: served from cached BYTEA with identical ETag
    resp2 = client.get(f"/api/v1/clothing/{clothing.id}/image/thumbnail", headers=headers)
    assert resp2.status_code == 200
    assert resp2.headers["etag"] == etag
    assert len(resp2.content) == len(resp1.content)

    # Cleanup
    img_service.delete_images_for_clothing(clothing_id=clothing.id, user_id=user_id)
    db.query(Clothing).filter(Clothing.id == clothing.id).delete()
    db.commit()
    db.close()

