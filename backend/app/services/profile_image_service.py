import io
import base64
import logging
from typing import Optional, Tuple
from uuid import UUID
from datetime import datetime, timezone
from PIL import Image
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from fastapi import HTTPException, status

from app.models.user import User
from app.models.profile_image import ProfileImage
from app.models.user_preference import UserPreference
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}
STORAGE_FALLBACK_KEY = "_profile_image"


class ProfileImageService:
    """
    Dedicated binary profile photo storage service using Neon PostgreSQL LargeBinary (BYTEA).
    Enforces image content validation, dimensions normalization (512x512 square crop),
    and user ownership.
    """

    def __init__(self, db: Session):
        self.db = db
        self._has_table = self._check_table_exists()

    def _check_table_exists(self) -> bool:
        try:
            insp = inspect(self.db.bind)
            return "profile_images" in insp.get_table_names()
        except Exception:
            return False

    def validate_and_process_image(self, file_bytes: bytes, declared_mime: Optional[str] = None) -> Tuple[bytes, str, int, int]:
        """
        Validates image content using PIL, enforces <= 5MB limit,
        performs center-square crop and resize to 512x512, and returns
        (optimized_bytes, mime_type, width, height).
        """
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image file exceeds maximum allowable size of 5 MB ({len(file_bytes) / (1024 * 1024):.2f} MB provided).",
            )

        if len(file_bytes) < 32:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty or corrupted image file provided.",
            )

        try:
            pil_img = Image.open(io.BytesIO(file_bytes))
            pil_img.verify()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image file format or corrupted bytes: {str(e)}",
            )

        # Re-open after verify() (PIL requires re-opening to manipulate)
        pil_img = Image.open(io.BytesIO(file_bytes))

        # Check format
        fmt = (pil_img.format or "").upper()
        if fmt not in ("JPEG", "JPG", "PNG", "WEBP"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image format '{fmt}'. Allowed formats: JPG, PNG, WebP.",
            )

        # Convert to RGB (or RGBA if transparency exists and saving to WebP/PNG)
        if pil_img.mode in ("RGBA", "LA") or (pil_img.mode == "P" and "transparency" in pil_img.info):
            # Keep RGBA for transparent PNG/WebP
            converted = pil_img.convert("RGBA")
            target_format = "WEBP"
            target_mime = "image/webp"
        else:
            converted = pil_img.convert("RGB")
            target_format = "WEBP"
            target_mime = "image/webp"

        # Center-square crop
        orig_w, orig_h = converted.size
        min_dim = min(orig_w, orig_h)
        left = (orig_w - min_dim) // 2
        top = (orig_h - min_dim) // 2
        right = left + min_dim
        bottom = top + min_dim
        cropped = converted.crop((left, top, right, bottom))

        # High-quality resize to 512x512
        resized = cropped.resize((512, 512), Image.Resampling.LANCZOS)

        # Encode to bytes
        output_io = io.BytesIO()
        try:
            resized.save(output_io, format=target_format, quality=88, method=6)
        except Exception:
            # Fallback to JPEG if WebP encoder issue occurs
            target_format = "JPEG"
            target_mime = "image/jpeg"
            output_io = io.BytesIO()
            resized.convert("RGB").save(output_io, format=target_format, quality=88)

        output_bytes = output_io.getvalue()
        return output_bytes, target_mime, 512, 512

    def store_avatar(self, user_id: UUID, file_bytes: bytes, declared_mime: Optional[str] = None) -> str:
        """
        Processes image and saves into Neon BYTEA storage.
        Updates user.profile_image_url to /api/v1/users/{user_id}/avatar.
        Returns the public avatar endpoint URL.
        """
        processed_bytes, mime_type, w, h = self.validate_and_process_image(file_bytes, declared_mime)

        if self._has_table:
            existing = self.db.query(ProfileImage).filter(ProfileImage.user_id == user_id).first()
            if existing:
                existing.image_data = processed_bytes
                existing.mime_type = mime_type
                existing.file_size = len(processed_bytes)
                existing.width = w
                existing.height = h
                existing.updated_at = datetime.now(timezone.utc)
            else:
                new_img = ProfileImage(
                    user_id=user_id,
                    image_data=processed_bytes,
                    mime_type=mime_type,
                    file_size=len(processed_bytes),
                    width=w,
                    height=h,
                )
                self.db.add(new_img)
        else:
            # Fallback storage in user_preference.preferred_fits
            pref = self.db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
            if not pref:
                pref = UserPreference(user_id=user_id, preferred_fits={})
                self.db.add(pref)
            
            data_dict = pref.preferred_fits if isinstance(pref.preferred_fits, dict) else {"fits": pref.preferred_fits or []}
            b64_data = base64.b64encode(processed_bytes).decode("utf-8")
            data_dict[STORAGE_FALLBACK_KEY] = {
                "b64": b64_data,
                "mime": mime_type,
                "w": w,
                "h": h,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            pref.preferred_fits = dict(data_dict)

        avatar_url = f"/api/v1/users/{user_id}/avatar"

        # Update User record
        user = self.db.query(User).filter(User.id == user_id).first()
        if user:
            user.profile_image_url = avatar_url

        self.db.commit()

        # Cache invalidation
        cache_service.delete(f"user:avatar:{user_id}")
        cache_service.delete(f"user:{user_id}")

        return avatar_url

    def get_avatar(self, user_id: UUID) -> Optional[Tuple[bytes, str]]:
        """
        Retrieves binary image data and mime type for user.
        Returns (bytes, mime_type) or None if not found.
        """
        # Try table lookup
        if self._has_table:
            row = self.db.query(ProfileImage).filter(ProfileImage.user_id == user_id).first()
            if row and row.image_data:
                return bytes(row.image_data), row.mime_type

        # Fallback to user_preference payload
        pref = self.db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
        if pref and isinstance(pref.preferred_fits, dict):
            fallback = pref.preferred_fits.get(STORAGE_FALLBACK_KEY)
            if fallback and "b64" in fallback:
                try:
                    img_bytes = base64.b64decode(fallback["b64"])
                    return img_bytes, fallback.get("mime", "image/webp")
                except Exception as e:
                    logger.warning(f"Failed to decode fallback avatar for user {user_id}: {e}")

        return None

    def delete_avatar(self, user_id: UUID) -> bool:
        """
        Deletes stored avatar and reverts user.profile_image_url to None.
        """
        deleted = False
        if self._has_table:
            row = self.db.query(ProfileImage).filter(ProfileImage.user_id == user_id).first()
            if row:
                self.db.delete(row)
                deleted = True

        pref = self.db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
        if pref and isinstance(pref.preferred_fits, dict) and STORAGE_FALLBACK_KEY in pref.preferred_fits:
            data_dict = dict(pref.preferred_fits)
            data_dict.pop(STORAGE_FALLBACK_KEY, None)
            pref.preferred_fits = data_dict
            deleted = True

        user = self.db.query(User).filter(User.id == user_id).first()
        if user:
            user.profile_image_url = None

        self.db.commit()

        cache_service.delete(f"user:avatar:{user_id}")
        cache_service.delete(f"user:{user_id}")

        return deleted
