import os
import io
import uuid
import base64
import logging
from typing import Optional, Tuple, Dict, Any
from PIL import Image

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "static", "uploads"))
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ImageService:
    """
    Image storage and optimization service.
    Converts uploaded photos into WebP format and generates feed derivatives.
    Guarantees PostgreSQL only stores lightweight URL references, not Base64 blobs.
    """

    @staticmethod
    def _ensure_dir():
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    @classmethod
    def process_and_save(
        cls,
        image_bytes: bytes,
        original_filename: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Validate, resize, convert to WebP, and save derivatives to local storage.
        Returns URL references: { 'image_url': ..., 'thumbnail_url': ... }.
        """
        cls._ensure_dir()

        if len(image_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValueError("File exceeds maximum allowed size of 10MB.")

        try:
            img = Image.open(io.BytesIO(image_bytes))
            img = img.convert("RGB")
        except Exception as e:
            raise ValueError(f"Invalid or corrupted image: {e}")

        asset_id = uuid.uuid4().hex[:12]

        # 1. Main Feed Variant (max 1080w, preserving aspect ratio)
        feed_img = img.copy()
        feed_img.thumbnail((1080, 1440), Image.Resampling.LANCZOS)
        feed_filename = f"{asset_id}_feed.webp"
        feed_path = os.path.join(UPLOAD_DIR, feed_filename)
        feed_img.save(feed_path, "WEBP", quality=85, method=6)

        # 2. Thumbnail Variant (max 360w)
        thumb_img = img.copy()
        thumb_img.thumbnail((360, 480), Image.Resampling.LANCZOS)
        thumb_filename = f"{asset_id}_thumb.webp"
        thumb_path = os.path.join(UPLOAD_DIR, thumb_filename)
        thumb_img.save(thumb_path, "WEBP", quality=80, method=4)

        return {
            "image_url": f"/static/uploads/{feed_filename}",
            "thumbnail_url": f"/static/uploads/{thumb_filename}",
        }

    @classmethod
    def save_from_base64_if_needed(cls, image_url_or_base64: str) -> str:
        """
        If the image string is a Base64 data URI, decode, optimize, and return
        the persistent static URL reference. If already a standard URL, return as-is.
        """
        if not image_url_or_base64 or not image_url_or_base64.startswith("data:image/"):
            return image_url_or_base64

        try:
            header, encoded = image_url_or_base64.split(",", 1)
            image_bytes = base64.b64decode(encoded)
            res = cls.process_and_save(image_bytes)
            logger.info(f"Converted Base64 payload to persistent WebP asset: {res['image_url']}")
            return res["image_url"]
        except Exception as e:
            logger.warning(f"Failed to decode base64 image data ({e}). Storing placeholder fallback.")
            return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80"


image_service = ImageService()

