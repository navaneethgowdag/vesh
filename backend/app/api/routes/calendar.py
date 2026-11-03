import logging
from datetime import date
from typing import Optional, List
from urllib.parse import quote, urlsplit
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventUpdate,
    CalendarEventResponse,
    ScheduleRecommendationRequest,
    GoogleCalendarConnectResponse,
    GoogleCalendarStatusResponse,
    GoogleCalendarSyncResponse,
    GoogleCalendarItem,
    GoogleCalendarSelectRequest,
    EventContextUpdateRequest,
    DayAgendaSummaryResponse,
)
from app.services.calendar_service import CalendarService
from app.services.google_calendar_service import GoogleCalendarService, _is_allowed_frontend_origin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["calendar"])


# ==============================================================================
# Google Calendar Integration Endpoints
# ==============================================================================

@router.get("/google/connect", response_model=GoogleCalendarConnectResponse)
def get_google_calendar_connect_url(
    request: Request,
    destination: str = "/calendar",
    frontend_url: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate Google OAuth authorization URL requesting read-only calendar scope.
    Encodes CSRF protection and origin destination into a signed JWT state.
    """
    service = GoogleCalendarService(db)

    resolved_frontend = frontend_url
    if not resolved_frontend:
        origin = request.headers.get("origin")
        if not origin:
            referer = request.headers.get("referer")
            if referer:
                p = urlsplit(referer)
                origin = f"{p.scheme}://{p.netloc}"
        resolved_frontend = origin

    url = service.generate_connect_url(
        user_id=current_user.id,
        destination=destination,
        frontend_url=resolved_frontend,
        request=request,
    )
    from urllib.parse import parse_qsl
    parsed = urlsplit(url)
    state = dict(parse_qsl(parsed.query)).get("state", "")
    return {"authorization_url": url, "state": state}


@router.get("/google/callback")
async def google_calendar_oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Dedicated callback endpoint for Google Calendar incremental OAuth.
    Validates state, encrypts refresh token, registers connection, and redirects to frontend.
    """
    service = GoogleCalendarService(db)
    frontend_base = settings.FRONTEND_URL.rstrip("/")

    # Detect destination from state if available
    state_data = {}
    if state:
        try:
            state_data = service.verify_state(state)
            candidate_origin = state_data.get("frontend_url")
            if candidate_origin and _is_allowed_frontend_origin(candidate_origin):
                frontend_base = candidate_origin.rstrip("/")
        except Exception:
            pass

    if error:
        logger.warning(f"[GoogleCalendar] User cancelled permission consent: {error}")
        err_msg = quote(error_description or "Google Calendar access was not granted.")
        return RedirectResponse(
            url=f"{frontend_base}/calendar?error=consent_denied&message={err_msg}",
            status_code=status.HTTP_302_FOUND,
        )

    if not code or not state or not state_data:
        return RedirectResponse(
            url=f"{frontend_base}/calendar?error=invalid_state&message=Invalid+or+missing+OAuth+parameters.",
            status_code=status.HTTP_302_FOUND,
        )

    user_id_str = state_data.get("user_id")
    if not user_id_str:
        return RedirectResponse(
            url=f"{frontend_base}/calendar?error=invalid_session&message=User+session+not+found+in+state.",
            status_code=status.HTTP_302_FOUND,
        )

    cal_redirect_uri = state_data.get("redirect_uri") or service.resolve_redirect_uri(
        frontend_url=candidate_origin,
        request=request,
    )

    try:
        user_uuid = UUID(user_id_str)
        await service.complete_connection(user_uuid, code, redirect_uri=cal_redirect_uri)

        # Trigger non-blocking initial sync
        try:
            await service.sync_events(user_uuid)
        except Exception as se:
            logger.warning(f"[GoogleCalendar] Initial sync warning: {se}")

        return RedirectResponse(
            url=f"{frontend_base}/calendar?google_calendar_connected=true",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as e:
        logger.error(f"[GoogleCalendar] Failed to complete calendar connection: {e}")
        err_msg = quote(str(e) or "Failed to connect Google Calendar.")
        return RedirectResponse(
            url=f"{frontend_base}/calendar?error=connection_failed&message={err_msg}",
            status_code=status.HTTP_302_FOUND,
        )


@router.get("/google/status", response_model=GoogleCalendarStatusResponse)
def get_google_calendar_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns current connection status and sync telemetry for the authenticated user."""
    service = GoogleCalendarService(db)
    return service.get_status(user_id=current_user.id)


@router.post("/google/sync", response_model=GoogleCalendarSyncResponse)
async def sync_google_calendar_now(
    past_days: int = Query(30, ge=1, le=180, description="Past window in days to sync"),
    future_days: int = Query(90, ge=1, le=365, description="Future window in days to sync"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Triggers an immediate synchronization with Google Calendar.
    Performs incremental sync if syncToken is valid, or bounded sync otherwise.
    """
    service = GoogleCalendarService(db)
    return await service.sync_events(
        user_id=current_user.id,
        window_past_days=past_days,
        window_future_days=future_days,
    )


@router.get("/google/calendars", response_model=List[GoogleCalendarItem])
async def list_google_calendars(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetches list of Google Calendars belonging to the authenticated Google account."""
    service = GoogleCalendarService(db)
    return await service.list_user_calendars(user_id=current_user.id)


@router.put("/google/calendars", response_model=List[str])
def update_selected_google_calendars(
    req: GoogleCalendarSelectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates which Google Calendars should be included in the synchronization."""
    service = GoogleCalendarService(db)
    return service.update_selected_calendars(user_id=current_user.id, calendar_ids=req.calendar_ids)


@router.delete("/google/disconnect", status_code=status.HTTP_200_OK)
async def disconnect_google_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Disconnects Google Calendar: securely revokes token, purges encrypted credentials,
    and halts automatic synchronization.
    """
    service = GoogleCalendarService(db)
    disconnected = await service.disconnect(user_id=current_user.id)
    return {
        "success": True,
        "message": "Google Calendar disconnected and credentials securely removed." if disconnected else "Google Calendar was not connected.",
    }


# ==============================================================================
# Calendar Event Endpoints
# ==============================================================================

@router.get("/events", response_model=List[CalendarEventResponse])
def list_calendar_events(
    start_date: Optional[date] = Query(None, description="Filter from this date (inclusive)"),
    end_date: Optional[date] = Query(None, description="Filter to this date (inclusive)"),
    status: Optional[str] = Query(None, description="Filter by event status: scheduled, completed, cancelled"),
    source: Optional[str] = Query(None, description="Filter by source: google, tailorbird, or omit for all"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists calendar events for the authenticated user with date, status, and source filters."""
    service = CalendarService(db)
    return service.list_events(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        status_filter=status,
        source_filter=source,
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


@router.patch("/events/{event_id}/context", response_model=CalendarEventResponse)
def update_calendar_event_context(
    event_id: UUID,
    req: EventContextUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allows user to override or refine the inferred fashion context (occasion, dress code, formality) of an event."""
    service = CalendarService(db)
    return service.update_event_context(event_id=event_id, user_id=current_user.id, req=req)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calendar_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CalendarService(db)
    service.delete_event(event_id=event_id, user_id=current_user.id)
    return None


@router.get("/day-agenda", response_model=DayAgendaSummaryResponse)
def get_day_agenda_summary(
    date_val: date = Query(..., alias="date", description="Target date in YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Analyzes all scheduled events on a given day to produce multi-event styling analysis
    and determine whether a single unified outfit transitions well or an outfit change is recommended.
    """
    service = CalendarService(db)
    return service.get_day_agenda(user_id=current_user.id, target_date=date_val)


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
