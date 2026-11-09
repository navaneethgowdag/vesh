from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.wardrobe_gap import WardrobeGapResponse
from app.services.wardrobe_gap_service import WardrobeGapService

router = APIRouter(prefix="/wardrobe", tags=["wardrobe-gap"])


@router.get(
    "/gap-analysis",
    response_model=WardrobeGapResponse,
    status_code=status.HTTP_200_OK,
)
def get_wardrobe_gap_analysis(
    force_refresh: bool = Query(False, description="Bypass cache and force fresh analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Analyzes authenticated user's actual wardrobe, category distributions, formality balance,
    colour mix, wear history, and upcoming calendar requirements to detect actionable wardrobe gaps.
    """
    service = WardrobeGapService(db)
    return service.analyze_wardrobe(user_id=current_user.id, force_refresh=force_refresh)


@router.post(
    "/gap-analysis/refresh",
    response_model=WardrobeGapResponse,
    status_code=status.HTTP_200_OK,
)
def refresh_wardrobe_gap_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Explicitly triggers a fresh recalculation of wardrobe gaps."""
    service = WardrobeGapService(db)
    return service.analyze_wardrobe(user_id=current_user.id, force_refresh=True)
