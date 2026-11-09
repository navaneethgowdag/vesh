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

    def predict_original_garment(
        self,
        clothing_id: UUID,
        user_id: UUID,
    ) -> Dict[str, Any]:
        """
        Execute AI garment attribute prediction on the ORIGINAL uploaded photograph:
        1. Fetch original image binary from Neon BYTEA.
        2. Correct mobile EXIF orientation and validate dimensions.
        3. Pass ORIGINAL image directly to MultiTaskEfficientNetB0.
        4. Extract 9 classification heads (articleType, masterCategory, subCategory,
           gender, baseColour, season, usage, pattern, ageGroup).
        5. Persist predictions in Neon database (ClothingPrediction and ClothingAnalysis).
        6. Transition state to 'predictions_ready' (review_required=True, has_processed=False).
        Returns predicted attributes, scores, and alternatives for immediate user review.
        """
        t0 = time.time()
        clothing = self.db.query(Clothing).filter(Clothing.id == clothing_id).first()
        if not clothing:
            raise ValueError("Clothing item not found")
        if clothing.user_id != user_id:
            raise PermissionError("Access denied to this clothing item")

        # 1. Fetch original image binary from Neon
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

        try:
            self._update_metadata(clothing, status="processing", stage="analyzing_clothing", commit=True)

            raw_img = Image.open(io.BytesIO(image_bytes))
            pil_img = ImageOps.exif_transpose(raw_img).convert("RGB")

            orig_w, orig_h = pil_img.size
            if orig_w < 32 or orig_h < 32:
                raise ValueError(f"Image dimensions too small: {orig_w}x{orig_h}. Minimum required is 32x32.")

            from app.ai.fashion_model import fashion_model_service

            # Predict on the ORIGINAL image using the trained Multi-task EfficientNet-B0 model
            model_pred = fashion_model_service.predict(pil_img)
            prediction_res = fashion_model_service.format_wardrobe_payload(
                prediction_res=model_pred,
                image_source="original",
            )

            # Persist predictions in database
            saved_pred = prediction_service.save_prediction(
                db=self.db,
                clothing=clothing,
                prediction_result=prediction_res,
                user_id=user_id,
            )

            dur = round(time.time() - t0, 3)

            # Mark predictions ready for user review (has_processed remains False until background removal)
            self._update_metadata(
                clothing=clothing,
                status="predictions_ready",
                stage="predictions_ready",
                review_required=True,
                has_processed=False,
                duration=dur,
                commit=True,
            )

            logger.info(
                f"[Pipeline:PredictOriginal] clothing_id={clothing_id} => "
                f"Predicted in {dur}s on original image ({orig_w}x{orig_h}). Stage: predictions_ready."
            )

            return {
                "status": "predictions_ready",
                "stage": "predictions_ready",
                "review_required": True,
                "has_processed": False,
                "duration_seconds": dur,
                "prediction": saved_pred,
            }

        except Exception as e:
            logger.exception(f"[Pipeline] Prediction on original image failed for clothing {clothing_id}: {e}")
            dur = round(time.time() - t0, 3)
            # Even if model throws, allow user manual review without crashing
            self._update_metadata(
                clothing=clothing,
                status="predictions_ready",
                stage="predictions_ready",
                review_required=True,
                has_processed=False,
                error_message=str(e),
                duration=dur,
                commit=True,
            )
            return {
                "status": "predictions_ready",
                "stage": "predictions_ready",
                "review_required": True,
                "has_processed": False,
                "error": str(e),
                "duration_seconds": dur,
            }

    def remove_garment_background(
        self,
        clothing_id: UUID,
        user_id: UUID,
    ) -> Dict[str, Any]:
        """
        Execute garment segmentation and neutral white catalog image composition:
        1. Fetch original image binary from Neon BYTEA.
        2. Correct EXIF orientation and pre-scale if > 1600px.
        3. Segment garment mask and suppress skin/background clutter.
        4. Compose catalog image on neutral white with margins.
        5. Encode as WebP (quality=90, method=3) and store in Neon PostgreSQL BYTEA as 'processed'.
        6. Transition state to 'image_processing_completed' / 'ready_for_review'.
        """
        t0 = time.time()
        clothing = self.db.query(Clothing).filter(Clothing.id == clothing_id).first()
        if not clothing:
            raise ValueError("Clothing item not found")
        if clothing.user_id != user_id:
            raise PermissionError("Access denied to this clothing item")

        # 1. Fetch original image binary from Neon
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

        try:
            # 2. Stage: Removing background
            self._update_metadata(clothing, status="processing", stage="removing_background", commit=True)

            raw_img = Image.open(io.BytesIO(image_bytes))
            pil_img = ImageOps.exif_transpose(raw_img).convert("RGB")

            orig_w, orig_h = pil_img.size
            if max(orig_w, orig_h) > 1600:
                scale = 1600.0 / max(orig_w, orig_h)
                pil_img = pil_img.resize((int(orig_w * scale), int(orig_h * scale)), Image.Resampling.LANCZOS)

            raw_mask, seg_meta = garment_segmentation_service.segment(pil_img)
            refined_mask = image_cleanup_service.refine_mask(pil_img, raw_mask, suppress_skin=True)
            quality_assessment = quality_service.assess_segmentation_quality(pil_img, refined_mask)

            # 3. Stage: Preparing catalog image
            self._update_metadata(clothing, status="processing", stage="preparing_catalog_image", commit=True)
            catalog_img, transparent_img = image_cleanup_service.compose_catalog_image(
                pil_img,
                refined_mask,
                output_size=1024,
                bg_color=(255, 255, 255),
            )

            # 4. WebP compression (method=3)
            buf = io.BytesIO()
            catalog_img.save(buf, format="WEBP", quality=90, method=3)
            processed_bytes = buf.getvalue()

            # 5. Store processed image in Neon PostgreSQL
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

            # Optional: Enrich fine-grained silhouette details from transparent mask if available
            try:
                cv_res = garment_classifier.analyze_garment(image_input=transparent_img, image_source="processed")
                analysis = clothing.analysis
                if analysis and analysis.feature_vector:
                    fv = dict(analysis.feature_vector)
                    v_attrs = fv.get("verified_attributes", {})
                    cv_attrs = cv_res.get("predicted_attributes", {})
                    for k in ["sleeve_type", "neckline", "silhouette", "length"]:
                        if k in cv_attrs and k not in v_attrs:
                            v_attrs[k] = cv_attrs[k]
                    fv["verified_attributes"] = v_attrs
                    analysis.feature_vector = fv
                    self.db.commit()
            except Exception as enr_err:
                logger.debug(f"[Pipeline] Auxiliary silhouette enrichment notice: {enr_err}")

            total_duration = round(time.time() - t0, 2)

            # 6. Mark image processing completed and ready for review
            self._update_metadata(
                clothing=clothing,
                status="ready_for_review",
                stage="image_processing_completed",
                review_required=True,
                has_processed=True,
                duration=total_duration,
                quality_info=quality_assessment.to_dict(),
                commit=True,
            )

            logger.info(
                f"[Pipeline:RemoveBackground] clothing_id={clothing_id} => "
                f"Background removed in {total_duration}s. Stage: image_processing_completed."
            )

            return {
                "status": "ready_for_review",
                "stage": "image_processing_completed",
                "duration_seconds": total_duration,
                "has_processed": True,
                "review_required": True,
                "processed_image_url": f"/api/v1/clothing/{clothing_id}/image/processed",
                "quality": quality_assessment.to_dict(),
            }

        except Exception as e:
            logger.exception(f"[Pipeline] Background removal failure for clothing {clothing_id}: {e}")
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

    def process_clothing_item(
        self,
        clothing_id: UUID,
        user_id: UUID,
    ) -> Dict[str, Any]:
        """
        Full garment pipeline coordinator (for batch upload and queue workers).
        ENFORCED ORDER:
        1. Predict on ORIGINAL uploaded image FIRST.
        2. Remove background and compose catalog image SECOND.
        """
        t0 = time.time()
        clothing = self.db.query(Clothing).filter(Clothing.id == clothing_id).first()
        if not clothing:
            raise ValueError("Clothing item not found")
        if clothing.user_id != user_id:
            raise PermissionError("Access denied to this clothing item")

        now_iso = datetime.now(timezone.utc).isoformat()
        self._update_metadata(
            clothing,
            status="processing",
            stage="claimed_by_worker",
            claimed_at=now_iso,
            commit=True,
        )

        # Step 1: Predict on ORIGINAL image first
        pred_res = self.predict_original_garment(clothing_id=clothing_id, user_id=user_id)

        # Step 2: Remove background second
        bg_res = self.remove_garment_background(clothing_id=clothing_id, user_id=user_id)

        total_dur = round(time.time() - t0, 2)
        final_status = "ready_for_review" if bg_res.get("status") != "failed" else "predictions_ready"
        final_stage = "ready_for_review" if bg_res.get("status") != "failed" else "failed"

        self._update_metadata(
            clothing=clothing,
            status=final_status,
            stage=final_stage,
            review_required=True,
            has_processed=bg_res.get("has_processed", False),
            duration=total_dur,
            commit=True,
        )

        return {
            "status": final_status,
            "stage": final_stage,
            "duration_seconds": total_dur,
            "prediction": pred_res,
            "background_removal": bg_res,
        }
