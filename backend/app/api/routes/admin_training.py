"""
Admin Training History Routes.
Provides persistent audit trail, logs, and job status tracking across both AI models.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.services.recommendation_training_service import recommendation_training_service
from app.services.job_service import JobService

router = APIRouter(prefix="/admin/training", tags=["Admin Training"])


@router.get("/history")
def get_training_history(
    model_type: Optional[str] = Query(None, description="Filter by model type: 'clothing' or 'recommendation'"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by job status: 'completed', 'failed', 'processing', 'queued'"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
) -> List[Dict[str, Any]]:
    """Retrieve full training job history across both models with optional filtering."""
    combined_history: List[Dict[str, Any]] = []

    # 1. Recommendation model jobs
    rec_jobs = recommendation_training_service.list_jobs()
    for j in rec_jobs:
        combined_history.append({
            "job_id": j.get("job_id"),
            "model_type": "recommendation",
            "model_name": "TailorBird Random Forest Regressor",
            "status": j.get("status", "unknown"),
            "progress_percent": j.get("progress_percent", 100),
            "created_at": j.get("created_at"),
            "started_at": j.get("started_at"),
            "completed_at": j.get("completed_at"),
            "candidate_version": j.get("candidate_version"),
            "metrics": j.get("metrics", {}),
            "error": j.get("error"),
            "logs_count": len(j.get("logs", [])),
        })

    # 2. Clothing classifier jobs
    job_service = JobService(db)
    clothing_jobs = job_service.list_jobs(job_type="model_training", limit=50)
    for cj in clothing_jobs:
        created_iso = cj.created_at.isoformat() if cj.created_at else None
        completed_iso = cj.updated_at.isoformat() if cj.updated_at else None
        combined_history.append({
            "job_id": str(cj.id),
            "model_type": "clothing",
            "model_name": "EfficientNet-B0 Clothing Classifier",
            "status": cj.status,
            "progress_percent": 100 if cj.status == "completed" else (50 if cj.status == "processing" else 0),
            "created_at": created_iso,
            "started_at": created_iso,
            "completed_at": completed_iso if cj.status in ("completed", "failed") else None,
            "candidate_version": (cj.result or {}).get("candidate_version") if isinstance(cj.result, dict) else None,
            "metrics": (cj.result or {}).get("evaluation_metrics", {}) if isinstance(cj.result, dict) else {},
            "error": cj.error_message,
            "logs_count": 5,
        })

    # Filter by model_type
    if model_type:
        mt = model_type.lower().strip()
        combined_history = [h for h in combined_history if h["model_type"] == mt]

    # Filter by status
    if status_filter:
        st = status_filter.lower().strip()
        combined_history = [h for h in combined_history if h["status"] == st]

    # Sort descending by creation date
    return sorted(combined_history, key=lambda x: x.get("created_at") or "", reverse=True)


@router.get("/jobs/{job_id}")
def get_job_details(
    job_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """Retrieve full details, metrics, and logs for a specific training job."""
    # Check recommendation model jobs first
    rec_job = recommendation_training_service.get_job(job_id)
    if rec_job:
        return rec_job

    # Check clothing classifier jobs
    job_service = JobService(db)
    cj = job_service.get_job(job_id)
    if cj:
        return {
            "job_id": str(cj.id),
            "model_type": "clothing",
            "model_name": "EfficientNet-B0 Clothing Classifier",
            "status": cj.status,
            "progress_percent": 100 if cj.status == "completed" else (50 if cj.status == "processing" else 0),
            "created_at": cj.created_at.isoformat() if cj.created_at else None,
            "completed_at": cj.updated_at.isoformat() if cj.updated_at else None,
            "payload": cj.payload_ref or {},
            "result": cj.result or {},
            "error": cj.error_message,
            "logs": [
                f"Job initialized at {cj.created_at}",
                f"Execution status: {cj.status}",
                f"Completed with result: {cj.result}" if cj.result else "Processing in background...",
            ],
        }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Training job '{job_id}' not found.",
    )
