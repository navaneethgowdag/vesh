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

# In-memory job cache for robust background job tracking
_IN_MEMORY_JOBS: Dict[str, BackgroundJob] = {}


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
        _IN_MEMORY_JOBS[str(job_id)] = job
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

        # 2. Enqueue directly to RQ queue 'stylesphere-default'
        redis_client = get_rq_redis_client() if settings.REDIS_ENABLED else None
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
                logger.info(f"[JobService:Enqueued] job_id={job_id_str}, type=clothing_analysis into queue='{DEFAULT_QUEUE_NAME}'")
                return job
            except Exception as e:
                logger.warning(f"[JobService] Failed to enqueue job {job_id_str} into Redis ({e}).")

        # 3. Fallback execution (when Redis is disabled/offline)
        allow_fallback = (
            getattr(settings, "ALLOW_BACKGROUND_THREAD_FALLBACK", False)
            or settings.APP_ENV.lower() not in ("production", "prod")
        )
        if not allow_fallback:
            err_msg = "Redis/RQ queue broker unavailable. Background job cannot be durably queued."
            logger.error(f"[JobService:EnqueueFailed] {err_msg} job_id={job_id_str}")
            job.status = "failed"
            job.error_message = err_msg
            if self._has_table:
                try:
                    self.db.commit()
                except Exception:
                    pass
            return job

        try:
            logger.info(f"[JobService] [DevFallback] Executing analysis job {job_id_str} synchronously via in-process fallback.")
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
        batch_id: Optional[UUID] = None,
        sequence_order: int = 0,
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
        if batch_id:
            payload_ref["batch_id"] = str(batch_id)
            payload_ref["sequence_order"] = sequence_order
        job = BackgroundJob(
            id=job_id,
            user_id=user_id,
            job_type="garment_processing",
            status="queued",
            payload_ref=payload_ref,
            retry_count=0,
        )
        _IN_MEMORY_JOBS[str(job_id)] = job
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

        # 1. Enqueue directly to RQ queue 'stylesphere-default'
        redis_client = get_rq_redis_client() if settings.REDIS_ENABLED else None
        if redis_client is not None:
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
                logger.warning(f"[JobService] Failed to enqueue job {job_id_str} into Redis ({e}).")

        # 2. If Redis/RQ unavailable:
        allow_fallback = (
            getattr(settings, "ALLOW_BACKGROUND_THREAD_FALLBACK", False)
            or settings.APP_ENV.lower() not in ("production", "prod")
        )

        if not allow_fallback:
            err_msg = "Redis/RQ queue broker unavailable. Background job cannot be durably queued."
            logger.error(f"[JobService:EnqueueFailed] {err_msg} job_id={job_id_str}, clothing_id={clothing_id_str}")
            job.status = "failed"
            job.error_message = err_msg
            if self._has_table:
                try:
                    self.db.commit()
                except Exception:
                    pass
            try:
                clothing_item = self.db.query(Clothing).filter(Clothing.id == clothing_id).first()
                if clothing_item and clothing_item.analysis:
                    fv = dict(clothing_item.analysis.feature_vector or {})
                    fv["processing_status"] = "failed"
                    fv["processing_stage"] = "enqueue_failed"
                    fv["error_message"] = err_msg
                    clothing_item.analysis.feature_vector = fv
                    self.db.commit()
            except Exception as ce:
                logger.warning(f"Failed to update clothing error status: {ce}")
            return job

        # 3. Development only fallback
        def _run_worker():
            try:
                logger.info(f"[JobService] [DevFallback] Executing garment job {job_id_str} via background daemon thread (clothing_id={clothing_id_str}).")
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

    def enqueue_training_job(
        self,
        user_id: UUID,
        training_config: Optional[Dict[str, Any]] = None,
    ) -> BackgroundJob:
        """
        Durable training job creation:
        1. Persists BackgroundJob with job_type='model_training' and status='queued'.
        2. Enqueues job to Redis queue if workers active.
        3. If Redis/RQ is offline or unavailable, runs in dedicated background thread.
        """
        from app.jobs.training_jobs import execute_personal_training_job

        job_id = uuid.uuid4()
        config = training_config or {}

        job = BackgroundJob(
            id=job_id,
            user_id=user_id,
            job_type="model_training",
            status="queued",
            payload_ref={"config": config, "logs": []},
            retry_count=0,
        )
        _IN_MEMORY_JOBS[str(job_id)] = job
        if self._has_table:
            try:
                self.db.add(job)
                self.db.commit()
                self.db.refresh(job)
            except Exception as e:
                logger.warning(f"Could not persist model_training job to DB: {e}")
                self.db.rollback()

        job_id_str = str(job_id)
        user_id_str = str(user_id)

        # Attempt Redis RQ enqueue
        enqueued_to_redis = False
        try:
            r = get_rq_redis_client()
            if r is not None:
                q = Queue(DEFAULT_QUEUE_NAME, connection=r)
                q.enqueue(
                    execute_personal_training_job,
                    job_id=job_id_str,
                    user_id=user_id_str,
                    training_config=config,
                    job_timeout=1800,  # 30 minute timeout
                )
                enqueued_to_redis = True
                logger.info(f"[JobService:TrainingEnqueued] job_id={job_id_str} to Redis queue '{DEFAULT_QUEUE_NAME}'")
        except Exception as redis_exc:
            logger.warning(f"[JobService] Redis enqueue unavailable for training ({redis_exc}). Falling back to thread.")

        if not enqueued_to_redis:
            # Fallback daemon background thread
            def _run_training_worker():
                try:
                    execute_personal_training_job(
                        job_id=job_id_str,
                        user_id=user_id_str,
                        training_config=config,
                    )
                except Exception as exc:
                    logger.error(f"[JobService] Training thread error for {job_id_str}: {exc}")

            t = threading.Thread(
                target=_run_training_worker,
                name=f"train-job-{job_id_str[:8]}",
                daemon=True,
            )
            t.start()
            logger.info(f"[JobService:StartedTrainingThread] job_id={job_id_str}")

        return job

    def get_job_status(self, job_id: UUID, user_id: UUID) -> Optional[BackgroundJob]:
        """Fetch job record from PostgreSQL with strict user ownership authorization."""
        if not self._has_table:
            job = _IN_MEMORY_JOBS.get(str(job_id))
            if not job:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
            if job.user_id != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this job")
            return job
        try:
            job = self.db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
            if not job:
                job = _IN_MEMORY_JOBS.get(str(job_id))
            if not job:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
            if job.user_id != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this job")
            return job
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Database error querying BackgroundJob: {e}")
            job = _IN_MEMORY_JOBS.get(str(job_id))
            if job and job.user_id == user_id:
                return job
            return None

    def list_jobs_for_user(self, user_id: UUID, limit: int = 20) -> List[BackgroundJob]:
        """List user's recent background jobs."""
        if not self._has_table:
            return [j for j in _IN_MEMORY_JOBS.values() if j.user_id == user_id][:limit]
        try:
            db_jobs = (
                self.db.query(BackgroundJob)
                .filter(BackgroundJob.user_id == user_id)
                .order_by(BackgroundJob.created_at.desc())
                .limit(limit)
                .all()
            )
            if db_jobs:
                return db_jobs
            return [j for j in _IN_MEMORY_JOBS.values() if j.user_id == user_id][:limit]
        except Exception as e:
            logger.warning(f"Database error querying BackgroundJob list: {e}")
            return [j for j in _IN_MEMORY_JOBS.values() if j.user_id == user_id][:limit]

    def list_jobs(
        self,
        user_id: Optional[UUID] = None,
        job_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[BackgroundJob]:
        """List background jobs with optional filtering by user, job_type, and status."""
        jobs: List[BackgroundJob] = []
        if self._has_table:
            try:
                q = self.db.query(BackgroundJob)
                if user_id:
                    q = q.filter(BackgroundJob.user_id == user_id)
                if job_type:
                    q = q.filter(BackgroundJob.job_type == job_type)
                if status:
                    q = q.filter(BackgroundJob.status == status)
                jobs = q.order_by(BackgroundJob.created_at.desc()).limit(limit).all()
            except Exception as e:
                logger.warning(f"Database error querying BackgroundJob list_jobs: {e}")

        mem_jobs = list(_IN_MEMORY_JOBS.values())
        if user_id:
            mem_jobs = [j for j in mem_jobs if j.user_id == user_id]
        if job_type:
            mem_jobs = [j for j in mem_jobs if j.job_type == job_type]
        if status:
            mem_jobs = [j for j in mem_jobs if j.status == status]

        existing_ids = {str(j.id) for j in jobs}
        for mj in mem_jobs:
            if str(mj.id) not in existing_ids:
                jobs.append(mj)

        return sorted(jobs, key=lambda x: str(getattr(x, "created_at", "")) or "", reverse=True)[:limit]

    def get_job(self, job_id: Any) -> Optional[BackgroundJob]:
        """Fetch job record by ID (UUID or str) without user restriction (for admin inspection)."""
        job = None
        jid_str = str(job_id)
        if self._has_table:
            try:
                job = self.db.query(BackgroundJob).filter(BackgroundJob.id == jid_str).first()
            except Exception:
                try:
                    import uuid
                    uid = uuid.UUID(jid_str) if isinstance(jid_str, str) else job_id
                    job = self.db.query(BackgroundJob).filter(BackgroundJob.id == uid).first()
                except Exception as e:
                    logger.warning(f"Database error querying BackgroundJob by ID: {e}")
        if not job:
            job = _IN_MEMORY_JOBS.get(jid_str)
        return job

    def get_job_by_id(self, job_id: Any) -> Optional[BackgroundJob]:
        return self.get_job(job_id)
