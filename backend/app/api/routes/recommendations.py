from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.recommendation import (
    RecommendationResponse,
    RecommendationFeedbackCreate,
    RecommendationFeedbackResponse,
)
from app.schemas.calendar import ScheduleRecommendationRequest, CalendarEventResponse
from app.services.recommendation_service import RecommendationService
from app.services.feedback_service import FeedbackService
from app.services.calendar_service import CalendarService
from app.models.user import User

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/daily-fit", response_model=RecommendationResponse)
async def get_daily_fit_recommendation(
    city: str = Query("New York"),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    occasion: str = Query("Casual Daily"),
    variation_seed: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RecommendationService(db)
    return await service.generate_daily_fit(
        user_id=current_user.id,
        city=city,
        latitude=latitude,
        longitude=longitude,
        occasion=occasion,
        variation_seed=variation_seed,
    )


@router.post("/feedback", response_model=RecommendationFeedbackResponse)
def record_recommendation_feedback(
    feedback_in: RecommendationFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FeedbackService(db)
    fb = service.process_feedback(
        user_id=current_user.id,
        recommendation_id=feedback_in.recommendation_id,
        action=feedback_in.action,
        metadata=feedback_in.metadata,
    )
    return {
        "id": fb.id,
        "recommendation_id": fb.recommendation_id,
        "action": fb.action,
        "created_at": fb.created_at,
        "message": "Feedback recorded and learned preferences updated successfully",
    }


@router.post(
    "/{recommendation_id}/schedule",
    response_model=CalendarEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def schedule_recommendation(
    recommendation_id: UUID,
    req: ScheduleRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Schedules an existing recommendation into the user's outfit calendar.
    Does NOT increment wear counts or mark outfit as worn.
    """
    service = CalendarService(db)
    return service.schedule_recommendation(
        user_id=current_user.id, recommendation_id=recommendation_id, req=req
    )
