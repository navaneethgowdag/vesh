"""
Personal Model Learning API Routes.
Exposes endpoints for the single-user personal classifier improvement pipeline:
- Wardrobe dataset statistics and class coverage
- Starting background fine-tuning jobs and streaming live logs
- Candidate vs production model comparison
- Explicit candidate promotion and production rollback
- Garment attribute review (accepted, corrected, unconfirmed) and training eligibility controls
"""

from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.clothing import Clothing
from app.models.background_job import BackgroundJob
from app.api.deps import get_current_user
from app.services.training_dataset_service import training_dataset_service
from app.services.model_training_service import model_training_service
from app.services.model_version_service import model_version_service
from app.services.clothing_review_service import clothing_review_service
from app.services.job_service import JobService

router = APIRouter(prefix="/model-learning", tags=["Model Learning"])


# --- Schemas ---

class TrainingConfigRequest(BaseModel):
    learning_rate: float = Field(default=1e-4, ge=1e-6, le=1e-2)
    batch_size: int = Field(default=16, ge=1, le=128)
    epochs: int = Field(default=5, ge=1, le=50)
    val_split: float = Field(default=0.15, ge=0.05, le=0.4)
    test_split: float = Field(default=0.15, ge=0.05, le=0.4)
    random_seed: int = Field(default=42)


class TrainingEligibilityToggleRequest(BaseModel):
    exclude_from_training: bool


class AttributeReviewSubmissionRequest(BaseModel):
    attribute_decisions: Dict[str, Any] = Field(
        ...,
        description="Map of head name to decision string or {'status': 'accepted'|'corrected'|'unconfirmed', 'value': str}",
    )
    name: Optional[str] = None
    exclude_from_training: Optional[bool] = None
    finalize: bool = True
    vault_updates: Optional[Dict[str, Any]] = None


class BatchReviewRequest(BaseModel):
    reviews: List[Dict[str, Any]]


class PromoteCandidateRequest(BaseModel):
    confirm: bool = Field(..., description="Explicit confirmation required to promote candidate model")


class RollbackRequest(BaseModel):
    confirm: bool = Field(..., description="Explicit confirmation required to roll back production model")
    target_version: Optional[str] = None


# --- Endpoints ---

@router.get("/stats")
def get_dataset_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve real wardrobe dataset statistics:
    total reviewed garments, eligible training samples, accepted vs corrected counts,
    unconfirmed counts, class breakdown per head, and readiness feedback.
    """
    return training_dataset_service.get_dataset_statistics(db, current_user.id)


@router.get("/classes")
def get_class_coverage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve sample counts for all classes across all 9 heads and identify
    classes with insufficient samples (< 3) for reliable evaluation.
    """
    stats = training_dataset_service.get_dataset_statistics(db, current_user.id)
    return {
        "class_counts_per_head": stats["class_counts_per_head"],
        "insufficiently_represented_classes": stats["insufficiently_represented_classes"],
        "well_represented_classes": stats["well_represented_classes"],
    }


@router.post("/training/start")
def start_training_job(
    request: Optional[TrainingConfigRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a background fine-tuning job using the owner's reviewed garments.
    Guarantees concurrency locking to prevent overlapping training runs.
    """
    # Quick check if dataset is ready
    stats = training_dataset_service.get_dataset_statistics(db, current_user.id)
    if stats["total_eligible_training_examples"] == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start training: 0 eligible garments available. Review and accept garments in your wardrobe first.",
        )

    config_dict = request.model_dump() if request else {}
    job_service = JobService(db)
    job = job_service.enqueue_training_job(current_user.id, config_dict)

    return {
        "job_id": str(job.id),
        "status": job.status,
        "message": "Model training job queued successfully in background.",
    }


@router.get("/training/jobs")
def list_training_jobs(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent personal model training jobs and statuses."""
    jobs = (
        db.query(BackgroundJob)
        .filter(
            BackgroundJob.user_id == current_user.id,
            BackgroundJob.job_type == "model_training",
        )
        .order_by(BackgroundJob.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": str(j.id),
            "status": j.status,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "updated_at": j.updated_at.isoformat() if j.updated_at else None,
            "error_message": j.error_message,
            "result": j.result,
            "logs": (j.payload_ref or {}).get("logs", []) if isinstance(j.payload_ref, dict) else [],
        }
        for j in jobs
    ]


@router.get("/training/jobs/{job_id}")
def get_training_job_status(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details and live training logs for a training job."""
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this job")

    logs = (job.payload_ref or {}).get("logs", []) if isinstance(job.payload_ref, dict) else []
    return {
        "id": str(job.id),
        "status": job.status,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        "error_message": job.error_message,
        "result": job.result,
        "logs": logs,
    }


@router.get("/versions")
def list_model_versions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all candidate and production model versions."""
    return model_version_service.list_versions(db, current_user.id)


@router.get("/comparison")
def get_model_comparison(
    candidate_version: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compare candidate model against active production model side-by-side:
    per-head accuracy, macro F1, test sample count, and promotion eligibility.
    """
    return model_version_service.get_model_comparison(db, current_user.id, candidate_version)


@router.post("/versions/{version_tag}/promote")
def promote_candidate_version(
    version_tag: str,
    request: PromoteCandidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Explicitly promote candidate model to active production.
    Requires confirm=True. Hot-reloads live inference service.
    """
    if not request.confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Explicit confirmation required.")
    return model_version_service.promote_candidate(db, current_user.id, version_tag)


@router.post("/versions/{version_tag}/reject")
def reject_candidate_version(
    version_tag: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject candidate model version."""
    return model_version_service.reject_candidate(db, current_user.id, version_tag)


@router.post("/rollback")
def rollback_production_model(
    request: RollbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Roll back active production model to previous production checkpoint or baseline v1.0.0.
    Requires confirm=True. Hot-reloads live inference service.
    """
    if not request.confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Explicit confirmation required.")
    return model_version_service.rollback_production(db, current_user.id, request.target_version)


# --- Clothing Review & Training Eligibility Endpoints ---

@router.get("/clothing/{item_id}/review-details")
def get_clothing_review_details(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full review details for a single clothing item."""
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return clothing_review_service.get_review_details(db, clothing, current_user.id)


@router.post("/clothing/{item_id}/review")
def submit_clothing_review(
    item_id: UUID,
    request: AttributeReviewSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit attribute review for clothing item:
    tracks accepted, corrected, and unconfirmed attributes separately.
    Does not overwrite original AI predictions.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return clothing_review_service.submit_attribute_review(
        db=db,
        clothing=clothing,
        user_id=current_user.id,
        attribute_decisions=request.attribute_decisions,
        exclude_from_training=request.exclude_from_training,
        finalize=request.finalize,
        vault_updates=request.vault_updates,
        garment_name=request.name,
    )


@router.post("/clothing/batch-review")
def batch_submit_clothing_reviews(
    request: BatchReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit reviews for multiple garments in batch."""
    return clothing_review_service.batch_submit_reviews(db, current_user.id, request.reviews)


@router.patch("/clothing/{item_id}/training-eligibility")
def toggle_clothing_training_eligibility(
    item_id: UUID,
    request: TrainingEligibilityToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle exclusion from personal training dataset for an individual garment."""
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return clothing_review_service.toggle_training_eligibility(
        db=db,
        clothing=clothing,
        user_id=current_user.id,
        exclude_from_training=request.exclude_from_training,
    )
