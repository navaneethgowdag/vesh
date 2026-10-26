import uuid
from datetime import date, time, datetime, timezone
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.core.database import Base, get_db
from app.models import User, Outfit, Recommendation, Clothing, CalendarEvent, WearHistory
from app.main import app
from app.core.security import create_access_token


@pytest.fixture(scope="module")
def test_db():
    """Isolated SQLite in-memory database with full relationship and constraint validation."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enable SQLite foreign key constraints
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    yield TestingSessionLocal

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_db):
    session = test_db()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(test_db):
    def override_get_db():
        session = test_db()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def user_a(db_session):
    u = User(
        id=uuid.uuid4(),
        username=f"user_a_{uuid.uuid4().hex[:6]}",
        email=f"user_a_{uuid.uuid4().hex[:6]}@example.com",
        password_hash="mockhash",
        first_name="Alice",
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture
def user_b(db_session):
    u = User(
        id=uuid.uuid4(),
        username=f"user_b_{uuid.uuid4().hex[:6]}",
        email=f"user_b_{uuid.uuid4().hex[:6]}@example.com",
        password_hash="mockhash",
        first_name="Bob",
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def auth_headers(user: User):
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}


def test_calendar_event_lifecycle(client, user_a):
    headers = auth_headers(user_a)

    # 1. Create a planned calendar event
    payload = {
        "event_date": "2026-11-01",
        "start_time": "09:30:00",
        "event_type": "planned_outfit",
        "occasion": "Work & Office",
        "notes": "Presentation morning look",
        "status": "scheduled",
    }
    create_res = client.post("/api/v1/calendar/events", headers=headers, json=payload)
    assert create_res.status_code == 201, create_res.text
    event_data = create_res.json()
    event_id = event_data["id"]
    assert event_data["event_date"] == "2026-11-01"
    assert event_data["occasion"] == "Work & Office"
    assert event_data["status"] == "scheduled"

    # 2. Retrieve the event
    get_res = client.get(f"/api/v1/calendar/events/{event_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["notes"] == "Presentation morning look"

    # 3. List events by date range
    list_res = client.get(
        "/api/v1/calendar/events?start_date=2026-11-01&end_date=2026-11-05", headers=headers
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 4. Update the event
    update_res = client.patch(
        f"/api/v1/calendar/events/{event_id}",
        headers=headers,
        json={"notes": "Updated: Client dinner in the evening", "status": "completed"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["notes"] == "Updated: Client dinner in the evening"
    assert update_res.json()["status"] == "completed"

    # 5. Delete the event
    del_res = client.delete(f"/api/v1/calendar/events/{event_id}", headers=headers)
    assert del_res.status_code == 204

    # 6. Verify deleted event returns 404
    get_after_del = client.get(f"/api/v1/calendar/events/{event_id}", headers=headers)
    assert get_after_del.status_code == 404


def test_calendar_cross_user_isolation(client, user_a, user_b):
    headers_a = auth_headers(user_a)
    headers_b = auth_headers(user_b)

    # User A creates an event
    payload = {
        "event_date": "2026-11-10",
        "occasion": "Private Fitting",
        "notes": "Confidential",
    }
    create_res = client.post("/api/v1/calendar/events", headers=headers_a, json=payload)
    assert create_res.status_code == 201
    event_id = create_res.json()["id"]

    # User B cannot read User A's event -> 403 Forbidden
    read_b = client.get(f"/api/v1/calendar/events/{event_id}", headers=headers_b)
    assert read_b.status_code == 403

    # User B cannot modify User A's event -> 403 Forbidden
    patch_b = client.patch(f"/api/v1/calendar/events/{event_id}", headers=headers_b, json={"occasion": "Hacked"})
    assert patch_b.status_code == 403

    # User B cannot delete User A's event -> 403 Forbidden
    del_b = client.delete(f"/api/v1/calendar/events/{event_id}", headers=headers_b)
    assert del_b.status_code == 403


def test_recommendation_scheduling_and_idempotency(client, db_session, user_a):
    headers = auth_headers(user_a)

    # Seed an outfit and recommendation for User A
    clothing_top = Clothing(
        id=uuid.uuid4(),
        user_id=user_a.id,
        name="Tailored Blazer",
        category="Outerwear",
        color="Navy",
        wear_count=2,
    )
    db_session.add(clothing_top)

    outfit = Outfit(
        id=uuid.uuid4(),
        user_id=user_a.id,
        name="Business Minimal Look",
        occasion="Work & Office",
        season="Fall",
    )
    outfit.clothing_items.append(clothing_top)
    db_session.add(outfit)

    rec = Recommendation(
        id=uuid.uuid4(),
        user_id=user_a.id,
        outfit_id=outfit.id,
        weather_condition="Clear",
        temperature=18.0,
        occasion="Work & Office",
        recommendation_score=0.95,
    )
    db_session.add(rec)
    db_session.commit()

    target_date = "2026-11-15"

    # 1. Schedule recommendation via /recommendations/{id}/schedule
    sched_payload = {
        "date": target_date,
        "time": "10:00:00",
        "occasion": "Executive Briefing",
        "notes": "Wear with silver accessories",
    }
    sched_res = client.post(
        f"/api/v1/recommendations/{rec.id}/schedule",
        headers=headers,
        json=sched_payload,
    )
    assert sched_res.status_code == 201, sched_res.text
    event_data = sched_res.json()
    event_id = event_data["id"]
    assert event_data["event_date"] == target_date
    assert event_data["outfit_id"] == str(outfit.id)
    assert event_data["recommendation_id"] == str(rec.id)
    assert event_data["status"] == "scheduled"

    # 2. Verify clothing wear count was NOT incremented (scheduling is NOT wearing)
    db_session.refresh(clothing_top)
    assert clothing_top.wear_count == 2

    # 3. Verify no wear_history record was generated
    wear_count = db_session.query(WearHistory).filter(WearHistory.outfit_id == outfit.id).count()
    assert wear_count == 0

    # 4. Idempotency test: schedule again for same date
    repeat_res = client.post(
        f"/api/v1/recommendations/{rec.id}/schedule",
        headers=headers,
        json=sched_payload,
    )
    assert repeat_res.status_code == 201
    repeat_data = repeat_res.json()
    # Must return the SAME event without creating a duplicate row!
    assert repeat_data["id"] == event_id

    # Verify only 1 calendar event exists for that date
    events = (
        db_session.query(CalendarEvent)
        .filter(CalendarEvent.user_id == user_a.id, CalendarEvent.event_date == date(2026, 11, 15))
        .all()
    )
    assert len(events) == 1
