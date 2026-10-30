import io
import time
import uuid
import logging
from typing import Dict, Any, Optional
from uuid import UUID
import httpx
from PIL import Image

from app.core.database import SessionLocal
from app.core.redis import get_rq_redis_client
from app.models.background_job import BackgroundJob
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.ai.clothing_classifier import clothing_classifier
from app.services.clothing_image_service import ClothingImageService

logger = logging.getLogger(__name__)


def _parse_uuid_safe(val: Any) -> Optional[UUID]:
    if not val or val == "None":
        return None
    try:
        return UUID(str(val))
    except (ValueError, TypeError):
        return None


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
    logger.info(f"[Worker:Received] Analysis job_id={job_id}, user_id={user_id}, clothing_id={clothing_id}")
    t0 = time.time()
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        job_uuid = _parse_uuid_safe(job_id)
        user_uuid = _parse_uuid_safe(user_id)
        clothing_uuid = _parse_uuid_safe(clothing_id)

        job = None
        if job_uuid:
            try:
                from sqlalchemy import inspect
                if "background_jobs" in inspect(db.bind).get_table_names():
                    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_uuid).first()
            except Exception:
                job = None

        if job and user_uuid:
            if job.user_id != user_uuid:
                logger.error(f"[Worker:Unauthorized] Ownership mismatch for job {job_id}")
                job.status = "failed"
                job.error_message = "Unauthorized: ownership mismatch"
                db.commit()
                return {"error": "Unauthorized"}

            if job.status == "completed" and job.result:
                logger.info(f"[Worker:Idempotent] Job {job_id} already completed. Returning cached result.")
                return job.result

            job.status = "processing"
            job.retry_count = (job.retry_count or 0) + 1
            db.commit()

        logger.info(f"[Worker:Started] Analysis job_id={job_id}")

        # Resolve image
        img: Optional[Image.Image] = None
        target_url = image_url or (job.payload_ref.get("image_url") if job and job.payload_ref else None)

        if clothing_uuid and not target_url:
            clothing_item = db.query(Clothing).filter(Clothing.id == clothing_uuid).first()
            if clothing_item and clothing_item.image_url:
                target_url = clothing_item.image_url

        if target_url:
            try:
                resp = httpx.get(target_url, timeout=10.0)
                if resp.status_code == 200:
                    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
            except Exception as e:
                logger.warning(f"[Worker] Could not download image from '{target_url}': {e}. Using neutral fallback.")

        if img is None:
            img = Image.new("RGB", (300, 300), color=(240, 235, 230))

        # Execute AI classification
        analysis_result = clothing_classifier.predict(img)

        # Update clothing_analysis if clothing_uuid present
        if clothing_uuid:
            existing_analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing_uuid).first()
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
                    clothing_id=clothing_uuid,
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

        if job:
            job.status = "completed"
            job.result = analysis_result
            job.error_message = None
            db.commit()

        dur = round(time.time() - t0, 2)
        logger.info(f"[Worker:Completed] Analysis job_id={job_id} in {dur}s")
        return analysis_result

    except Exception as e:
        dur = round(time.time() - t0, 2)
        logger.exception(f"[Worker:Failed] Analysis job_id={job_id} failed after {dur}s: {e}")
        try:
            db.rollback()
            if job_uuid:
                job = db.query(BackgroundJob).filter(BackgroundJob.id == job_uuid).first()
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


def process_garment_image_job(
    job_id: str,
    user_id: str,
    clothing_id: str,
    db: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Durable, idempotent background task for end-to-end garment image segmentation and catalog generation.
    Handles concurrency control, duplicate delivery prevention, and stale job recovery.
    """
    t0 = time.time()
    worker_run_id = str(uuid.uuid4())[:8]
    logger.info(f"[Worker:Received] Garment job_id={job_id}, user_id={user_id}, clothing_id={clothing_id}")

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    lock_acquired = False
    lock_key = f"lock:garment_proc:{clothing_id}"
    rq_redis = None

    try:
        job_uuid = _parse_uuid_safe(job_id)
        user_uuid = _parse_uuid_safe(user_id)
        clothing_uuid = _parse_uuid_safe(clothing_id)

        if not user_uuid or not clothing_uuid:
            logger.error(f"[Worker:Failed] Invalid UUIDs for job {job_id}: user={user_id}, clothing={clothing_id}")
            return {"status": "failed", "error": "Invalid user_id or clothing_id"}

        # 1. Concurrency control: prevent duplicate workers from processing the same garment concurrently
        try:
            rq_redis = get_rq_redis_client()
            if rq_redis is not None:
                # Set lock with 180s TTL
                acquired = rq_redis.set(lock_key, worker_run_id, nx=True, ex=180)
                if not acquired:
                    # Lock held by another worker - check if stale (>300s)
                    existing_lock = rq_redis.get(lock_key)
                    clothing_item = db.query(Clothing).filter(Clothing.id == clothing_uuid).first()
                    is_stale = False
                    if clothing_item and clothing_item.analysis:
                        fv = clothing_item.analysis.feature_vector or {}
                        claimed_at_str = fv.get("processing_claimed_at")
                        if claimed_at_str:
                            from datetime import datetime, timezone
                            try:
                                claimed_time = datetime.fromisoformat(claimed_at_str)
                                if (datetime.now(timezone.utc) - claimed_time).total_seconds() > 300:
                                    is_stale = True
                            except Exception:
                                pass

                    if is_stale:
                        logger.warning(f"[Worker:StaleRecovery] Stale lock detected for clothing {clothing_id}. Reclaiming.")
                        rq_redis.set(lock_key, worker_run_id, ex=180)
                        lock_acquired = True
                    else:
                        logger.info(f"[Worker:DuplicateSkipped] Clothing {clothing_id} is already actively being processed by another worker ({existing_lock}).")
                        return {"status": "already_processing", "clothing_id": str(clothing_uuid)}
                else:
                    lock_acquired = True
        except Exception as lock_err:
            logger.warning(f"[Worker] Redis concurrency lock check encountered error ({lock_err}). Proceeding with DB guards.")

        # 2. Idempotency check: if garment is already ready_for_review and processed image exists in Neon BYTEA
        clothing = db.query(Clothing).filter(Clothing.id == clothing_uuid).first()
        if clothing:
            img_svc = ClothingImageService(db)
            existing_proc_img = img_svc.get_image(clothing_uuid, user_uuid, "processed")
            if existing_proc_img and clothing.processing_status in ("ready_for_review", "completed"):
                logger.info(f"[Worker:Idempotent] Garment {clothing_id} already successfully processed and verified in Neon. Returning cached state.")
                return {
                    "status": clothing.processing_status,
                    "stage": clothing.processing_stage,
                    "cached": True,
                    "duration_seconds": clothing.processing_duration,
                }

        # 3. Handle BackgroundJob status if table exists
        job = None
        if job_uuid:
            try:
                from sqlalchemy import inspect
                if "background_jobs" in inspect(db.bind).get_table_names():
                    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_uuid).first()
            except Exception:
                job = None

        if job:
            if job.user_id != user_uuid:
                logger.error(f"[Worker:Unauthorized] Ownership mismatch for job {job_id}")
                job.status = "failed"
                job.error_message = "Unauthorized: ownership mismatch"
                db.commit()
                return {"error": "Unauthorized"}

            job.status = "processing"
            job.retry_count = (job.retry_count or 0) + 1
            db.commit()

        logger.info(f"[Worker:Started] Garment processing job_id={job_id}, clothing_id={clothing_id}")

        # 4. Run end-to-end garment processing pipeline
        from app.services.clothing_processing_service import ClothingProcessingService
        processor = ClothingProcessingService(db)
        result = processor.process_clothing_item(clothing_id=clothing_uuid, user_id=user_uuid)

        dur = round(time.time() - t0, 2)
        if job:
            try:
                if result.get("status") in ("completed", "ready_for_review"):
                    job.status = "completed"
                    job.result = result
                    job.error_message = None
                else:
                    job.status = "failed"
                    job.error_message = result.get("error", "Garment processing failed")
                    job.result = result
                db.commit()
            except Exception as jup_err:
                logger.warning(f"Could not update BackgroundJob status: {jup_err}")

        logger.info(f"[Worker:Completed] Garment job_id={job_id}, clothing_id={clothing_id} finished in {dur}s with status '{result.get('status')}'.")
        return result

    except Exception as e:
        dur = round(time.time() - t0, 2)
        logger.exception(f"[Worker:Failed] Error processing garment job {job_id} after {dur}s: {e}")
        try:
            db.rollback()
            if job_uuid:
                from sqlalchemy import inspect
                if "background_jobs" in inspect(db.bind).get_table_names():
                    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_uuid).first()
                    if job:
                        job.status = "failed"
                        job.error_message = str(e)
                        db.commit()
        except Exception:
            pass
        raise
    finally:
        # Release concurrency lock
        if lock_acquired and rq_redis is not None:
            try:
                curr_lock = rq_redis.get(lock_key)
                if curr_lock == worker_run_id or curr_lock == worker_run_id.encode():
                    rq_redis.delete(lock_key)
            except Exception:
                pass
        if should_close:
            db.close()
