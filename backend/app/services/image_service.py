import os
import io
import uuid
import base64
import logging
from typing import Optional, Tuple, Dict, Any
from PIL import Image

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "static", "uploads"))
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
MAX_IMAGE_SIZE_BYTES = 12 * 1024 * 1024  # 12 MB
MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
MAX_FILE_SIZE_BYTES = MAX_IMAGE_SIZE_BYTES

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ImageService:
    """
    Image and media storage service.
    Converts uploaded photos into WebP format and generates feed derivatives.
    Safely stores short video moments (MP4 / WebM) without heavy transcoding.
    Guarantees PostgreSQL only stores lightweight URL references, not Base64 blobs.
    """

    @staticmethod
    def _ensure_dir():
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    @classmethod
    def save_media(
        cls,
        media_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Validate and save uploaded media (image or video).
        Returns URL references: { 'image_url': ..., 'thumbnail_url': ..., 'media_type': 'image' | 'video' }
        """
        cls._ensure_dir()

        if not media_bytes or len(media_bytes) == 0:
            raise ValueError("Uploaded file is empty.")

        ct = (content_type or "").lower()
        fn = (filename or "").lower()
        ext = os.path.splitext(fn)[1] if fn else ""

        is_video = ct.startswith("video/") or ext in ALLOWED_VIDEO_EXTENSIONS

        if is_video:
            if len(media_bytes) > MAX_VIDEO_SIZE_BYTES:
                raise ValueError("Video exceeds maximum allowed size of 25MB.")

            # Validate basic video header signatures (mp4: ftyp, webm: 1A 45 DF A3)
            is_valid_mp4 = b"ftyp" in media_bytes[:32]
            is_valid_webm = media_bytes.startswith(b"\x1a\x45\xdf\xa3")
            if not is_valid_mp4 and not is_valid_webm and ext not in (".mp4", ".webm", ".mov"):
                raise ValueError("Invalid or unsupported video format. Please upload MP4 or WebM video.")

            out_ext = ".webm" if is_valid_webm or ext == ".webm" else ".mp4"
            asset_id = uuid.uuid4().hex[:12]
            video_filename = f"{asset_id}{out_ext}"
            video_path = os.path.join(UPLOAD_DIR, video_filename)

            with open(video_path, "wb") as f:
                f.write(media_bytes)

            url = f"/static/uploads/{video_filename}"
            return {
                "image_url": url,
                "thumbnail_url": url,
                "media_type": "video",
            }
        else:
            # Process as image
            res = cls.process_and_save(media_bytes, original_filename=filename)
            res["media_type"] = "image"
            return res

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

        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            raise ValueError(f"File exceeds maximum allowed size of {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)}MB.")

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

