import io
import time
import logging
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timezone
from PIL import Image
from sqlalchemy.orm import Session

from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.services.clothing_image_service import ClothingImageService
from app.services.garment_segmentation_service import garment_segmentation_service
from app.services.image_cleanup_service import image_cleanup_service
from app.services.image_quality_service import quality_service
from app.ai.clothing_classifier import clothing_classifier
from app.services.garment_classifier_service import garment_classifier
from app.services.clothing_prediction_service import prediction_service

logger = logging.getLogger(__name__)


class ClothingProcessingService:
    """
    End-to-end pipeline coordinator for garment image processing.
    Executes:
    1. Worker Claim & State Initialization
    2. Original Image Retrieval from Neon BYTEA
    3. Fashion Analysis & Color Extraction
    4. Garment Segmentation & Skin Suppression
    5. Neutral Background Catalog Image Composition
    6. Neon PostgreSQL BYTEA Storage & Readback Verification
    7. AI Garment Understanding & Attribute Extraction
    8. Ready-for-Review Transition
    """

    def __init__(self, db: Session):
        self.db = db
        self.image_service = ClothingImageService(db)

    def _update_metadata(
        self,
        clothing: Clothing,
        status: str,
        stage: str,
        review_required: bool = False,
        has_processed: bool = False,
        error_message: Optional[str] = None,
        duration: Optional[float] = None,
        quality_info: Optional[Dict[str, Any]] = None,
        claimed_at: Optional[str] = None,
    ) -> None:
        """Persist state transitions and metadata into Neon database."""
        analysis = self.db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
        if not analysis:
            analysis = ClothingAnalysis(
                clothing_id=clothing.id,
                detected_category=clothing.category,
                feature_vector={},
            )
            self.db.add(analysis)

        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = status
        fv["processing_stage"] = stage
        fv["review_required"] = review_required
        fv["has_processed"] = has_processed
        if claimed_at:
            fv["processing_claimed_at"] = claimed_at
        if error_message:
            fv["error_message"] = error_message
        if duration is not None:
            fv["processing_duration"] = duration
        if quality_info:
            fv["quality_assessment"] = quality_info

        analysis.feature_vector = fv
        clothing.updated_at = datetime.now(timezone.utc)
        self.db.commit()

    def process_clothing_item(
        self,
        clothing_id: UUID,
        user_id: UUID,
    ) -> Dict[str, Any]:
        """
        Execute the full CPU garment processing pipeline.
        Safe, idempotent, and updates real status in Neon PostgreSQL.
        """
        t0 = time.time()
        clothing = self.db.query(Clothing).filter(Clothing.id == clothing_id).first()
        if not clothing:
            raise ValueError("Clothing item not found")
        if clothing.user_id != user_id:
            raise PermissionError("Access denied to this clothing item")

        now_iso = datetime.now(timezone.utc).isoformat()
        # Immediately mark claimed by worker so UI advances from 'queued' to 'processing'
        self._update_metadata(
            clothing,
            status="processing",
            stage="claimed_by_worker",
            claimed_at=now_iso,
        )
        logger.info(f"[Pipeline:Claimed] clothing_id={clothing_id} at {now_iso}")

        # 1. Fetch original image binary from Neon
        t_fetch = time.time()
        orig_res = self.image_service.get_image(clothing_id, user_id, image_type="original")
        if not orig_res:
            self._update_metadata(
                clothing,
                status="failed",
                stage="failed",
                error_message="Original image binary not found in database.",
            )
            return {"status": "failed", "error": "Original image not found"}

        image_bytes, mime_type = orig_res
        logger.info(f"[Pipeline:ImageRetrieved] clothing_id={clothing_id}, size={len(image_bytes)} bytes in {round(time.time() - t_fetch, 3)}s")

        try:
            # 2. Stage: Analyzing clothing
            t_stage = time.time()
            self._update_metadata(clothing, status="processing", stage="analyzing_clothing")
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            # Extract fashion metadata via clothing classifier
            try:
                classif_res = clothing_classifier.predict(pil_img)
                analysis = self.db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing_id).first()
                if analysis:
                    analysis.detected_colors = classif_res.get("dominant_colors", [])
                    analysis.detected_pattern = classif_res.get("pattern", "Solid")
                    analysis.detected_material = classif_res.get("material", "Cotton")
                    analysis.detected_fit = classif_res.get("fit", "Regular")
                    analysis.style_tags = classif_res.get("style_tags", [])
                    analysis.season_tags = classif_res.get("season_tags", [])
                    analysis.occasion_tags = classif_res.get("occasion_tags", [])
                    analysis.confidence = classif_res.get("confidence", 0.9)
                    self.db.commit()
            except Exception as ce:
                logger.warning(f"Classification metadata extraction warning: {ce}")

            t_analysis = round(time.time() - t_stage, 3)

            # 3. Stage: Removing background
            t_stage = time.time()
            self._update_metadata(clothing, status="processing", stage="removing_background")
            raw_mask, seg_meta = garment_segmentation_service.segment(pil_img)

            # 4. Refine mask and assess quality
            refined_mask = image_cleanup_service.refine_mask(pil_img, raw_mask, suppress_skin=True)
            quality_assessment = quality_service.assess_segmentation_quality(pil_img, refined_mask)
            t_seg = round(time.time() - t_stage, 3)

            # 5. Stage: Preparing catalog image
            t_stage = time.time()
            self._update_metadata(clothing, status="processing", stage="preparing_catalog_image")
            catalog_img, transparent_img = image_cleanup_service.compose_catalog_image(
                pil_img,
                refined_mask,
                output_size=1024,
                bg_color=(255, 255, 255),
            )

            # 6. Encode processed catalog image to WebP
            buf = io.BytesIO()
            catalog_img.save(buf, format="WEBP", quality=90, method=6)
            processed_bytes = buf.getvalue()
            t_comp = round(time.time() - t_stage, 3)

            # 7. Store processed bytes into Neon PostgreSQL and verify readback
            t_stage = time.time()
            self.image_service.store_image(
                clothing_id=clothing_id,
                user_id=user_id,
                image_bytes=processed_bytes,
                image_type="processed",
                mime_type="image/webp",
                width=catalog_img.width,
                height=catalog_img.height,
            )

            # Verify persisted binary in Neon
            verify_proc = self.image_service.get_image(clothing_id, user_id, "processed")
            if not verify_proc or not verify_proc[0]:
                raise RuntimeError("Processed image verification failed: binary not readable from Neon BYTEA after storage.")
            t_storage = round(time.time() - t_stage, 3)

            # 8. Stage: AI Garment Understanding and Structured Classification
            t_stage = time.time()
            self._update_metadata(clothing, status="processing", stage="understanding_garment")
            try:
                prediction_res = garment_classifier.analyze_garment(
                    image_input=catalog_img,
                    mask_input=refined_mask,
                    image_source="processed",
                )
                prediction_service.save_prediction(
                    db=self.db,
                    clothing=clothing,
                    prediction_result=prediction_res,
                    user_id=user_id,
                )
            except Exception as pe:
                logger.warning(f"[Pipeline] AI classification warning for clothing {clothing_id}: {pe}")
            t_und = round(time.time() - t_stage, 3)

            total_duration = round(time.time() - t0, 2)
            final_status = "ready_for_review"

            # 9. Mark ready for review in Neon PostgreSQL
            self._update_metadata(
                clothing=clothing,
                status=final_status,
                stage="ready_for_review",
                review_required=True,
                has_processed=True,
                duration=total_duration,
                quality_info=quality_assessment.to_dict(),
            )

            logger.info(
                f"[Pipeline:Timings] clothing_id={clothing_id} => "
                f"analysis={t_analysis}s, seg={t_seg}s, comp={t_comp}s, "
                f"storage={t_storage}s, understand={t_und}s | TOTAL={total_duration}s. Stage: ready_for_review."
            )
            return {
                "status": final_status,
                "stage": "ready_for_review",
                "duration_seconds": total_duration,
                "review_required": True,
                "quality": quality_assessment.to_dict(),
            }

        except Exception as e:
            logger.exception(f"[Pipeline] Processing failure for clothing {clothing_id}: {e}")
            total_duration = round(time.time() - t0, 2)
            self._update_metadata(
                clothing=clothing,
                status="failed",
                stage="failed",
                error_message=str(e),
                duration=total_duration,
            )
            return {
                "status": "failed",
                "stage": "failed",
                "error": str(e),
                "duration_seconds": total_duration,
            }
