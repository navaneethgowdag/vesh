from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.recommendation import (
    RecommendationResponse,
    RecommendationGenerateRequest,
    RecommendationAcceptRequest,
    RecommendationAcceptResponse,
    RecommendationFeedbackCreate,
    RecommendationFeedbackResponse,
    OutfitWearResponse,
)
from app.schemas.calendar import ScheduleRecommendationRequest, CalendarEventResponse
from app.services.recommendation_service import RecommendationService
from app.services.feedback_service import FeedbackService
from app.services.calendar_service import CalendarService
from app.models.user import User

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post(
    "/generate",
    response_model=List[RecommendationResponse],
    status_code=status.HTTP_200_OK,
)
async def generate_recommendations(
    req: RecommendationGenerateRequest,
    city: str = Query("New York"),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    limit: int = Query(5, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Phase 3 AI Outfit Recommendation Generator.
    Mandatory Prerequisite: Calendar Event (`req.calendar_event_id`).
    Generates category-aware, formality-compatible, weather-calibrated outfit combinations.
    """
    service = RecommendationService(db)
    return await service.generate_recommendations(
        user_id=current_user.id,
        calendar_event_id=req.calendar_event_id,
        occasion=req.occasion,
        outfit_preference=req.outfit_preference,
        formality=req.formality,
        preferred_colors=req.preferred_colors,
        avoided_colors=req.avoided_colors,
        specific_clothing_id=req.specific_clothing_id,
        limit=limit,
        city=city,
        latitude=latitude,
        longitude=longitude,
    )


@router.get("", response_model=List[RecommendationResponse])
def list_recommendations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List historical AI recommendations for the authenticated user."""
    service = RecommendationService(db)
    return service.list_recommendations(
        user_id=current_user.id, limit=limit, offset=offset
    )


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
    """
    Legacy Daily Fit endpoint. Auto-associates with today's calendar event
    and generates tailored recommendations using Phase 3 engine.
    """
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
        reason=feedback_in.reason,
        metadata=feedback_in.metadata,
    )
    return {
        "id": fb.id,
        "recommendation_id": fb.recommendation_id,
        "action": fb.action,
        "reason": fb.reason,
        "created_at": fb.created_at,
        "message": "Feedback recorded and learned preferences updated successfully",
    }


@router.get("/feedback", response_model=List[RecommendationFeedbackResponse])
def list_feedback_history(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve recommendation feedback history for the authenticated user."""
    service = RecommendationService(db)
    feedbacks = service.get_feedback_history(user_id=current_user.id, limit=limit)
    return [
        {
            "id": f.id,
            "recommendation_id": f.recommendation_id,
            "action": f.action,
            "reason": f.reason,
            "created_at": f.created_at,
            "message": "Feedback record retrieved",
        }
        for f in feedbacks
    ]


@router.post("/{recommendation_id}/wear", response_model=OutfitWearResponse)
def mark_recommendation_as_worn(
    recommendation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Phase 4: Mark a recommended outfit as worn.
    Idempotently records wear in wear_history, increments clothing wear counts,
    and updates continuous learning preferences.
    """
    rec_service = RecommendationService(db)
    rec = rec_service.get_recommendation(recommendation_id, user_id=current_user.id)
    if not rec or not rec.outfit_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation or associated outfit not found",
        )
    return rec_service.mark_outfit_as_worn(
        user_id=current_user.id,
        outfit_id=rec.outfit_id,
        recommendation_id=recommendation_id,
        temperature=rec.temperature,
        feels_like=rec.feels_like_temperature,
        humidity=rec.humidity,
        weather_condition=rec.weather_condition,
        rain_probability=rec.rain_probability,
        occasion=rec.occasion,
        season=rec.season,
    )


@router.get("/{recommendation_id}", response_model=RecommendationResponse)
def get_recommendation(
    recommendation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a single recommendation by its unique ID."""
    service = RecommendationService(db)
    return service.get_recommendation(
        recommendation_id=recommendation_id, user_id=current_user.id
    )


@router.post("/{recommendation_id}/accept", response_model=RecommendationAcceptResponse)
def accept_recommendation(
    recommendation_id: UUID,
    req: Optional[RecommendationAcceptRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Phase 3: Accept recommendation and idempotently associate with calendar event in Neon PostgreSQL.
    """
    service = RecommendationService(db)
    cal_event_id = req.calendar_event_id if req else None
    return service.accept_recommendation(
        recommendation_id=recommendation_id,
        user_id=current_user.id,
        calendar_event_id=cal_event_id,
    )


@router.post("/{recommendation_id}/dismiss")
def dismiss_recommendation(
    recommendation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dismiss a recommendation."""
    service = RecommendationService(db)
    return service.dismiss_recommendation(
        recommendation_id=recommendation_id, user_id=current_user.id
    )


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
