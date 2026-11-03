import logging
import secrets
import time
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, Optional, List, Tuple
from urllib.parse import urlencode, quote, urlsplit
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import inspect

from app.core.config import settings
from app.core.encryption import encrypt_token, decrypt_token
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.calendar_event import CalendarEvent
from app.models.learned_preference import LearnedPreference
from app.repositories.calendar_repository import CalendarRepository
from app.services.event_context_service import EventContextService

from app.services.google_oauth_service import resolve_oauth_redirect_uri

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
CALENDAR_OAUTH_SCOPES = f"{CALENDAR_READONLY_SCOPE} openid email"


def _is_allowed_frontend_origin(origin: Optional[str]) -> bool:
    if not origin or not isinstance(origin, str):
        return False
    clean = origin.rstrip("/").lower()
    if clean in (
        "https://tailorbird.tech",
        "https://www.tailorbird.tech",
        "https://vesh.onrender.com",
    ):
        return True
    if clean.startswith("http://localhost:") or clean.startswith("http://127.0.0.1:"):
        return True
    if clean.endswith(".onrender.com"):
        return True
    if settings.FRONTEND_URL and clean == settings.FRONTEND_URL.rstrip("/").lower():
        return True
    return False


class GoogleCalendarService:
    def __init__(self, db: Session):
        self.db = db
        self.calendar_repo = CalendarRepository(db)
        self._has_conn_table = self._check_table_exists("google_calendar_connections")

    def _check_table_exists(self, table_name: str) -> bool:
        try:
            insp = inspect(self.db.bind)
            return table_name in insp.get_table_names()
        except Exception:
            return False

    # --------------------------------------------------------------------------
    # OAuth Connection Lifecycle
    # --------------------------------------------------------------------------

    def resolve_redirect_uri(
        self,
        frontend_url: Optional[str] = None,
        request: Optional[Any] = None,
    ) -> str:
        return resolve_oauth_redirect_uri(frontend_url=frontend_url, request=request)

    def generate_connect_url(
        self,
        user_id: UUID,
        destination: str = "/calendar",
        frontend_url: Optional[str] = None,
        request: Optional[Any] = None,
    ) -> str:
        """
        Generates Google OAuth 2.0 authorization URL for incremental Calendar access.
        Enforces offline access and consent prompt to obtain a refresh token.
        """
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google OAuth is not configured. Please set GOOGLE_CLIENT_ID.",
            )

        safe_dest = destination if destination.startswith("/") and not destination.startswith("//") else "/calendar"
        safe_frontend = frontend_url.rstrip("/") if _is_allowed_frontend_origin(frontend_url) else None
        resolved_redirect = resolve_oauth_redirect_uri(frontend_url=frontend_url, request=request)

        state_payload = {
            "csrf": secrets.token_urlsafe(24),
            "dest": safe_dest,
            "action": "connect_calendar",
            "user_id": str(user_id),
            "frontend_url": safe_frontend,
            "redirect_uri": resolved_redirect,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        signed_state = jwt.encode(state_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": resolved_redirect,
            "response_type": "code",
            "scope": CALENDAR_OAUTH_SCOPES,
            "state": signed_state,
            "access_type": "offline",
            "prompt": "consent",  # Ensures Google returns a refresh_token
            "include_granted_scopes": "true",
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    def verify_state(self, state: str) -> Dict[str, Any]:
        """Verify the integrity, signature, and expiration of OAuth state."""
        try:
            payload = jwt.decode(state, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired calendar OAuth state parameter.",
            )

    async def exchange_code(self, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        """Exchanges authorization code for Google access and refresh tokens."""
        if not settings.GOOGLE_CLIENT_SECRET or not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google OAuth credentials are not configured.",
            )

        effective_redirect = redirect_uri or resolve_oauth_redirect_uri()

        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": effective_redirect,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.post(GOOGLE_TOKEN_URL, data=data)
            except Exception as e:
                logger.error(f"[GoogleCalendar] Error connecting to Google token endpoint: {e}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to connect to Google authentication service.",
                )

        if resp.status_code != 200:
            logger.error(f"[GoogleCalendar] Token exchange failed ({resp.status_code}): {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google token exchange failed: {resp.text}",
            )

        return resp.json()

    async def refresh_access_token(self, refresh_token: str) -> str:
        """Uses a stored, decrypted refresh token to obtain a fresh access token."""
        data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.post(GOOGLE_TOKEN_URL, data=data)
            except Exception as e:
                logger.error(f"[GoogleCalendar] Error refreshing Google access token: {e}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Could not refresh Google Calendar access token.",
                )

        if resp.status_code != 200:
            logger.error(f"[GoogleCalendar] Token refresh failed ({resp.status_code}): {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google Calendar credentials expired or revoked. Please reconnect your calendar.",
            )

        token_data = resp.json()
        return token_data["access_token"]

    def _get_connection_record(self, user_id: UUID) -> Optional[GoogleCalendarConnection]:
        """Retrieves connection record from relational table or JSONB fallback."""
        if self._has_conn_table:
            return self.db.query(GoogleCalendarConnection).filter(
                GoogleCalendarConnection.user_id == user_id
            ).first()

        # Fallback to LearnedPreference JSONB storage
        lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
        if not lp or not isinstance(lp.weather_scores, dict):
            return None
        data = lp.weather_scores.get("_google_calendar_connection")
        if not data:
            return None

        # Build virtual model instance
        conn_raw_id = data.get("id")
        conn_id = user_id
        if conn_raw_id and conn_raw_id != "None":
            try:
                conn_id = UUID(conn_raw_id)
            except Exception:
                conn_id = user_id

        conn = GoogleCalendarConnection(
            id=conn_id,
            user_id=user_id,
            encrypted_refresh_token=data.get("encrypted_refresh_token"),
            google_email=data.get("google_email"),
            selected_calendars=data.get("selected_calendars", ["primary"]),
            sync_tokens=data.get("sync_tokens", {}),
            last_sync_time=datetime.fromisoformat(data["last_sync_time"]) if data.get("last_sync_time") else None,
            sync_status=data.get("sync_status", "idle"),
            last_sync_error=data.get("last_sync_error"),
            is_connected=data.get("is_connected", True),
        )
        return conn

    def _save_connection_record(self, conn: GoogleCalendarConnection) -> None:
        """Persists connection record using relational table or JSONB fallback."""
        if self._has_conn_table:
            self.db.add(conn)
            self.db.commit()
            self.db.refresh(conn)
            return

        # Fallback to LearnedPreference JSONB storage
        lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == conn.user_id).first()
        if not lp:
            lp = LearnedPreference(user_id=conn.user_id)
            self.db.add(lp)
            self.db.flush()

        scores = dict(lp.weather_scores or {})
        scores["_google_calendar_connection"] = {
            "id": str(conn.id or conn.user_id),
            "user_id": str(conn.user_id),
            "encrypted_refresh_token": conn.encrypted_refresh_token,
            "google_email": conn.google_email,
            "selected_calendars": conn.selected_calendars,
            "sync_tokens": conn.sync_tokens,
            "last_sync_time": conn.last_sync_time.isoformat() if conn.last_sync_time else None,
            "sync_status": conn.sync_status,
            "last_sync_error": conn.last_sync_error,
            "is_connected": conn.is_connected,
        }
        lp.weather_scores = scores
        flag_modified(lp, "weather_scores")
        self.db.commit()

    async def complete_connection(
        self,
        user_id: UUID,
        code: str,
        redirect_uri: Optional[str] = None,
    ) -> GoogleCalendarConnection:
        """
        Completes OAuth flow: exchanges code, encrypts refresh token,
        fetches primary calendar details, and stores connection state.
        """
        token_data = await self.exchange_code(code, redirect_uri=redirect_uri)
        access_token = token_data.get("access_token")
        new_refresh_token = token_data.get("refresh_token")

        existing_conn = self._get_connection_record(user_id)

        # Do not overwrite existing valid refresh token with empty value
        if new_refresh_token:
            encrypted_rt = encrypt_token(new_refresh_token)
        elif existing_conn and existing_conn.encrypted_refresh_token:
            encrypted_rt = existing_conn.encrypted_refresh_token
        else:
            encrypted_rt = None

        # Fetch primary calendar info to discover Google user email
        google_email: Optional[str] = None
        if access_token:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{GOOGLE_CALENDAR_API_BASE}/users/me/calendarList/primary",
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if resp.status_code == 200:
                        primary_cal = resp.json()
                        google_email = primary_cal.get("id") or primary_cal.get("summary")
            except Exception as e:
                logger.warning(f"[GoogleCalendar] Could not fetch primary calendar metadata: {e}")

        if existing_conn:
            existing_conn.encrypted_refresh_token = encrypted_rt
            if google_email:
                existing_conn.google_email = google_email
            existing_conn.is_connected = True
            existing_conn.sync_status = "idle"
            existing_conn.last_sync_error = None
            self._save_connection_record(existing_conn)
            conn = existing_conn
        else:
            conn = GoogleCalendarConnection(
                user_id=user_id,
                encrypted_refresh_token=encrypted_rt,
                google_email=google_email,
                selected_calendars=["primary"],
                sync_tokens={},
                sync_status="idle",
                is_connected=True,
            )
            self._save_connection_record(conn)

        logger.info(f"[GoogleCalendar] User {user_id} successfully connected Google Calendar ({google_email}).")
        return conn

    async def disconnect(self, user_id: UUID) -> bool:
        """
        Disconnects Google Calendar: revokes Google token if possible,
        purges stored refresh token, and marks connection as inactive.
        """
        conn = self._get_connection_record(user_id)
        if not conn or not conn.is_connected:
            return False

        # Attempt to revoke token with Google
        if conn.encrypted_refresh_token:
            plain_rt = decrypt_token(conn.encrypted_refresh_token)
            if plain_rt:
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(GOOGLE_REVOKE_URL, params={"token": plain_rt})
                except Exception as e:
                    logger.warning(f"[GoogleCalendar] Token revocation notice failed (non-fatal): {e}")

        conn.encrypted_refresh_token = None
        conn.is_connected = False
        conn.sync_status = "idle"
        conn.sync_tokens = {}
        conn.last_sync_error = None
        self._save_connection_record(conn)

        logger.info(f"[GoogleCalendar] User {user_id} disconnected Google Calendar.")
        return True

    def get_status(self, user_id: UUID) -> Dict[str, Any]:
        """Returns connection and synchronization status for the user."""
        conn = self._get_connection_record(user_id)
        if not conn or not conn.is_connected:
            return {
                "is_connected": False,
                "google_email": None,
                "selected_calendars": [],
                "last_sync_time": None,
                "sync_status": "disconnected",
                "last_sync_error": None,
                "event_count": 0,
            }

        event_count = self.calendar_repo.count_for_user(user_id=user_id, source="google")
        return {
            "is_connected": True,
            "google_email": conn.google_email,
            "selected_calendars": conn.selected_calendars or ["primary"],
            "last_sync_time": conn.last_sync_time,
            "sync_status": conn.sync_status,
            "last_sync_error": conn.last_sync_error,
            "event_count": event_count,
        }

    # --------------------------------------------------------------------------
    # Google Calendar API Integration
    # --------------------------------------------------------------------------

    async def get_valid_access_token(self, user_id: UUID) -> str:
        """Retrieves a valid access token, refreshing if necessary."""
        conn = self._get_connection_record(user_id)
        if not conn or not conn.is_connected or not conn.encrypted_refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Calendar is not connected. Please connect your calendar.",
            )

        plain_rt = decrypt_token(conn.encrypted_refresh_token)
        if not plain_rt:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Stored calendar encryption credentials are invalid. Please reconnect Google Calendar.",
            )

        return await self.refresh_access_token(plain_rt)

    async def list_user_calendars(self, user_id: UUID) -> List[Dict[str, Any]]:
        """Lists all calendars accessible by the user in Google Calendar."""
        access_token = await self.get_valid_access_token(user_id)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{GOOGLE_CALENDAR_API_BASE}/users/me/calendarList",
                headers={"Authorization": f"Bearer {access_token}"},
            )

        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to fetch calendars from Google: {resp.text}",
            )

        items = resp.json().get("items", [])
        return [
            {
                "id": c.get("id"),
                "summary": c.get("summary", "Untitled Calendar"),
                "primary": bool(c.get("primary")),
                "backgroundColor": c.get("backgroundColor"),
                "accessRole": c.get("accessRole"),
            }
            for c in items
        ]

    def update_selected_calendars(self, user_id: UUID, calendar_ids: List[str]) -> List[str]:
        """Updates the list of calendars selected for synchronization."""
        conn = self._get_connection_record(user_id)
        if not conn or not conn.is_connected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Calendar is not connected.",
            )

        clean_ids = [cid.strip() for cid in calendar_ids if cid.strip()]
        if not clean_ids:
            clean_ids = ["primary"]

        conn.selected_calendars = clean_ids
        self._save_connection_record(conn)
        return clean_ids

    # --------------------------------------------------------------------------
    # Event Synchronization
    # --------------------------------------------------------------------------

    async def sync_events(
        self,
        user_id: UUID,
        window_past_days: int = 30,
        window_future_days: int = 90,
    ) -> Dict[str, Any]:
        """
        Synchronizes events from Google Calendar into TailorBird.
        Supports both initial bounded sync and incremental syncToken sync.
        Handles recurring instances, cancellations, updates, and token expiry (HTTP 410).
        """
        conn = self._get_connection_record(user_id)
        if not conn or not conn.is_connected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Calendar is not connected.",
            )

        conn.sync_status = "syncing"
        conn.last_sync_error = None
        self._save_connection_record(conn)

        try:
            access_token = await self.get_valid_access_token(user_id)
        except Exception as e:
            conn.sync_status = "error"
            conn.last_sync_error = str(e)
            self._save_connection_record(conn)
            raise

        selected_cals = conn.selected_calendars or ["primary"]
        sync_tokens = dict(conn.sync_tokens or {})

        now_utc = datetime.now(timezone.utc)
        time_min = (now_utc - timedelta(days=window_past_days)).isoformat()
        time_max = (now_utc + timedelta(days=window_future_days)).isoformat()

        total_imported = 0
        total_updated = 0
        total_cancelled = 0

        async with httpx.AsyncClient(timeout=20.0) as http_client:
            for cal_id in selected_cals:
                curr_sync_token = sync_tokens.get(cal_id)
                cal_imported, cal_updated, cal_cancelled, next_token = await self._sync_single_calendar(
                    http_client=http_client,
                    access_token=access_token,
                    user_id=user_id,
                    calendar_id=cal_id,
                    sync_token=curr_sync_token,
                    time_min=time_min,
                    time_max=time_max,
                )
                total_imported += cal_imported
                total_updated += cal_updated
                total_cancelled += cal_cancelled

                if next_token:
                    sync_tokens[cal_id] = next_token

        conn.sync_tokens = sync_tokens
        conn.last_sync_time = datetime.now(timezone.utc)
        conn.sync_status = "success"
        conn.last_sync_error = None
        self._save_connection_record(conn)

        logger.info(
            f"[GoogleCalendar] Sync complete for user {user_id}: "
            f"+{total_imported} imported, ~{total_updated} updated, x{total_cancelled} cancelled."
        )

        return {
            "status": "success",
            "synced_at": conn.last_sync_time,
            "events_imported": total_imported,
            "events_updated": total_updated,
            "events_cancelled": total_cancelled,
            "message": f"Successfully synchronized Google Calendar: {total_imported} added, {total_updated} updated.",
        }

    async def _sync_single_calendar(
        self,
        http_client: httpx.AsyncClient,
        access_token: str,
        user_id: UUID,
        calendar_id: str,
        sync_token: Optional[str],
        time_min: str,
        time_max: str,
    ) -> Tuple[int, int, int, Optional[str]]:
        """Synchronizes an individual calendar, recovering if syncToken has expired (410)."""
        imported = 0
        updated = 0
        cancelled = 0
        next_sync_token: Optional[str] = None

        encoded_cal = quote(calendar_id, safe="")
        url = f"{GOOGLE_CALENDAR_API_BASE}/calendars/{encoded_cal}/events"

        headers = {"Authorization": f"Bearer {access_token}"}
        page_token: Optional[str] = None
        is_incremental = bool(sync_token)

        while True:
            params: Dict[str, Any] = {"maxResults": 250}
            if page_token:
                params["pageToken"] = page_token

            if is_incremental:
                params["syncToken"] = sync_token
            else:
                params["singleEvents"] = "true"
                params["orderBy"] = "startTime"
                params["timeMin"] = time_min
                params["timeMax"] = time_max

            resp = await http_client.get(url, headers=headers, params=params)

            # Handle expired syncToken (HTTP 410 Gone) -> fall back to full initial sync
            if resp.status_code == 410 and is_incremental:
                logger.warning(f"[GoogleCalendar] syncToken expired for calendar '{calendar_id}'. Resyncing from scratch.")
                is_incremental = False
                sync_token = None
                page_token = None
                continue

            if resp.status_code != 200:
                logger.error(f"[GoogleCalendar] Error fetching events for {calendar_id} ({resp.status_code}): {resp.text}")
                break

            data = resp.json()
            items = data.get("items", [])

            for item in items:
                res_type = self._process_google_event_item(user_id, calendar_id, item)
                if res_type == "imported":
                    imported += 1
                elif res_type == "updated":
                    updated += 1
                elif res_type == "cancelled":
                    cancelled += 1

            page_token = data.get("nextPageToken")
            if not page_token:
                next_sync_token = data.get("nextSyncToken")
                break

        return imported, updated, cancelled, next_sync_token

    def _process_google_event_item(
        self,
        user_id: UUID,
        calendar_id: str,
        item: Dict[str, Any],
    ) -> Optional[str]:
        """Parses a single Google event item, extracts context, and upserts into database."""
        google_event_id = item.get("id")
        if not google_event_id:
            return None

        google_status = item.get("status", "confirmed")

        # 1. Parse dates and times
        start_obj = item.get("start", {})
        end_obj = item.get("end", {})

        is_all_day = "date" in start_obj
        event_tz = start_obj.get("timeZone") or end_obj.get("timeZone")

        event_date_val: Optional[date] = None
        start_time_val: Optional[time] = None
        end_time_val: Optional[time] = None

        if is_all_day:
            raw_d = start_obj.get("date")
            if raw_d:
                try:
                    event_date_val = date.fromisoformat(raw_d)
                except ValueError:
                    event_date_val = date.today()
        else:
            raw_dt = start_obj.get("dateTime")
            if raw_dt:
                try:
                    parsed_dt = datetime.fromisoformat(raw_dt)
                    event_date_val = parsed_dt.date()
                    start_time_val = parsed_dt.time()
                except ValueError:
                    event_date_val = date.today()

            raw_end = end_obj.get("dateTime")
            if raw_end:
                try:
                    parsed_end = datetime.fromisoformat(raw_end)
                    end_time_val = parsed_end.time()
                except ValueError:
                    pass

        if not event_date_val:
            event_date_val = date.today()

        title = item.get("summary") or "Untitled Event"
        description = item.get("description")
        location = item.get("location")
        recurrence = item.get("recurrence", [None])[0] if item.get("recurrence") else None

        # 2. Context Classification
        context = EventContextService.classify_event_context(
            title=title,
            description=description,
            location=location,
            start_time=start_time_val,
            is_all_day=is_all_day,
        )

        event_status = "cancelled" if google_status == "cancelled" else "scheduled"

        # 3. Upsert through CalendarRepository
        event_dict = {
            "title": title,
            "description": description,
            "location": location,
            "event_date": event_date_val,
            "start_time": start_time_val,
            "end_time": end_time_val,
            "timezone": event_tz,
            "is_all_day": is_all_day,
            "status": event_status,
            "event_type": "special_event" if is_all_day else "planned_outfit",
            "event_source": "google",
            "google_calendar_id": calendar_id,
            "google_event_id": google_event_id,
            "recurrence_rule": recurrence,
            "occasion": context["occasion"],
            "inferred_occasion": context["occasion"],
            "inferred_formality": context["formality"],
            "inferred_dress_code": context["dress_code"],
            "inferred_context": context,
            "last_synced_at": datetime.now(timezone.utc),
        }

        return self.calendar_repo.upsert_google_event(user_id=user_id, **event_dict)
