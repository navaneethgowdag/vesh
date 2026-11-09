from datetime import date
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.weekly_plan import (
    WeeklyPlanResponse,
    WeeklyPlanDayResponse,
    WeeklyPlanGenerateRequest,
    WeeklyPlanUpdateOutfitRequest,
    WeeklyPlanUpdateStatusRequest,
)
from app.services.weekly_planner_service import WeeklyPlannerService

router = APIRouter(prefix="/planner", tags=["planner"])


@router.get(
    "/weekly",
    response_model=Optional[WeeklyPlanResponse],
    status_code=status.HTTP_200_OK,
)
def get_weekly_plan(
    week_start_date: Optional[date] = Query(None, description="Optional Monday week start date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves active weekly plan for authenticated user."""
    service = WeeklyPlannerService(db)
    return service.get_plan(user_id=current_user.id, week_start_date=week_start_date)


@router.post(
    "/weekly/generate",
    response_model=WeeklyPlanResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_weekly_plan(
    req: WeeklyPlanGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a 7-day outfit plan using actual wardrobe, calendar events, weather forecasts,
    and colour coordination. Prevents duplicate plans unless force_regenerate is True.
    """
    service = WeeklyPlannerService(db)
    return await service.generate_weekly_plan(
        user_id=current_user.id,
        week_start_date=req.week_start_date,
        force_regenerate=req.force_regenerate,
    )


@router.post(
    "/weekly/{plan_id}/days/{day_id}/regenerate",
    response_model=WeeklyPlanDayResponse,
    status_code=status.HTTP_200_OK,
)
async def regenerate_plan_day(
    plan_id: UUID,
    day_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Regenerates a single day's outfit without modifying other days."""
    service = WeeklyPlannerService(db)
    return await service.regenerate_day(
        user_id=current_user.id,
        plan_id=plan_id,
        day_id=day_id,
    )


@router.put(
    "/weekly/{plan_id}/days/{day_id}/outfit",
    response_model=WeeklyPlanDayResponse,
    status_code=status.HTTP_200_OK,
)
def update_plan_day_outfit(
    plan_id: UUID,
    day_id: UUID,
    req: WeeklyPlanUpdateOutfitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually assigns an existing outfit or sets custom garments for a day."""
    service = WeeklyPlannerService(db)
    return service.update_day_outfit(
        user_id=current_user.id,
        plan_id=plan_id,
        day_id=day_id,
        outfit_id=req.outfit_id,
        clothing_item_ids=req.clothing_item_ids,
    )


@router.patch(
    "/weekly/{plan_id}/days/{day_id}/status",
    response_model=WeeklyPlanDayResponse,
    status_code=status.HTTP_200_OK,
)
def update_plan_day_status(
    plan_id: UUID,
    day_id: UUID,
    req: WeeklyPlanUpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates the status of a daily outfit (planned, accepted, rejected, worn).
    Marking as 'worn' updates wear history and item wear counts.
    """
    service = WeeklyPlannerService(db)
    return service.update_day_status(
        user_id=current_user.id,
        plan_id=plan_id,
        day_id=day_id,
        new_status=req.status,
    )
