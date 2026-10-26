import io
import logging
from typing import Dict, Any, Optional
from uuid import UUID
import httpx
from PIL import Image

from app.core.database import SessionLocal
from app.models.background_job import BackgroundJob
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.ai.clothing_classifier import clothing_classifier

logger = logging.getLogger(__name__)


def process_clothing_analysis_job(
    job_id: str,
    user_id: str,
    image_url: Optional[str] = None,
    clothing_id: Optional[str] = None,
    db: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Durable, idempotent worker task for analyzing clothing images.
    Executed in a dedicated background worker process (RQ), or synchronously in fallback mode.
    """
    logger.info(f"[Worker] Processing clothing analysis job {job_id} for user {user_id}")
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        job_uuid = UUID(job_id)
        user_uuid = UUID(user_id)

        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_uuid).first()
        if not job:
            logger.error(f"[Worker] Job {job_id} not found in database.")
            return {"error": "Job not found"}

        # Ownership authorization check inside worker
        if job.user_id != user_uuid:
            logger.error(f"[Worker] Ownership mismatch for job {job_id}: expected {job.user_id}, got {user_uuid}")
            job.status = "failed"
            job.error_message = "Unauthorized: ownership mismatch"
            db.commit()
            return {"error": "Unauthorized"}

        # Idempotency check: if already completed, return existing result
        if job.status == "completed" and job.result:
            logger.info(f"[Worker] Job {job_id} is already completed. Skipping reprocessing.")
            return job.result

        # Update status to processing
        job.status = "processing"
        job.retry_count = (job.retry_count or 0) + 1
        db.commit()

        # Resolve image
        img: Optional[Image.Image] = None
        target_url = image_url or (job.payload_ref.get("image_url") if job.payload_ref else None)

        if clothing_id and not target_url:
            clothing_item = db.query(Clothing).filter(Clothing.id == UUID(clothing_id)).first()
            if clothing_item and clothing_item.image_url:
                target_url = clothing_item.image_url

        if target_url:
            try:
                resp = httpx.get(target_url, timeout=10.0)
                if resp.status_code == 200:
                    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
            except Exception as e:
                logger.warning(f"[Worker] Could not download image from '{target_url}': {e}. Using neutral fallback canvas.")

        if img is None:
            # Fallback neutral canvas
            img = Image.new("RGB", (300, 300), color=(240, 235, 230))

        # Execute AI classification
        analysis_result = clothing_classifier.predict(img)

        # If associated with a clothing record, persist analysis into clothing_analysis
        target_clothing_id = clothing_id or (job.payload_ref.get("clothing_id") if job.payload_ref else None)
        if target_clothing_id:
            c_uuid = UUID(target_clothing_id)
            existing_analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == c_uuid).first()
            if existing_analysis:
                existing_analysis.detected_category = analysis_result.get("detected_category")
                existing_analysis.detected_subcategory = analysis_result.get("detected_subcategory")
                existing_analysis.detected_colors = analysis_result.get("detected_colors", [])
                existing_analysis.detected_pattern = analysis_result.get("detected_pattern", "Solid")
                existing_analysis.detected_material = analysis_result.get("detected_material", "Cotton")
                existing_analysis.detected_fit = analysis_result.get("detected_fit", "Regular")
                existing_analysis.style_tags = analysis_result.get("style_tags", [])
                existing_analysis.season_tags = analysis_result.get("season_tags", [])
                existing_analysis.occasion_tags = analysis_result.get("occasion_tags", [])
                existing_analysis.confidence = analysis_result.get("confidence", 0.9)
                existing_analysis.feature_vector = analysis_result.get("feature_vector", [])
            else:
                new_analysis = ClothingAnalysis(
                    clothing_id=c_uuid,
                    detected_category=analysis_result.get("detected_category"),
                    detected_subcategory=analysis_result.get("detected_subcategory"),
                    detected_colors=analysis_result.get("detected_colors", []),
                    detected_pattern=analysis_result.get("detected_pattern", "Solid"),
                    detected_material=analysis_result.get("detected_material", "Cotton"),
                    detected_fit=analysis_result.get("detected_fit", "Regular"),
                    style_tags=analysis_result.get("style_tags", []),
                    season_tags=analysis_result.get("season_tags", []),
                    occasion_tags=analysis_result.get("occasion_tags", []),
                    confidence=analysis_result.get("confidence", 0.9),
                    feature_vector=analysis_result.get("feature_vector", []),
                )
                db.add(new_analysis)

        # Mark job completed
        job.status = "completed"
        job.result = analysis_result
        job.error_message = None
        db.commit()
        logger.info(f"[Worker] Job {job_id} successfully completed.")
        return analysis_result

    except Exception as e:
        logger.exception(f"[Worker] Error processing job {job_id}: {e}")
        try:
            db.rollback()
            job = db.query(BackgroundJob).filter(BackgroundJob.id == UUID(job_id)).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                db.commit()
        except Exception:
            pass
        raise
    finally:
        if should_close:
            db.close()

