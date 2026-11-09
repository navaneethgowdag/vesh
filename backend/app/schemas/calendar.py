from datetime import date as dt_date, time as dt_time, datetime as dt_datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator
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

    # Google Calendar & Metadata Extension
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    is_all_day: bool = Field(default=False, description="True for all-day events, False for timed/standard events")
    google_calendar_id: Optional[str] = None
    google_event_id: Optional[str] = None
    event_source: str = Field(default="tailorbird", description="google or tailorbird")
    last_synced_at: Optional[dt_datetime] = None

    # Inferred Fashion & Context Attributes
    inferred_occasion: Optional[str] = None
    inferred_formality: Optional[float] = None
    inferred_dress_code: Optional[str] = None
    inferred_context: Optional[Dict[str, Any]] = None

    @field_validator("is_all_day", mode="before")
    @classmethod
    def validate_is_all_day(cls, v: Any, info) -> bool:
        """
        Deliberately resolves is_all_day to a concrete boolean.
        1. If already boolean, preserves exact value (all-day=True, timed=False).
        2. If string or numeric, coerces safely.
        3. If legacy NULL, checks presence of start_time/end_time: timed events are always False.
        """
        if v is None:
            data = info.data if hasattr(info, "data") and isinstance(info.data, dict) else {}
            if data.get("start_time") is not None or data.get("end_time") is not None:
                return False
            return False
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes", "t")
        if isinstance(v, (int, float)):
            return bool(v)
        return False


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
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    inferred_occasion: Optional[str] = None
    inferred_dress_code: Optional[str] = None
    inferred_formality: Optional[float] = None


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


# --------------------------------------------------------------------------
# Google Calendar Integration Schemas
# --------------------------------------------------------------------------

class GoogleCalendarConnectResponse(BaseModel):
    authorization_url: str
    state: str


class GoogleCalendarStatusResponse(BaseModel):
    is_connected: bool
    google_email: Optional[str] = None
    selected_calendars: List[str] = Field(default_factory=lambda: ["primary"])
    last_sync_time: Optional[dt_datetime] = None
    sync_status: str = "idle"
    last_sync_error: Optional[str] = None
    event_count: int = 0


class GoogleCalendarSyncResponse(BaseModel):
    status: str = "success"
    synced_at: dt_datetime
    events_imported: int
    events_updated: int
    events_cancelled: int
    message: str


class GoogleCalendarItem(BaseModel):
    id: str
    summary: str
    primary: bool = False
    backgroundColor: Optional[str] = None
    accessRole: Optional[str] = None


class GoogleCalendarSelectRequest(BaseModel):
    calendar_ids: List[str] = Field(..., min_length=1, description="List of Google calendar IDs to synchronize")


class EventContextUpdateRequest(BaseModel):
    occasion: Optional[str] = None
    dress_code: Optional[str] = None
    formality: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    notes: Optional[str] = None


class DayAgendaSummaryResponse(BaseModel):
    date: dt_date
    event_count: int
    events: List[CalendarEventResponse]
    is_outfit_change_recommended: bool
    reason: str
    suggested_overall_occasion: str
    suggested_dress_code: str
    formality_range: List[float]
