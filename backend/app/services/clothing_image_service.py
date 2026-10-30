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

from app.models.clothing import Clothing
from app.models.clothing_image import ClothingImage
from app.models.clothing_analysis import ClothingAnalysis

logger = logging.getLogger(__name__)


class ClothingImageService:
    """
    Dedicated binary image storage service using Neon PostgreSQL LargeBinary (BYTEA).
    Handles original and processed garment images with ownership enforcement
    and clean separation between image metadata and binary payloads.
    """

    def __init__(self, db: Session):
        self.db = db
        self._has_table = self._check_table_exists()

    def _check_table_exists(self) -> bool:
        try:
            insp = inspect(self.db.bind)
            return "clothing_images" in insp.get_table_names()
        except Exception:
            return False

    def store_image(
        self,
        clothing_id: UUID,
        user_id: UUID,
        image_bytes: bytes,
        image_type: str = "original",
        mime_type: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
    ) -> ClothingImage:
        """
        Store image binary payload into PostgreSQL with user ownership verification.
        """
        clothing = self.db.query(Clothing).filter(Clothing.id == clothing_id).first()
        if not clothing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
        if clothing.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

        if not mime_type:
            mime_type = "image/webp" if image_type == "processed" else "image/jpeg"

        # Determine dimensions if not provided
        if width is None or height is None:
            try:
                with Image.open(io.BytesIO(image_bytes)) as pil_img:
                    width, height = pil_img.size
            except Exception:
                width, height = 800, 800

        file_size = len(image_bytes)

        if self._has_table:
            # Query existing image record of this type
            existing = (
                self.db.query(ClothingImage)
                .filter(ClothingImage.clothing_id == clothing_id, ClothingImage.image_type == image_type)
                .first()
            )
            if existing:
                existing.image_data = image_bytes
                existing.mime_type = mime_type
                existing.file_size = file_size
                existing.width = width
                existing.height = height
                existing.created_at = datetime.now(timezone.utc)
                self.db.commit()
                self.db.refresh(existing)
                return existing
            else:
                new_img = ClothingImage(
                    clothing_id=clothing_id,
                    user_id=user_id,
                    image_type=image_type,
                    image_data=image_bytes,
                    mime_type=mime_type,
                    file_size=file_size,
                    width=width,
                    height=height,
                )
                self.db.add(new_img)
                self.db.commit()
                self.db.refresh(new_img)
                return new_img
        else:
            # Fallback persistence for environments with restricted schema permissions
            analysis = self.db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing_id).first()
            if not analysis:
                analysis = ClothingAnalysis(
                    clothing_id=clothing_id,
                    detected_category=clothing.category,
                    feature_vector={},
                )
                self.db.add(analysis)

            feature_dict = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
            feature_dict[f"{image_type}_data"] = base64.b64encode(image_bytes).decode("ascii")
            feature_dict[f"{image_type}_mime"] = mime_type
            feature_dict[f"{image_type}_size"] = file_size
            feature_dict[f"{image_type}_width"] = width
            feature_dict[f"{image_type}_height"] = height
            if image_type == "processed":
                feature_dict["has_processed"] = True

            analysis.feature_vector = feature_dict
            self.db.commit()

            # Return synthetic ClothingImage instance
            dummy = ClothingImage(
                clothing_id=clothing_id,
                user_id=user_id,
                image_type=image_type,
                image_data=image_bytes,
                mime_type=mime_type,
                file_size=file_size,
                width=width,
                height=height,
            )
            return dummy

    def get_image(
        self,
        clothing_id: UUID,
        user_id: Optional[UUID] = None,
        image_type: str = "original",
    ) -> Optional[Tuple[bytes, str]]:
        """
        Retrieve image binary data and MIME type, strictly validating user ownership if user_id is supplied.
        Returns (image_bytes, mime_type) or raises 404 / 403.
        """
        clothing = self.db.query(Clothing).filter(Clothing.id == clothing_id).first()
        if not clothing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
        if user_id is not None and clothing.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

        if self._has_table:
            img_record = (
                self.db.query(ClothingImage)
                .filter(ClothingImage.clothing_id == clothing_id, ClothingImage.image_type == image_type)
                .first()
            )
            if img_record and img_record.image_data:
                return bytes(img_record.image_data), img_record.mime_type
        else:
            analysis = self.db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing_id).first()
            if analysis and isinstance(analysis.feature_vector, dict):
                b64_data = analysis.feature_vector.get(f"{image_type}_data")
                mime = analysis.feature_vector.get(f"{image_type}_mime", "image/jpeg")
                if b64_data:
                    return base64.b64decode(b64_data), mime

        return None

    def has_image(self, clothing_id: UUID, user_id: UUID, image_type: str = "processed") -> bool:
        """
        Check if an image of the specified type exists without loading binary payload.
        """
        if self._has_table:
            count = (
                self.db.query(ClothingImage)
                .filter(ClothingImage.clothing_id == clothing_id, ClothingImage.image_type == image_type)
                .count()
            )
            return count > 0
        else:
            analysis = self.db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing_id).first()
            if analysis and isinstance(analysis.feature_vector, dict):
                return bool(analysis.feature_vector.get(f"{image_type}_data"))
            return False

    def delete_images_for_clothing(self, clothing_id: UUID, user_id: UUID) -> None:
        """
        Clean up all image binaries associated with a clothing item.
        """
        if self._has_table:
            self.db.query(ClothingImage).filter(
                ClothingImage.clothing_id == clothing_id,
                ClothingImage.user_id == user_id,
            ).delete()
            self.db.commit()
