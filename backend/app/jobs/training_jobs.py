"""
Background worker jobs for Personal Model Learning fine-tuning and evaluation pipeline.
Durable, idempotent execution supporting Redis/RQ workers or daemon background thread fallback.
Zero image bytes passed inside Redis jobs; only job IDs, dataset IDs, and metadata references.
"""

import time
import logging
import traceback
from typing import Dict, Any, Optional
from uuid import UUID

from app.core.database import SessionLocal
from app.models.background_job import BackgroundJob
from app.services.training_dataset_service import training_dataset_service
from app.services.model_training_service import model_training_service
from app.services.model_evaluation_service import model_evaluation_service
from app.services.model_version_service import model_version_service

logger = logging.getLogger(__name__)


def _parse_uuid_safe(val: Any) -> Optional[UUID]:
    if not val or val == "None":
        return None
    try:
        return UUID(str(val))
    except (ValueError, TypeError):
        return None


def execute_personal_training_job(
    job_id: str,
    user_id: str,
    training_config: Optional[Dict[str, Any]] = None,
    db: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Durable, isolated background job executing the personal model fine-tuning pipeline:
    1. Dataset preparation and validation.
    2. Multi-Task fine-tuning on candidate checkpoint.
    3. Evaluation against production model on held-out test split.
    4. Registration of candidate model version.
    5. Updates BackgroundJob with full logs and metrics.
    """
    t0 = time.time()
    logger.info(f"[TrainingJob:Received] job_id={job_id}, user_id={user_id}")

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    job_uuid = _parse_uuid_safe(job_id)
    user_uuid = _parse_uuid_safe(user_id)

    job = None
    if job_uuid:
        try:
            from sqlalchemy import inspect
            if "background_jobs" in inspect(db.bind).get_table_names():
                job = db.query(BackgroundJob).filter(BackgroundJob.id == job_uuid).first()
        except Exception:
            job = None

    if job:
        job.status = "processing"
        job.retry_count = (job.retry_count or 0) + 1
        db.commit()

    logs = []

    def log(msg: str):
        elapsed = round(time.time() - t0, 1)
        entry = f"[{elapsed}s] {msg}"
        logs.append(entry)
        logger.info(f"[TrainingJob:{job_id}] {msg}")
        if job:
            try:
                payload = dict(job.payload_ref or {})
                payload["logs"] = logs[-50:]
                job.payload_ref = payload
                db.commit()
            except Exception:
                pass

    try:
        log("Acquiring personal training lock...")
        if not model_training_service.acquire_lock():
            raise RuntimeError("Another model training job is currently running. Please wait for it to complete.")

        log("Step 1/4: Preparing and validating personal dataset...")
        config = training_config or {}
        val_split = float(config.get("val_split", 0.15))
        test_split = float(config.get("test_split", 0.15))
        seed = int(config.get("random_seed", 42))

        dataset_res = training_dataset_service.prepare_dataset(
            db=db,
            user_id=user_uuid,
            val_split=val_split,
            test_split=test_split,
            random_seed=seed,
        )

        if not dataset_res.get("success"):
            raise ValueError(dataset_res.get("message", "Dataset preparation failed."))

        log(f"Dataset ready: {dataset_res['total_samples']} samples (Train: {dataset_res['train_samples']}, Val: {dataset_res['val_samples']}, Test: {dataset_res['test_samples']})")

        # Load dataset manifest
        manifest_path = dataset_res["manifest_path"]
        import json
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest_data = json.load(f)

        log("Step 2/4: Fine-tuning candidate MultiTask EfficientNet-B0 model...")
        train_res = model_training_service.train_candidate_model(
            db=db,
            user_id=user_uuid,
            dataset_manifest=manifest_data,
            training_config=config,
            progress_callback=lambda p: log(f"Epoch {p['epoch']}/{p['total_epochs']} - train_loss: {p['train_loss']}, val_loss: {p['val_loss']}"),
        )

        log(f"Training completed in {train_res['duration_seconds']}s. Best val loss: {train_res['best_val_loss']}")

        log("Step 3/4: Evaluating candidate vs active production model on held-out test split...")
        prod_ckpt, prod_version = model_training_service.get_current_production_checkpoint()

        test_records = manifest_data.get("test", [])
        comparison = model_evaluation_service.compare_models(
            candidate_checkpoint=train_res["checkpoint_path"],
            production_checkpoint=prod_ckpt,
            test_records=test_records,
            db=db,
        )

        log(f"Evaluation complete. Promotion eligible: {comparison['promotion_eligible']}. {comparison['eligibility_summary']}")

        log("Step 4/4: Registering candidate model version...")
        eval_payload = {
            "comparison": comparison,
            "training_history": train_res["training_history"],
            "best_val_loss": train_res["best_val_loss"],
            "dataset_counts": dataset_res,
        }

        registered = model_version_service.register_candidate_version(
            db=db,
            user_id=user_uuid,
            version_tag=train_res["candidate_version"],
            checkpoint_path=train_res["checkpoint_path"],
            base_version=train_res["base_version"],
            training_config=config,
            evaluation_metrics=eval_payload,
            dataset_manifest_path=manifest_path,
        )

        total_dur = round(time.time() - t0, 2)
        log(f"Personal training job finished successfully in {total_dur}s. Candidate version: {train_res['candidate_version']}.")

        final_result = {
            "status": "completed",
            "candidate_version": train_res["candidate_version"],
            "base_version": train_res["base_version"],
            "checkpoint_path": train_res["checkpoint_path"],
            "duration_seconds": total_dur,
            "promotion_eligible": comparison["promotion_eligible"],
            "comparison": comparison,
            "logs": logs,
        }

        if job:
            job.status = "completed"
            job.result = final_result
            job.error_message = None
            db.commit()

        return final_result

    except Exception as e:
        err_msg = str(e)
        logger.exception(f"[TrainingJob:Failed] Error executing training job {job_id}: {err_msg}")
        log(f"Training failed: {err_msg}")
        if job:
            job.status = "failed"
            job.error_message = err_msg
            job.result = {"error": err_msg, "logs": logs}
            db.commit()
        return {"status": "failed", "error": err_msg, "logs": logs}

    finally:
        model_training_service.release_lock()
        if should_close and db:
            db.close()
