import logging
import threading
import uuid
from typing import Optional, Dict, Any, List
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from rq import Queue, Retry, Worker

from app.core.config import settings
from app.core.redis import get_rq_redis_client
from app.models.background_job import BackgroundJob
from app.jobs.clothing_jobs import process_clothing_analysis_job, process_garment_image_job

logger = logging.getLogger(__name__)

DEFAULT_QUEUE_NAME = "stylesphere-default"


class JobService:
    def __init__(self, db: Session):
        self.db = db
        self._has_table = self._check_table_exists()

    def _check_table_exists(self) -> bool:
        try:
            from sqlalchemy import inspect
            insp = inspect(self.db.bind)
            return "background_jobs" in insp.get_table_names()
        except Exception:
            return False

    def enqueue_clothing_analysis(
        self,
        user_id: UUID,
        image_url: Optional[str] = None,
        clothing_id: Optional[UUID] = None,
    ) -> BackgroundJob:
        """
        Durable job creation:
        1. Persists JobRecord in PostgreSQL with 'queued' status.
        2. Enqueues job into Redis with bounded retries & backoff interval if workers are active.
        3. If Redis is disabled/offline or no workers are active, executes in fallback mode to ensure zero downtime.
        """
        job_id = uuid.uuid4()
        payload_ref = {}
        if image_url:
            payload_ref["image_url"] = image_url
        if clothing_id:
            payload_ref["clothing_id"] = str(clothing_id)

        job = BackgroundJob(
            id=job_id,
            user_id=user_id,
            job_type="clothing_analysis",
            status="queued",
            payload_ref=payload_ref,
            retry_count=0,
        )
        if self._has_table:
            try:
                self.db.add(job)
                self.db.commit()
                self.db.refresh(job)
            except Exception as dbe:
                logger.warning(f"Could not persist background job record: {dbe}")
                self.db.rollback()

        job_id_str = str(job_id)
        user_id_str = str(user_id)
        clothing_id_str = str(clothing_id) if clothing_id else None

        # 2. Check for active RQ workers on stylesphere-default
        redis_client = get_rq_redis_client() if settings.REDIS_ENABLED else None
        has_active_workers = False
        if redis_client is not None:
            try:
                workers = Worker.all(connection=redis_client)
                for w in workers:
                    if any(q.name == DEFAULT_QUEUE_NAME for q in w.queues):
                        has_active_workers = True
                        break
            except Exception as we:
                logger.warning(f"Failed to inspect active RQ workers: {we}")

        if redis_client is not None and has_active_workers:
            try:
                q = Queue(DEFAULT_QUEUE_NAME, connection=redis_client)
                q.enqueue(
                    process_clothing_analysis_job,
                    job_id_str,
                    user_id_str,
                    image_url,
                    clothing_id=clothing_id_str,
                    job_id=job_id_str,
                    retry=Retry(max=3, interval=[5, 25, 120]),
                    job_timeout=180,
                )
                logger.info(f"[JobService:Enqueued] job_id={job_id_str}, type=clothing_analysis into queue='{DEFAULT_QUEUE_NAME}'")
                return job
            except Exception as e:
                logger.warning(f"[JobService] Failed to enqueue job {job_id_str} into Redis ({e}). Running in-process fallback.")

        # 3. Fallback execution (when Redis is disabled, offline, or no worker active)
        try:
            logger.info(f"[JobService] Executing analysis job {job_id_str} synchronously via in-process fallback.")
            process_clothing_analysis_job(
                job_id=job_id_str,
                user_id=user_id_str,
                image_url=image_url,
                clothing_id=clothing_id_str,
                db=self.db,
            )
            if self._has_table:
                try:
                    self.db.refresh(job)
                except Exception:
                    pass
            return job
        except Exception as e:
            logger.error(f"[JobService] Fallback job execution error for {job_id_str}: {e}")
            job.status = "failed"
            job.error_message = str(e)
            if self._has_table:
                try:
                    self.db.commit()
                except Exception:
                    pass
            return job

    def enqueue_garment_processing(
        self,
        user_id: UUID,
        clothing_id: UUID,
    ) -> BackgroundJob:
        """
        Durable job creation for garment segmentation and catalog generation:
        1. Persists JobRecord in PostgreSQL with 'queued' status.
        2. Enqueues job into Redis with bounded retries & backoff if workers are active.
        3. If Redis is disabled/offline or no workers are active, runs in background thread
           to return immediate HTTP response without blocking and prevent stuck jobs.
        """
        job_id = uuid.uuid4()
        payload_ref = {"clothing_id": str(clothing_id)}
        job = BackgroundJob(
            id=job_id,
            user_id=user_id,
            job_type="garment_processing",
            status="queued",
            payload_ref=payload_ref,
            retry_count=0,
        )
        if self._has_table:
            try:
                self.db.add(job)
                self.db.commit()
                self.db.refresh(job)
            except Exception as dbe:
                logger.warning(f"Could not persist background job record: {dbe}")
                self.db.rollback()

        job_id_str = str(job_id)
        user_id_str = str(user_id)
        clothing_id_str = str(clothing_id)

        # 1. Check for active RQ workers on stylesphere-default
        redis_client = get_rq_redis_client() if settings.REDIS_ENABLED else None
        has_active_workers = False
        if redis_client is not None:
            try:
                workers = Worker.all(connection=redis_client)
                for w in workers:
                    if any(q.name == DEFAULT_QUEUE_NAME for q in w.queues):
                        has_active_workers = True
                        break
            except Exception as we:
                logger.warning(f"Failed to inspect active RQ workers: {we}")

        if redis_client is not None and has_active_workers:
            try:
                q = Queue(DEFAULT_QUEUE_NAME, connection=redis_client)
                q.enqueue(
                    process_garment_image_job,
                    job_id_str,
                    user_id_str,
                    clothing_id_str,
                    job_id=job_id_str,
                    retry=Retry(max=2, interval=[5, 20]),
                    job_timeout=180,
                )
                logger.info(f"[JobService:Enqueued] job_id={job_id_str}, clothing_id={clothing_id_str} into RQ queue '{DEFAULT_QUEUE_NAME}'")
                return job
            except Exception as e:
                logger.warning(f"[JobService] Failed to enqueue job {job_id_str} into Redis ({e}). Spawning async background thread.")

        # 2. Non-blocking asynchronous background thread fallback (when Redis disabled or 0 active workers)
        def _run_worker():
            try:
                logger.info(f"[JobService] Executing garment job {job_id_str} via background daemon thread (clothing_id={clothing_id_str}).")
                process_garment_image_job(
                    job_id=job_id_str,
                    user_id=user_id_str,
                    clothing_id=clothing_id_str,
                )
            except Exception as exc:
                logger.error(f"[JobService] Background thread execution error for {job_id_str}: {exc}")

        worker_thread = threading.Thread(
            target=_run_worker,
            name=f"garment-proc-{job_id_str[:8]}",
            daemon=True,
        )
        worker_thread.start()
        logger.info(f"[JobService:StartedFallbackThread] job_id={job_id_str}, clothing_id={clothing_id_str}")
        return job

    def get_job_status(self, job_id: UUID, user_id: UUID) -> Optional[BackgroundJob]:
        """Fetch job record from PostgreSQL with strict user ownership authorization."""
        if not self._has_table:
            return None
        try:
            job = self.db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
            if not job:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
            if job.user_id != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this job")
            return job
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Database error querying BackgroundJob: {e}")
            return None

    def list_jobs_for_user(self, user_id: UUID, limit: int = 20) -> List[BackgroundJob]:
        """List user's recent background jobs."""
        if not self._has_table:
            return []
        try:
            return (
                self.db.query(BackgroundJob)
                .filter(BackgroundJob.user_id == user_id)
                .order_by(BackgroundJob.created_at.desc())
                .limit(limit)
                .all()
            )
        except Exception as e:
            logger.warning(f"Database error querying BackgroundJob list: {e}")
            return []
