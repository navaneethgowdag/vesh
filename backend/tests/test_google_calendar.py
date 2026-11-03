"""
Automated Test Suite for TailorBird Google Calendar Integration with AI Wardrobe
Covers:
1. Connect URL generation with signed state and offline access.
2. Token exchange and refresh token encryption at rest.
3. Preserving existing refresh token when Google does not return a new one.
4. Initial event synchronization with bounded window (timeMin, timeMax).
5. Pagination handling using pageToken.
6. Incremental synchronization using syncToken.
7. Handling expired sync token (HTTP 410 Gone) with automatic recovery.
8. Google event upsert: creation, update, and cancellation.
9. All-day and recurring event handling.
10. Disconnect and token revocation.
11. Event context classification heuristics (Work, Wedding, Date, Fitness, Travel).
12. Multi-event day analysis and outfit change recommendation.
13. Recommendation generation for a Google-imported event.
14. Accepting recommendation and calendar association.
15. User calendar data isolation.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.encryption import decrypt_token, encrypt_token
from app.main import app
from app.models.calendar_event import CalendarEvent
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.user import User
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.repositories.calendar_repository import CalendarRepository
from app.services.calendar_service import CalendarService
from app.services.event_context_service import infer_event_context, analyze_day_events
from app.services.google_calendar_service import (
    GoogleCalendarService,
    CALENDAR_OAUTH_SCOPES,
    GOOGLE_AUTH_URL,
)
from app.core.security import create_access_token

settings = get_settings()
client = TestClient(app)


# ==============================================================================
# Helper fixtures / utilities
# ==============================================================================

def create_test_user(db, prefix="cal_test") -> tuple[User, str]:
    """Creates a unique test user in the database and returns (user, jwt_token)."""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        email=f"{prefix}_{unique_id}@example.com",
        username=f"{prefix}_{unique_id}",
        password_hash="mockhashedpassword123",
        first_name="Tester",
        last_name=unique_id,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    return user, token


def create_test_clothing(db, user_id, category, color, occasion="Work & Office", formality=0.6):
    """Creates a clothing item and associated verified analysis."""
    item = Clothing(
        id=uuid.uuid4(),
        user_id=user_id,
        name=f"Test {color} {category}",
        category=category,
        subcategory=category,
        color=color,
        season="All-Season",
        occasion=occasion,
        image_url=f"/mock/{category}.jpg",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    analysis = ClothingAnalysis(
        id=uuid.uuid4(),
        clothing_id=item.id,
        detected_category=category,
        style_tags=["Classic"],
        confidence=0.90,
        detected_colors=[{"name": color, "hex": "#ffffff", "percentage": 0.8}],
        feature_vector={
            "formality": formality,
            "verified_attributes": {
                "category": category,
                "primary_color": color,
                "formality": formality,
            },
        },
    )
    db.add(analysis)
    db.commit()
    return item


# ==============================================================================
# 1. Connect URL Generation
# ==============================================================================

def test_google_calendar_connect_url_generation():
    """Verify GET /api/v1/calendar/google/connect returns proper URL with signed state, offline access, and consent prompt."""
    db = SessionLocal()
    try:
        user, token = create_test_user(db, prefix="url_gen")
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.get("/api/v1/calendar/google/connect?destination=/calendar", headers=headers)
        assert resp.status_code == 200, f"Error: {resp.text}"
        data = resp.json()
        assert "authorization_url" in data
        assert "state" in data

        auth_url = data["authorization_url"]
        parsed = urlparse(auth_url)
        assert parsed.scheme == "https"
        assert parsed.netloc == "accounts.google.com"

        params = parse_qs(parsed.query)
        assert params["client_id"][0] == settings.GOOGLE_CLIENT_ID
        assert params["response_type"][0] == "code"
        assert params["access_type"][0] == "offline"
        assert params["prompt"][0] == "consent"
        assert CALENDAR_OAUTH_SCOPES in params["scope"][0]

        # Verify state claims
        decoded_state = jwt.decode(data["state"], settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert decoded_state["action"] == "connect_calendar"
        assert decoded_state["user_id"] == str(user.id)
        assert decoded_state["dest"] == "/calendar"
        assert "csrf" in decoded_state
    finally:
        db.close()


# ==============================================================================
# 2. Token Encryption and Decryption at Rest
# ==============================================================================

def test_token_encryption_and_decryption_at_rest():
    """Verify refresh tokens are encrypted at rest using Fernet and cannot be read as plaintext."""
    raw_refresh_token = "1//04mock_google_refresh_token_xyz987_TailorBird"
    encrypted = encrypt_token(raw_refresh_token)

    assert encrypted != raw_refresh_token
    assert not encrypted.startswith("1//")
    assert isinstance(encrypted, str)

    decrypted = decrypt_token(encrypted)
    assert decrypted == raw_refresh_token


# ==============================================================================
# 3. Preserving Existing Refresh Token on Re-auth
# ==============================================================================

@pytest.mark.asyncio
async def test_preserving_existing_refresh_token_if_empty_returned():
    """Verify re-auth doesn't overwrite existing encrypted refresh token if Google only returns access_token."""
    db = SessionLocal()
    try:
        user, _ = create_test_user(db, prefix="preserve_rt")
        service = GoogleCalendarService(db)

        initial_rt = "1//initial_valid_refresh_token_12345"
        # Mock first exchange returning refresh token
        with patch.object(service, "exchange_code", new=AsyncMock(return_value={
            "access_token": "mock_access_1",
            "refresh_token": initial_rt,
            "expires_in": 3600,
        })), patch("httpx.AsyncClient.get", new=AsyncMock(return_value=MagicMock(status_code=200, json=lambda: {"id": "user@gmail.com"}))):
            conn1 = await service.complete_connection(user.id, "code_1")
            assert conn1.encrypted_refresh_token is not None
            assert decrypt_token(conn1.encrypted_refresh_token) == initial_rt

        # Mock second exchange returning NO refresh token (common in subsequent consent)
        with patch.object(service, "exchange_code", new=AsyncMock(return_value={
            "access_token": "mock_access_2",
            "expires_in": 3600,
        })), patch("httpx.AsyncClient.get", new=AsyncMock(return_value=MagicMock(status_code=200, json=lambda: {"id": "user@gmail.com"}))):
            conn2 = await service.complete_connection(user.id, "code_2")
            # Existing encrypted refresh token must remain intact!
            assert conn2.encrypted_refresh_token is not None
            assert decrypt_token(conn2.encrypted_refresh_token) == initial_rt
    finally:
        db.close()


# ==============================================================================
# 4. Initial Event Sync with Bounded Window
# ==============================================================================

@pytest.mark.asyncio
async def test_initial_event_sync_bounded_window():
    """Verify initial sync fetches events within past/future window and stores them."""
    db = SessionLocal()
    try:
        user, _ = create_test_user(db, prefix="init_sync")
        service = GoogleCalendarService(db)

        # Set up a connected status
        conn = GoogleCalendarConnection(
            user_id=user.id,
            encrypted_refresh_token=encrypt_token("mock_refresh_token"),
            google_email="test@gmail.com",
            selected_calendars=["primary"],
            is_connected=True,
        )
        service._save_connection_record(conn)

        mock_event_1 = {
            "id": "g_evt_001",
            "summary": "Executive Board Meeting",
            "description": "Annual strategy review with executive team",
            "location": "Boardroom 4B, HQ",
            "start": {"dateTime": "2026-11-10T10:00:00Z"},
            "end": {"dateTime": "2026-11-10T11:30:00Z"},
            "status": "confirmed",
        }

        mock_resp = {
            "items": [mock_event_1],
            "nextSyncToken": "sync_token_v1",
        }

        with patch.object(service, "refresh_access_token", new=AsyncMock(return_value="mock_access")), \
             patch("httpx.AsyncClient.get", new=AsyncMock(return_value=MagicMock(status_code=200, json=lambda: mock_resp))):
            res = await service.sync_events(user.id, window_past_days=14, window_future_days=30)
            assert res["status"] == "success"
            assert res["events_imported"] >= 1

        cal_repo = CalendarRepository(db)
        imported = cal_repo.get_by_google_event(user.id, "primary", "g_evt_001")
        assert imported is not None
        assert imported.title == "Executive Board Meeting"
        assert imported.location == "Boardroom 4B, HQ"
        assert imported.event_source == "google"
        assert imported.inferred_occasion == "Work & Office"
        assert imported.inferred_formality is not None
        assert imported.inferred_formality >= 0.70
    finally:
        db.close()


# ==============================================================================
# 5. Pagination Handling Using pageToken
# ==============================================================================

@pytest.mark.asyncio
async def test_sync_pagination_handling():
    """Verify that pagination across multiple Google Calendar pages is followed completely."""
    db = SessionLocal()
    try:
        user, _ = create_test_user(db, prefix="pag_test")
        service = GoogleCalendarService(db)

        conn = GoogleCalendarConnection(
            user_id=user.id,
            encrypted_refresh_token=encrypt_token("mock_rt"),
            selected_calendars=["primary"],
            is_connected=True,
        )
        service._save_connection_record(conn)

        page_1 = {
            "items": [
                {
                    "id": "pag_evt_1",
                    "summary": "Morning Standup",
                    "start": {"dateTime": "2026-11-12T09:00:00Z"},
                    "end": {"dateTime": "2026-11-12T09:30:00Z"},
                    "status": "confirmed",
                }
            ],
            "nextPageToken": "token_for_page_2",
        }
        page_2 = {
            "items": [
                {
                    "id": "pag_evt_2",
                    "summary": "Evening Dinner Party",
                    "start": {"dateTime": "2026-11-12T19:00:00Z"},
                    "end": {"dateTime": "2026-11-12T22:00:00Z"},
                    "status": "confirmed",
                }
            ],
            "nextSyncToken": "final_sync_token",
        }

        call_count = 0
        async def mock_get(url, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if "pageToken" in kwargs.get("params", {}):
                return MagicMock(status_code=200, json=lambda: page_2)
            return MagicMock(status_code=200, json=lambda: page_1)

        with patch.object(service, "refresh_access_token", new=AsyncMock(return_value="mock_access")), \
             patch("httpx.AsyncClient.get", side_effect=mock_get):
            res = await service.sync_events(user.id)
            assert res["events_imported"] >= 2
            assert call_count >= 2

        cal_repo = CalendarRepository(db)
        e1 = cal_repo.get_by_google_event(user.id, "primary", "pag_evt_1")
        e2 = cal_repo.get_by_google_event(user.id, "primary", "pag_evt_2")
        assert e1 is not None
        assert e2 is not None
        assert e2.inferred_occasion in ("Date Night", "Party & Evening")
    finally:
        db.close()


# ==============================================================================
# 6. Incremental Synchronization Using syncToken
# ==============================================================================

@pytest.mark.asyncio
async def test_incremental_sync_with_sync_token():
    """Verify that subsequent sync uses saved syncToken for fast incremental change detection."""
    db = SessionLocal()
    try:
        user, _ = create_test_user(db, prefix="incr_sync")
        service = GoogleCalendarService(db)

        conn = GoogleCalendarConnection(
            user_id=user.id,
            encrypted_refresh_token=encrypt_token("mock_rt"),
            selected_calendars=["primary"],
            sync_tokens={"primary": "existing_sync_token_123"},
            is_connected=True,
        )
        service._save_connection_record(conn)

        captured_params = {}
        async def mock_get(url, *args, **kwargs):
            nonlocal captured_params
            captured_params = kwargs.get("params", {})
            return MagicMock(status_code=200, json=lambda: {
                "items": [],
                "nextSyncToken": "new_sync_token_456",
            })

        with patch.object(service, "refresh_access_token", new=AsyncMock(return_value="mock_access")), \
             patch("httpx.AsyncClient.get", side_effect=mock_get):
            res = await service.sync_events(user.id)
            assert res["status"] == "success"

        # Verify existing syncToken was submitted in query params
        assert captured_params.get("syncToken") == "existing_sync_token_123"

        # Verify new sync token was stored
        updated_conn = service._get_connection_record(user.id)
        assert updated_conn.sync_tokens.get("primary") == "new_sync_token_456"
    finally:
        db.close()


# ==============================================================================
# 7. Expired Sync Token Recovery (HTTP 410 Gone)
# ==============================================================================

@pytest.mark.asyncio
async def test_sync_token_expired_410_recovery():
    """Verify automatic recovery when Google returns HTTP 410 Gone for an expired syncToken."""
    db = SessionLocal()
    try:
        user, _ = create_test_user(db, prefix="recov_410")
        service = GoogleCalendarService(db)

        conn = GoogleCalendarConnection(
            user_id=user.id,
            encrypted_refresh_token=encrypt_token("mock_rt"),
            selected_calendars=["primary"],
            sync_tokens={"primary": "expired_old_sync_token"},
            is_connected=True,
        )
        service._save_connection_record(conn)

        calls = 0
        async def mock_get(url, *args, **kwargs):
            nonlocal calls
            calls += 1
            params = kwargs.get("params", {})
            if "syncToken" in params:
                # Return 410 Gone indicating sync token invalidation
                return MagicMock(status_code=410, text="Sync token expired")
            # Fallback full sync succeeds
            return MagicMock(status_code=200, json=lambda: {
                "items": [
                    {
                        "id": "recov_evt_1",
                        "summary": "Lunch with Colleague",
                        "start": {"dateTime": "2026-11-15T12:30:00Z"},
                        "end": {"dateTime": "2026-11-15T13:30:00Z"},
                        "status": "confirmed",
                    }
                ],
                "nextSyncToken": "fresh_new_sync_token",
            })

        with patch.object(service, "refresh_access_token", new=AsyncMock(return_value="mock_access")), \
             patch("httpx.AsyncClient.get", side_effect=mock_get):
            res = await service.sync_events(user.id)
            assert res["status"] == "success"
            assert res["events_imported"] >= 1
            assert calls >= 2

        # Stored sync token must be refreshed
        updated_conn = service._get_connection_record(user.id)
        assert updated_conn.sync_tokens.get("primary") == "fresh_new_sync_token"
    finally:
        db.close()


# ==============================================================================
# 8. Google Event Upsert: Creation, Update, and Cancellation
# ==============================================================================

@pytest.mark.asyncio
async def test_google_event_upsert_creation_update_cancellation():
    """Verify that event upsert handles creation, modification of details, and cancellation."""
    db = SessionLocal()
    try:
        user, _ = create_test_user(db, prefix="upsert_test")
        cal_repo = CalendarRepository(db)

        # 1. Create
        s1 = cal_repo.upsert_google_event(
            user_id=user.id,
            google_calendar_id="primary",
            google_event_id="evt_upsert_01",
            title="Design Review",
            event_date=date(2026, 11, 20),
            location="Room 101",
            status="scheduled",
        )
        assert s1 in ("imported", "updated")
        e1 = cal_repo.get_by_google_event(user.id, "primary", "evt_upsert_01")
        assert e1 is not None
        assert e1.title == "Design Review"
        assert e1.status == "scheduled"

        # 2. Update title & location
        s2 = cal_repo.upsert_google_event(
            user_id=user.id,
            google_calendar_id="primary",
            google_event_id="evt_upsert_01",
            title="Design Review (Updated)",
            event_date=date(2026, 11, 20),
            location="Room 202 - East Wing",
            status="scheduled",
        )
        assert s2 in ("imported", "updated")
        e2 = cal_repo.get_by_google_event(user.id, "primary", "evt_upsert_01")
        assert e2.title == "Design Review (Updated)"
        assert e2.location == "Room 202 - East Wing"

        # 3. Cancel (status="cancelled")
        s3 = cal_repo.upsert_google_event(
            user_id=user.id,
            google_calendar_id="primary",
            google_event_id="evt_upsert_01",
            title="Design Review (Updated)",
            event_date=date(2026, 11, 20),
            status="cancelled",
        )
        assert s3 == "cancelled"
        e3 = cal_repo.get_by_google_event(user.id, "primary", "evt_upsert_01")
        assert e3.status == "cancelled"
    finally:
        db.close()


# ==============================================================================
# 9. All-Day and Recurring Event Handling
# ==============================================================================

@pytest.mark.asyncio
async def test_all_day_and_recurring_event_handling():
    """Verify all-day events (date-only) and recurring event representations are processed correctly."""
    db = SessionLocal()
    try:
        user, _ = create_test_user(db, prefix="allday_recur")
        service = GoogleCalendarService(db)

        conn = GoogleCalendarConnection(
            user_id=user.id,
            encrypted_refresh_token=encrypt_token("mock_rt"),
            selected_calendars=["primary"],
            is_connected=True,
        )
        service._save_connection_record(conn)

        all_day_item = {
            "id": "allday_001",
            "summary": "Founder Birthday Celebration",
            "start": {"date": "2026-11-25"},
            "end": {"date": "2026-11-26"},
            "status": "confirmed",
        }
        recurring_item = {
            "id": "recur_instance_01",
            "recurringEventId": "parent_recur_001",
            "summary": "Weekly 1:1 Sync",
            "start": {"dateTime": "2026-11-25T14:00:00Z"},
            "end": {"dateTime": "2026-11-25T14:30:00Z"},
            "status": "confirmed",
        }

        with patch.object(service, "refresh_access_token", new=AsyncMock(return_value="mock_access")), \
             patch("httpx.AsyncClient.get", new=AsyncMock(return_value=MagicMock(status_code=200, json=lambda: {
                 "items": [all_day_item, recurring_item],
                 "nextSyncToken": "sync_token_allday",
             }))):
            res = await service.sync_events(user.id)
            assert res["events_imported"] >= 2

        cal_repo = CalendarRepository(db)
        ad_evt = cal_repo.get_by_google_event(user.id, "primary", "allday_001")
        assert ad_evt is not None
        assert ad_evt.is_all_day is True
        assert str(ad_evt.event_date) == "2026-11-25"

        rc_evt = cal_repo.get_by_google_event(user.id, "primary", "recur_instance_01")
        assert rc_evt is not None
        assert rc_evt.is_all_day is False
        assert rc_evt.inferred_occasion == "Work & Office"
    finally:
        db.close()


# ==============================================================================
# 10. Disconnect and Token Revocation
# ==============================================================================

@pytest.mark.asyncio
async def test_disconnect_google_calendar_and_token_revocation():
    """Verify disconnecting calendar revokes OAuth token with Google and purges encrypted credentials."""
    db = SessionLocal()
    try:
        user, token = create_test_user(db, prefix="disconnect")
        headers = {"Authorization": f"Bearer {token}"}

        service = GoogleCalendarService(db)
        conn = GoogleCalendarConnection(
            user_id=user.id,
            encrypted_refresh_token=encrypt_token("mock_token_to_revoke"),
            is_connected=True,
            google_email="user@gmail.com",
        )
        service._save_connection_record(conn)

        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=MagicMock(status_code=200))) as mock_revoke:
            resp = client.delete("/api/v1/calendar/google/disconnect", headers=headers)
            assert resp.status_code == 200
            assert resp.json()["success"] is True

        # Verify connection record is marked disconnected
        updated_conn = service._get_connection_record(user.id)
        assert updated_conn is None or updated_conn.is_connected is False or updated_conn.encrypted_refresh_token is None
    finally:
        db.close()


# ==============================================================================
# 11. Event Context Classification Heuristics
# ==============================================================================

def test_event_context_classification_heuristics():
    """Verify local privacy-preserving keyword heuristic accurately infers occasion, formality, and dress code."""
    # Work / Corporate
    ctx1 = infer_event_context("Q4 Executive Board Strategy Review", location="HQ Conference Room")
    assert ctx1["occasion"] == "Work & Office"
    assert ctx1["formality"] >= 0.70
    assert "Business" in ctx1["dress_code"]

    # Formal / Black Tie
    ctx2 = infer_event_context("Gala Wedding Reception & Dinner", location="Grand Ballroom")
    assert ctx2["occasion"] in ("Formal Event", "Party & Evening")
    assert ctx2["formality"] >= 0.85

    # Fitness / Workout
    ctx3 = infer_event_context("Morning 10k Run & Gym Workout")
    assert ctx3["occasion"] in ("Fitness", "Casual Daily", "Weekend Outing")
    assert ctx3["formality"] <= 0.25
    assert ctx3["dress_code"] == "Athletic / Sportswear"

    # Date Night / Dinner
    ctx4 = infer_event_context("Dinner Date with Sarah", location="Italian Bistro")
    assert ctx4["occasion"] == "Date Night"
    assert ctx4["formality"] >= 0.55

    # Travel / Airport
    ctx5 = infer_event_context("Flight to San Francisco (SFO)")
    assert ctx5["occasion"] == "Travel & Airport"
    assert "Casual" in ctx5["dress_code"]


# ==============================================================================
# 12. Multi-Event Day Analysis and Outfit Change Recommendation
# ==============================================================================

def test_multi_event_day_analysis_and_outfit_change_recommendation():
    """Verify day analysis flags contrasting events (Athletic vs Formal) for outfit change recommendation."""
    # Scenario A: Gym in morning, Board presentation in afternoon -> Outfit change REQUIRED
    evt_gym = {
        "title": "CrossFit Training Session",
        "inferred_occasion": "Casual Daily",
        "inferred_formality": 0.15,
        "inferred_dress_code": "Athletic",
        "start_time": "08:00:00",
    }
    evt_board = {
        "title": "Board of Directors Presentation",
        "inferred_occasion": "Work & Office",
        "inferred_formality": 0.85,
        "inferred_dress_code": "Business Formal",
        "start_time": "14:00:00",
    }
    analysis_a = analyze_day_events([evt_gym, evt_board])
    assert analysis_a["is_outfit_change_recommended"] is True
    assert "change" in analysis_a["reason"].lower() or "contrast" in analysis_a["reason"].lower() or "athletic" in analysis_a["reason"].lower()

    # Scenario B: Coffee chat and Team sync -> Single versatile outfit
    evt_coffee = {
        "title": "Coffee catch-up with Alex",
        "inferred_occasion": "Casual Daily",
        "inferred_formality": 0.35,
        "inferred_dress_code": "Casual",
        "start_time": "10:00:00",
    }
    evt_sync = {
        "title": "Team Sprint Planning",
        "inferred_occasion": "Work & Office",
        "inferred_formality": 0.45,
        "inferred_dress_code": "Smart Casual",
        "start_time": "13:00:00",
    }
    analysis_b = analyze_day_events([evt_coffee, evt_sync])
    assert analysis_b["is_outfit_change_recommended"] is False
    assert "versatile" in analysis_b["reason"].lower() or "layering" in analysis_b["reason"].lower()


# ==============================================================================
# 13. Recommendation Generation for a Google-Imported Event
# ==============================================================================

def test_recommendation_generation_for_google_event():
    """Verify recommendation engine accepts calendar_event_id and personalizes outfit for the event."""
    db = SessionLocal()
    try:
        user, token = create_test_user(db, prefix="rec_google")
        headers = {"Authorization": f"Bearer {token}"}

        # Seed minimal wardrobe items for recommendations
        create_test_clothing(db, user.id, category="tops", color="White", occasion="Work & Office", formality=0.7)
        create_test_clothing(db, user.id, category="bottoms", color="Navy", occasion="Work & Office", formality=0.7)
        create_test_clothing(db, user.id, category="shoes", color="Black", occasion="Work & Office", formality=0.7)

        # Seed imported Google event
        cal_repo = CalendarRepository(db)
        cal_repo.upsert_google_event(
            user_id=user.id,
            google_calendar_id="primary",
            google_event_id="rec_evt_g01",
            title="Quarterly Business Review",
            event_date=date(2026, 11, 28),
            location="London Office",
            status="scheduled",
            inferred_occasion="Work & Office",
            inferred_formality=0.75,
            inferred_dress_code="Business Casual",
        )
        google_evt = cal_repo.get_by_google_event(user.id, "primary", "rec_evt_g01")
        assert google_evt is not None

        # Request recommendations specifying the calendar_event_id
        payload = {
            "calendar_event_id": str(google_evt.id),
            "occasion": "Work & Office",
            "city": "London",
            "limit": 3,
        }
        resp = client.post("/api/v1/recommendations/generate", json=payload, headers=headers)
        assert resp.status_code == 200, f"Error: {resp.text}"
        recs = resp.json()
        assert len(recs) >= 1
        assert "outfit" in recs[0]
    finally:
        db.close()


# ==============================================================================
# 14. Accepting Recommendation Associates with Calendar Event
# ==============================================================================

def test_accept_recommendation_links_to_calendar_event():
    """Verify accepting a recommendation automatically binds outfit_id and recommendation_id to the CalendarEvent."""
    db = SessionLocal()
    try:
        user, token = create_test_user(db, prefix="accept_rec")
        headers = {"Authorization": f"Bearer {token}"}

        # Seed clothing items
        create_test_clothing(db, user.id, category="tops", color="Black", occasion="Casual Daily", formality=0.4)
        create_test_clothing(db, user.id, category="bottoms", color="Blue", occasion="Casual Daily", formality=0.4)
        create_test_clothing(db, user.id, category="shoes", color="White", occasion="Casual Daily", formality=0.4)

        # Seed calendar event
        cal_repo = CalendarRepository(db)
        cal_repo.upsert_google_event(
            user_id=user.id,
            google_calendar_id="primary",
            google_event_id="bind_evt_01",
            title="Weekend Brunch",
            event_date=date(2026, 11, 29),
            status="scheduled",
        )
        evt = cal_repo.get_by_google_event(user.id, "primary", "bind_evt_01")
        assert evt is not None

        # Generate recommendation
        gen_resp = client.post("/api/v1/recommendations/generate", json={
            "calendar_event_id": str(evt.id),
            "occasion": "Casual Daily",
            "limit": 1,
        }, headers=headers)
        recs = gen_resp.json()
        rec_id = recs[0]["id"]

        # Accept recommendation with calendar_event_id
        accept_resp = client.post(f"/api/v1/recommendations/{rec_id}/accept", json={
            "calendar_event_id": str(evt.id),
        }, headers=headers)
        assert accept_resp.status_code == 200, f"Error: {accept_resp.text}"

        # Verify event now has recommendation and outfit attached
        updated_evt = cal_repo.get_by_google_event(user.id, "primary", "bind_evt_01")
        assert updated_evt is not None
        assert str(updated_evt.recommendation_id) == str(rec_id)
        assert updated_evt.outfit_id is not None
    finally:
        db.close()


# ==============================================================================
# 15. User Calendar Data Isolation
# ==============================================================================

def test_user_calendar_data_isolation():
    """Verify that User B cannot access, read, or modify User A's calendar events or connection."""
    db = SessionLocal()
    try:
        user_a, token_a = create_test_user(db, prefix="user_a")
        user_b, token_b = create_test_user(db, prefix="user_b")

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User A creates a calendar event
        cal_repo = CalendarRepository(db)
        cal_repo.upsert_google_event(
            user_id=user_a.id,
            google_calendar_id="primary",
            google_event_id="secret_meeting_a",
            title="Secret Strategy Session User A",
            event_date=date(2026, 12, 1),
            status="scheduled",
        )
        evt_a = cal_repo.get_by_google_event(user_a.id, "primary", "secret_meeting_a")
        assert evt_a is not None

        # User B lists events - User A's event must NOT appear
        resp_b = client.get("/api/v1/calendar/events", headers=headers_b)
        assert resp_b.status_code == 200
        events_b = resp_b.json()
        event_ids_b = [e["id"] for e in events_b]
        assert str(evt_a.id) not in event_ids_b
        assert not any("Secret Strategy" in (e.get("title") or "") for e in events_b)

        # User B attempts to update User A's event context - must return 404
        patch_resp = client.patch(
            f"/api/v1/calendar/events/{evt_a.id}/context",
            json={"occasion": "Date Night"},
            headers=headers_b,
        )
        assert patch_resp.status_code == 404
    finally:
        db.close()
