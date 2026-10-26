from datetime import date as dt_date, time as dt_time, datetime as dt_datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.outfit import OutfitResponse


class CalendarEventBase(BaseModel):
    event_date: dt_date
    start_time: Optional[dt_time] = None
    end_time: Optional[dt_time] = None
    event_type: str = Field(default="planned_outfit", description="planned_outfit, outfit_worn, or special_event")
    outfit_id: Optional[UUID] = None
    recommendation_id: Optional[UUID] = None
    occasion: Optional[str] = None
    notes: Optional[str] = None
    status: str = Field(default="scheduled", description="scheduled, completed, cancelled")


class CalendarEventCreate(CalendarEventBase):
    pass


class CalendarEventUpdate(BaseModel):
    event_date: Optional[dt_date] = None
    start_time: Optional[dt_time] = None
    end_time: Optional[dt_time] = None
    event_type: Optional[str] = None
    outfit_id: Optional[UUID] = None
    occasion: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class CalendarEventResponse(CalendarEventBase):
    id: UUID
    user_id: UUID
    created_at: dt_datetime
    updated_at: dt_datetime
    outfit: Optional[OutfitResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ScheduleRecommendationRequest(BaseModel):
    date: dt_date = Field(..., description="Target date for the planned outfit")
    time: Optional[dt_time] = None
    occasion: Optional[str] = None
    notes: Optional[str] = None
