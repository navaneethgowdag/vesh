from datetime import date
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventUpdate,
    CalendarEventResponse,
    ScheduleRecommendationRequest,
)
from app.services.calendar_service import CalendarService

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=List[CalendarEventResponse])
def list_calendar_events(
    start_date: Optional[date] = Query(None, description="Filter from this date (inclusive)"),
    end_date: Optional[date] = Query(None, description="Filter to this date (inclusive)"),
    status: Optional[str] = Query(None, description="Filter by event status: scheduled, completed, cancelled"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CalendarService(db)
    return service.list_events(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        status_filter=status,
        limit=limit,
        offset=offset,
    )


@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_calendar_event(
    event_in: CalendarEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CalendarService(db)
    return service.create_event(user_id=current_user.id, event_in=event_in)


@router.get("/events/{event_id}", response_model=CalendarEventResponse)
def get_calendar_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CalendarService(db)
    return service.get_event(event_id=event_id, user_id=current_user.id)


@router.patch("/events/{event_id}", response_model=CalendarEventResponse)
def update_calendar_event(
    event_id: UUID,
    update_in: CalendarEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CalendarService(db)
    return service.update_event(event_id=event_id, user_id=current_user.id, update_in=update_in)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calendar_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CalendarService(db)
    service.delete_event(event_id=event_id, user_id=current_user.id)
    return None


@router.post(
    "/recommendations/{recommendation_id}/schedule",
    response_model=CalendarEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def schedule_recommendation_event(
    recommendation_id: UUID,
    req: ScheduleRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CalendarService(db)
    return service.schedule_recommendation(
        user_id=current_user.id, recommendation_id=recommendation_id, req=req
    )
