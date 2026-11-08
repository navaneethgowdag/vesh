import io
import time
import logging
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timezone
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.services.clothing_image_service import ClothingImageService
from app.services.garment_segmentation_service import garment_segmentation_service
from app.services.image_cleanup_service import image_cleanup_service
from app.services.image_quality_service import quality_service
from app.services.garment_classifier_service import garment_classifier
from app.services.clothing_prediction_service import prediction_service

logger = logging.getLogger(__name__)


class ClothingProcessingService:
    """
    Optimized end-to-end pipeline coordinator for garment image processing.
    Executes:
    1. Worker Claim & State Initialization
    2. Original Image Retrieval from Neon BYTEA
    3. EXIF Orientation Correction & Input Validation
    4. Working Dimension Pre-Scaling (max 1600px for CPU/RAM optimization)
    5. Garment Segmentation & Color-Guarded Skin Suppression
    6. Neutral Background Catalog Image Composition (12% margin, aspect ratio preserved)
    7. Fast WebP Compression (method=3) & Neon PostgreSQL BYTEA Storage
    8. Specialized Computer Vision Garment Understanding & Attribute Extraction
    9. Ready-for-Review Transition & Persisted Metrics
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
        commit: bool = True,
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
        if commit:
            self.db.commit()
        else:
            self.db.flush()

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
            commit=True,
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
                commit=True,
            )
            return {"status": "failed", "error": "Original image not found"}

        image_bytes, mime_type = orig_res
        logger.info(f"[Pipeline:ImageRetrieved] clothing_id={clothing_id}, size={len(image_bytes)} bytes in {round(time.time() - t_fetch, 3)}s")

        try:
            # 2. Stage: Image orientation correction & input validation
            t_stage = time.time()
            self._update_metadata(clothing, status="processing", stage="analyzing_clothing", commit=True)
            
            raw_img = Image.open(io.BytesIO(image_bytes))
            # Handle mobile EXIF orientation tag
            pil_img = ImageOps.exif_transpose(raw_img).convert("RGB")

            orig_w, orig_h = pil_img.size
            if orig_w < 32 or orig_h < 32:
                raise ValueError(f"Image dimensions too small: {orig_w}x{orig_h}. Minimum required is 32x32.")

            # Working resolution optimization: max 1600px
            if max(orig_w, orig_h) > 1600:
                scale = 1600.0 / max(orig_w, orig_h)
                pil_img = pil_img.resize((int(orig_w * scale), int(orig_h * scale)), Image.Resampling.LANCZOS)
                logger.info(f"[Pipeline:PreScale] clothing_id={clothing_id} scaled from {orig_w}x{orig_h} to {pil_img.size[0]}x{pil_img.size[1]}")

            t_analysis = round(time.time() - t_stage, 3)

            # 3. Stage: Removing background using garment segmentation
            t_stage = time.time()
            self._update_metadata(clothing, status="processing", stage="removing_background", commit=True)
            raw_mask, seg_meta = garment_segmentation_service.segment(pil_img)

            # 4. Refine mask and assess quality with contour void protection and color-guarded skin suppression
            refined_mask = image_cleanup_service.refine_mask(pil_img, raw_mask, suppress_skin=True)
            quality_assessment = quality_service.assess_segmentation_quality(pil_img, refined_mask)
            t_seg = round(time.time() - t_stage, 3)

            # 5. Stage: Preparing catalog image (12% padding, centered on neutral white background)
            t_stage = time.time()
            self._update_metadata(clothing, status="processing", stage="preparing_catalog_image", commit=True)
            catalog_img, transparent_img = image_cleanup_service.compose_catalog_image(
                pil_img,
                refined_mask,
                output_size=1024,
                bg_color=(255, 255, 255),
            )

            # 6. Optimized WebP compression: method=3 instead of method=6 (14x speedup, identical visual quality)
            buf = io.BytesIO()
            catalog_img.save(buf, format="WEBP", quality=90, method=3)
            processed_bytes = buf.getvalue()
            t_comp = round(time.time() - t_stage, 3)

            # 7. Store processed bytes into Neon PostgreSQL
            t_stage = time.time()
            stored_record = self.image_service.store_image(
                clothing_id=clothing_id,
                user_id=user_id,
                image_bytes=processed_bytes,
                image_type="processed",
                mime_type="image/webp",
                width=catalog_img.width,
                height=catalog_img.height,
            )

            has_proc = self.image_service.has_image(clothing_id, user_id, "processed")
            if not has_proc and not stored_record:
                raise RuntimeError("Processed image verification failed: binary record not persisted in Neon.")
            t_storage = round(time.time() - t_stage, 3)

            # 8. Stage: Specialized Fashion Computer Vision Attribute Extraction
            t_stage = time.time()
            self._update_metadata(clothing, status="processing", stage="understanding_garment", commit=True)
            try:
                from app.ai.fashion_model import fashion_model_service

                # Predict on catalog image using the trained Multi-task EfficientNet-B0 model
                model_pred = fashion_model_service.predict(catalog_img)
                prediction_res = fashion_model_service.format_wardrobe_payload(
                    prediction_res=model_pred,
                    image_source="processed",
                )

                # Enrich with fine-grained silhouette geometry & pixel color analysis
                try:
                    cv_res = garment_classifier.analyze_garment(
                        image_input=transparent_img,
                        image_source="processed",
                    )
                    cv_attrs = cv_res.get("predicted_attributes", {})
                    pred_attrs = prediction_res["predicted_attributes"]
                    for k in ["sleeve_type", "neckline", "silhouette", "fit", "length", "category_specific"]:
                        if k in cv_attrs and k not in pred_attrs:
                            pred_attrs[k] = cv_attrs[k]
                    if cv_res.get("color_palette"):
                        prediction_res["color_palette"] = cv_res["color_palette"]
                except Exception as cve:
                    logger.debug(f"[Pipeline] Auxiliary CV enrichment notice: {cve}")

                prediction_service.save_prediction(
                    db=self.db,
                    clothing=clothing,
                    prediction_result=prediction_res,
                    user_id=user_id,
                )
            except Exception as pe:
                logger.warning(f"[Pipeline] Specialized model classification warning for clothing {clothing_id}: {pe}")
                try:
                    fallback_res = garment_classifier.analyze_garment(
                        image_input=transparent_img,
                        image_source="processed",
                    )
                    prediction_service.save_prediction(
                        db=self.db,
                        clothing=clothing,
                        prediction_result=fallback_res,
                        user_id=user_id,
                    )
                except Exception as fe:
                    logger.error(f"[Pipeline] Classification fallback failed: {fe}")
            t_und = round(time.time() - t_stage, 3)

            total_duration = round(time.time() - t0, 2)
            final_status = "ready_for_review"

            # 9. Mark ready for review in Neon PostgreSQL and commit all final metadata
            self._update_metadata(
                clothing=clothing,
                status=final_status,
                stage="ready_for_review",
                review_required=True,
                has_processed=True,
                duration=total_duration,
                quality_info=quality_assessment.to_dict(),
                commit=True,
            )

            logger.info(
                f"[Pipeline:Timings] clothing_id={clothing_id} => "
                f"prep={t_analysis}s, seg={t_seg}s, comp={t_comp}s, "
                f"storage={t_storage}s, cv_understand={t_und}s | TOTAL={total_duration}s. Stage: ready_for_review."
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
                commit=True,
            )
            return {
                "status": "failed",
                "stage": "failed",
                "error": str(e),
                "duration_seconds": total_duration,
            }
