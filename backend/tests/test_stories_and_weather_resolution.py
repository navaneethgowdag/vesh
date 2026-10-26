import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.post import Post
from app.models.user import User
from app.services.cache_service import cache_service


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _register_user(client: TestClient, role: str):
    suffix = uuid.uuid4().hex[:8]
    data = {
        "username": f"{role}_{suffix}",
        "email": f"{role}_{suffix}@test.com",
        "password": "Password123!",
        "display_name": f"{role.title()} User",
    }
    res = client.post("/api/v1/auth/register", json=data)
    assert res.status_code == 201, res.text
    body = res.json()
    return body["user_id"], {"Authorization": f"Bearer {body['access_token']}"}


def test_stories_restricted_to_following_and_unfollow(client: TestClient):
    """
    Verify:
    1. Instant Stories show content from accounts the authenticated user currently follows ONLY.
    2. Non-followed account stories never appear.
    3. Follow action makes creator's story immediately visible.
    4. Unfollow action makes creator's story immediately disappear.
    """
    user_a_id, h_a = _register_user(client, "creator_a")
    user_b_id, h_b = _register_user(client, "follower_b")
    user_c_id, h_c = _register_user(client, "creator_c")

    # Creator A publishes a story
    res_a = client.post(
        "/api/v1/posts/stories",
        headers=h_a,
        json={"image_url": "https://img.test/story_a.jpg", "caption": "Creator A Daily Fit Story"},
    )
    assert res_a.status_code == 201, res_a.text
    story_a_id = res_a.json()["id"]

    # Creator C (not followed) publishes a story
    res_c = client.post(
        "/api/v1/posts/stories",
        headers=h_c,
        json={"image_url": "https://img.test/story_c.jpg", "caption": "Creator C Story"},
    )
    assert res_c.status_code == 201, res_c.text
    story_c_id = res_c.json()["id"]

    # Before follow: User B's stories endpoint must NOT include Creator A or C
    res_b_before = client.get("/api/v1/posts/stories", headers=h_b)
    assert res_b_before.status_code == 200
    ids_before = [s["id"] for s in res_b_before.json()]
    assert story_a_id not in ids_before
    assert story_c_id not in ids_before

    # User B follows User A
    follow_res = client.post(f"/api/v1/social/follow/{user_a_id}", headers=h_b)
    assert follow_res.status_code == 200

    # User B fetches stories: Creator A's story IS present, Creator C's is NOT
    res_b_after = client.get("/api/v1/posts/stories", headers=h_b)
    assert res_b_after.status_code == 200
    stories_after = res_b_after.json()
    ids_after = [s["id"] for s in stories_after]
    assert story_a_id in ids_after
    assert story_c_id not in ids_after

    # Verify clean caption without internal prefix
    story_item = next(s for s in stories_after if s["id"] == story_a_id)
    assert "Daily Fit Story" in story_item["caption"]
    assert "[STORY:24H:" not in story_item["caption"]

    # User B unfollows User A
    unfollow_res = client.delete(f"/api/v1/social/follow/{user_a_id}", headers=h_b)
    assert unfollow_res.status_code == 200

    # Creator A's story must immediately disappear for User B
    res_b_unfollowed = client.get("/api/v1/posts/stories", headers=h_b)
    assert res_b_unfollowed.status_code == 200
    ids_unfollowed = [s["id"] for s in res_b_unfollowed.json()]
    assert story_a_id not in ids_unfollowed


def test_stories_decoupled_from_permanent_posts(client: TestClient):
    """
    Verify:
    1. Permanent posts are NOT returned in the Instant Stories endpoint.
    2. Instant Stories do NOT appear in the permanent Following feed or profile grid.
    """
    user_a_id, h_a = _register_user(client, "creator_perm")
    user_b_id, h_b = _register_user(client, "follower_perm")

    # Follow A
    client.post(f"/api/v1/social/follow/{user_a_id}", headers=h_b)

    # A creates a permanent post
    perm_res = client.post(
        "/api/v1/posts",
        headers=h_a,
        json={"image_url": "https://img.test/permanent.jpg", "caption": "Permanent Look For Profile"},
    )
    assert perm_res.status_code == 201
    perm_post_id = perm_res.json()["id"]

    # A creates an instant story
    story_res = client.post(
        "/api/v1/posts/stories",
        headers=h_a,
        json={"image_url": "https://img.test/story_look.jpg", "caption": "Ephemeral Story Look"},
    )
    assert story_res.status_code == 201
    story_post_id = story_res.json()["id"]

    # 1. Stories endpoint must include story_post_id, but MUST NOT include perm_post_id
    stories_res = client.get("/api/v1/posts/stories", headers=h_b)
    assert stories_res.status_code == 200
    story_ids = [s["id"] for s in stories_res.json()]
    assert story_post_id in story_ids
    assert perm_post_id not in story_ids

    # 2. Following feed must include perm_post_id, but MUST NOT include story_post_id
    feed_res = client.get("/api/v1/posts?feed_type=following", headers=h_b)
    assert feed_res.status_code == 200
    feed_ids = [p["id"] for p in feed_res.json()]
    assert perm_post_id in feed_ids
    assert story_post_id not in feed_ids

    # 3. Creator's permanent profile grid must include perm_post_id, but NOT story_post_id
    profile_posts_res = client.get(f"/api/v1/posts/user/{user_a_id}", headers=h_b)
    assert profile_posts_res.status_code == 200
    profile_ids = [p["id"] for p in profile_posts_res.json()]
    assert perm_post_id in profile_ids
    assert story_post_id not in profile_ids


def test_stories_expiration_and_own_exclusion(client: TestClient):
    """
    Verify:
    1. Expired stories (>24h old) are excluded.
    2. Current user's own stories are excluded from Following story feed.
    3. Current user can fetch own active stories via GET /api/v1/posts/stories/me.
    """
    user_a_id, h_a = _register_user(client, "creator_exp")
    user_b_id, h_b = _register_user(client, "follower_exp")
    client.post(f"/api/v1/social/follow/{user_a_id}", headers=h_b)

    # Active story from A
    res_active = client.post(
        "/api/v1/posts/stories",
        headers=h_a,
        json={"image_url": "https://img.test/active.jpg", "caption": "Fresh Active Story"},
    )
    active_id = res_active.json()["id"]

    # Expired story from A (>25h ago) directly created in DB
    db = SessionLocal()
    try:
        expired_post = Post(
            user_id=uuid.UUID(user_a_id),
            caption="[STORY:24H:]Expired Story Look",
            image_url="https://img.test/expired.jpg",
            created_at=datetime.now(timezone.utc) - timedelta(hours=26),
        )
        db.add(expired_post)
        db.commit()
        db.refresh(expired_post)
        expired_id = str(expired_post.id)
    finally:
        db.close()

    cache_service.invalidate_stories()

    # User B checks stories: active_id present, expired_id excluded
    res_b = client.get("/api/v1/posts/stories", headers=h_b)
    assert res_b.status_code == 200
    stories_b = res_b.json()
    b_ids = [s["id"] for s in stories_b]
    assert active_id in b_ids
    assert expired_id not in b_ids

    # User A checks /posts/stories: own story is excluded
    res_a = client.get("/api/v1/posts/stories", headers=h_a)
    assert res_a.status_code == 200
    a_ids = [s["id"] for s in res_a.json()]
    assert active_id not in a_ids

    # User A checks /posts/stories/me: own active story IS present
    res_a_me = client.get("/api/v1/posts/stories/me", headers=h_a)
    assert res_a_me.status_code == 200
    me_ids = [s["id"] for s in res_a_me.json()]
    assert active_id in me_ids
    assert expired_id not in me_ids


def test_anonymous_user_gets_empty_stories(client: TestClient):
    """Unauthenticated users receive an empty list for stories."""
    client.cookies.clear()
    res = client.get("/api/v1/posts/stories")
    assert res.status_code == 200
    assert res.json() == []


def test_weather_requires_location_no_fallback_to_new_york(client: TestClient):
    """
    Verify endpoint requires either city or coordinates and does NOT default to New York.
    """
    res = client.get("/api/v1/weather/current")
    assert res.status_code == 400
    assert "Location required" in res.json()["detail"]


def test_weather_coordinate_validation(client: TestClient):
    """
    Verify latitude must be in [-90, 90] and longitude in [-180, 180].
    """
    # Latitude out of bounds
    res_bad_lat = client.get("/api/v1/weather/current?latitude=105.0&longitude=45.0")
    assert res_bad_lat.status_code in (400, 422)

    # Longitude out of bounds
    res_bad_lon = client.get("/api/v1/weather/current?latitude=45.0&longitude=210.0")
    assert res_bad_lon.status_code in (400, 422)


def test_weather_live_coordinates_and_caching(client: TestClient):
    """
    Verify live coordinates return valid weather data and populate normalized Redis cache.
    """
    # Tokyo coordinates: 35.676, 139.650
    lat, lon = 35.676, 139.650
    res = client.get(f"/api/v1/weather/current?latitude={lat}&longitude={lon}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "temp" in data
    assert "feels_like" in data
    assert "humidity" in data
    assert "condition" in data
    assert "city" in data
    assert data["latitude"] == pytest.approx(lat, 0.01)
    assert data["longitude"] == pytest.approx(lon, 0.01)

    # Subsequent request hits Redis cache
    res_cached = client.get(f"/api/v1/weather/current?latitude={lat}&longitude={lon}")
    assert res_cached.status_code == 200
    assert res_cached.json()["temp"] == data["temp"]
