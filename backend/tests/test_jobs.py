import uuid
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.models import User, Clothing, ClothingAnalysis, BackgroundJob
from app.main import app
from app.core.security import create_access_token
from app.services.job_service import JobService
from app.jobs.clothing_jobs import process_clothing_analysis_job


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
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)


def _create_user(db, username="stylist", email="stylist@test.com"):
    u = User(
        id=uuid.uuid4(),
        username=username,
        email=email,
        password_hash="mockhash",
        first_name="Style",
        last_name="Tester",
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_job_enqueue_and_fallback_execution(client, db_session):
    """Verify job creation, state persistence in database, and fallback execution."""
    u1 = _create_user(db_session, username=f"u1_{uuid.uuid4().hex[:6]}", email=f"u1_{uuid.uuid4().hex[:6]}@t.com")
    token = create_access_token(subject=str(u1.id))
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Enqueue clothing analysis job via API
    res = client.post(
        "/api/v1/clothing-ai/jobs",
        headers=headers,
        json={"image_url": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea"},
    )
    assert res.status_code == 202, res.text
    job_data = res.json()
    assert "id" in job_data
    assert job_data["status"] in ("queued", "processing", "completed")
    job_id = job_data["id"]

    # 2. Query job status by owner
    status_res = client.get(f"/api/v1/clothing-ai/jobs/{job_id}", headers=headers)
    assert status_res.status_code == 200, status_res.text
    polled = status_res.json()
    assert polled["id"] == job_id
    assert polled["job_type"] == "clothing_analysis"

    # 3. Unauthorized access by another user is blocked with 403 Forbidden
    u2 = _create_user(db_session, username=f"u2_{uuid.uuid4().hex[:6]}", email=f"u2_{uuid.uuid4().hex[:6]}@t.com")
    other_token = create_access_token(subject=str(u2.id))
    other_headers = {"Authorization": f"Bearer {other_token}"}

    unauth_res = client.get(f"/api/v1/clothing-ai/jobs/{job_id}", headers=other_headers)
    assert unauth_res.status_code == 403

    # 4. Nonexistent job returns 404
    fake_uuid = str(uuid.uuid4())
    not_found_res = client.get(f"/api/v1/clothing-ai/jobs/{fake_uuid}", headers=headers)
    assert not_found_res.status_code == 404


def test_job_handler_idempotency_and_ownership(db_session):
    """Verify worker task ownership check and idempotency."""
    u = _create_user(db_session, username=f"u_{uuid.uuid4().hex[:6]}", email=f"u_{uuid.uuid4().hex[:6]}@t.com")
    job = BackgroundJob(
        user_id=u.id,
        job_type="clothing_analysis",
        status="completed",
        payload_ref={"image_url": "https://img.test/pic.jpg"},
        result={"detected_category": "Tops", "confidence": 0.95},
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    # Calling worker task on completed job returns existing result idempotently
    res = process_clothing_analysis_job(job_id=str(job.id), user_id=str(u.id), db=db_session)
    assert res.get("detected_category") == "Tops"
    assert res.get("confidence") == 0.95

    # Ownership mismatch returns unauthorized error
    other_id = str(uuid.uuid4())
    unauth_res = process_clothing_analysis_job(job_id=str(job.id), user_id=other_id, db=db_session)
    assert "error" in unauth_res

