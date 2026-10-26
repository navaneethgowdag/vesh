import io
import uuid
import pytest
from PIL import Image
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.models import User, Post, Like, Follow, SavedItem
from app.main import app
from app.core.security import create_access_token
from app.services.image_service import image_service


@pytest.fixture(scope="module")
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

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


def _make_user(db, username: str) -> User:
    u = User(
        id=uuid.uuid4(),
        username=username,
        email=f"{username}@test.com",
        password_hash="mock",
        first_name=username.capitalize(),
        last_name="Tester",
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_discovery_excludes_own_posts(client, db_session):
    """Discovery feed (For You) must not show the authenticated user's own posts."""
    user_me = _make_user(db_session, f"me_{uuid.uuid4().hex[:6]}")
    user_other = _make_user(db_session, f"other_{uuid.uuid4().hex[:6]}")

    post_me = Post(
        id=uuid.uuid4(),
        user_id=user_me.id,
        caption="My own outfit post",
        image_url="https://images.unsplash.com/photo-1",
    )
    post_other = Post(
        id=uuid.uuid4(),
        user_id=user_other.id,
        caption="Other creator outfit post",
        image_url="https://images.unsplash.com/photo-2",
    )
    db_session.add_all([post_me, post_other])
    db_session.commit()

    token = create_access_token(subject=str(user_me.id))
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/posts?feed_type=for_you", headers=headers)
    assert res.status_code == 200
    feed = res.json()
    post_ids = [p["id"] for p in feed]

    assert str(post_me.id) not in post_ids, "User's own post must be excluded from discovery"
    assert str(post_other.id) in post_ids, "Other creator's post must be included in discovery"


def test_image_service_webp_generation():
    """Verify ImageService converts image to WebP derivatives without throwing."""
    img = Image.new("RGB", (800, 1000), color=(180, 140, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    result = image_service.process_and_save(jpeg_bytes)
    assert "image_url" in result
    assert "thumbnail_url" in result
    assert result["image_url"].endswith(".webp")
    assert result["thumbnail_url"].endswith(".webp")

