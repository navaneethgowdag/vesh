from datetime import date, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.outfit import OutfitResponse


class WeeklyPlanDayResponse(BaseModel):
    id: UUID
    weekly_plan_id: UUID
    plan_date: date
    outfit_id: Optional[UUID] = None
    outfit: Optional[OutfitResponse] = None
    calendar_event_id: Optional[UUID] = None
    status: str
    recommendation_explanation: Optional[str] = None
    explanation_data: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WeeklyPlanResponse(BaseModel):
    id: UUID
    user_id: UUID
    week_start_date: date
    week_end_date: date
    status: str
    days: List[WeeklyPlanDayResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WeeklyPlanGenerateRequest(BaseModel):
    week_start_date: Optional[date] = None
    force_regenerate: bool = False


class WeeklyPlanUpdateOutfitRequest(BaseModel):
    outfit_id: Optional[UUID] = None
    clothing_item_ids: Optional[List[UUID]] = None


class WeeklyPlanUpdateStatusRequest(BaseModel):
    status: str = Field(..., description="Status: planned, accepted, rejected, worn")
