import logging
from typing import Optional, Dict, Any, List
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from rq import Queue, Retry

from app.core.config import settings
from app.core.redis import get_redis_client
from app.models.background_job import BackgroundJob
from app.jobs.clothing_jobs import process_clothing_analysis_job

logger = logging.getLogger(__name__)

DEFAULT_QUEUE_NAME = "stylesphere-default"


class JobService:
    def __init__(self, db: Session):
        self.db = db

    def enqueue_clothing_analysis(
        self,
        user_id: UUID,
        image_url: Optional[str] = None,
        clothing_id: Optional[UUID] = None,
    ) -> BackgroundJob:
        """
        Durable job creation:
        1. Persists JobRecord in PostgreSQL with 'queued' status.
        2. Enqueues job into Redis with bounded retries & backoff interval.
        3. If Redis is disabled/offline, executes in fallback mode to ensure zero downtime.
        """
        # 1. Persist durable job record in PostgreSQL
        payload_ref = {}
        if image_url:
            payload_ref["image_url"] = image_url
        if clothing_id:
            payload_ref["clothing_id"] = str(clothing_id)

        job = BackgroundJob(
            user_id=user_id,
            job_type="clothing_analysis",
            status="queued",
            payload_ref=payload_ref,
            retry_count=0,
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        job_id_str = str(job.id)
        user_id_str = str(user_id)
        clothing_id_str = str(clothing_id) if clothing_id else None

        # 2. Enqueue in Redis
        redis_client = get_redis_client() if settings.REDIS_ENABLED else None

        if redis_client is not None:
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
                logger.info(f"Enqueued job {job_id_str} into RQ queue '{DEFAULT_QUEUE_NAME}'.")
                return job
            except Exception as e:
                logger.warning(f"Failed to enqueue job {job_id_str} into Redis ({e}). Running in-process fallback.")

        # 3. Fallback execution (when Redis is disabled or offline)
        try:
            logger.info(f"Executing job {job_id_str} synchronously via fallback.")
            result = process_clothing_analysis_job(
                job_id=job_id_str,
                user_id=user_id_str,
                image_url=image_url,
                clothing_id=clothing_id_str,
                db=self.db,
            )
            self.db.refresh(job)
            return job
        except Exception as e:
            logger.error(f"Fallback job execution error for {job_id_str}: {e}")
            job.status = "failed"
            job.error_message = str(e)
            self.db.commit()
            return job

    def get_job_status(self, job_id: UUID, user_id: UUID) -> BackgroundJob:
        """Fetch job record from PostgreSQL with strict user ownership authorization."""
        job = self.db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        if job.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this job")
        return job

    def list_jobs_for_user(self, user_id: UUID, limit: int = 20) -> List[BackgroundJob]:
        """List user's recent background jobs."""
        return (
            self.db.query(BackgroundJob)
            .filter(BackgroundJob.user_id == user_id)
            .order_by(BackgroundJob.created_at.desc())
            .limit(limit)
            .all()
        )

