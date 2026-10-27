import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_weather_endpoint_and_coordinates(client):
    """Verify Open-Meteo weather endpoint with city and direct coordinates."""
    # 1. Default / City request
    res = client.get("/api/v1/weather/current?city=Paris")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "city" in data
    assert "temp" in data
    assert "feels_like" in data
    assert "humidity" in data
    assert "condition" in data
    assert "rain_probability" in data
    assert "wind_speed" in data
    assert isinstance(data["temp"], (int, float))

    # 2. Coordinates request (e.g. Tokyo coordinates)
    coord_res = client.get("/api/v1/weather/current?latitude=35.6762&longitude=139.6503")
    assert coord_res.status_code == 200, coord_res.text
    coord_data = coord_res.json()
    assert coord_data["latitude"] == pytest.approx(35.6762, 0.01)
    assert coord_data["longitude"] == pytest.approx(139.6503, 0.01)
    assert isinstance(coord_data["temp"], (int, float))


def test_profile_update_lifecycle(client):
    """Verify authenticated user profile update against actual Neon schema."""
    suffix = uuid.uuid4().hex[:8]
    username = f"user_{suffix}"
    email = f"user_{suffix}@stylesphere.dev"
    password = "SecurePassword123!"

    # 1. Register
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": email, "password": password, "display_name": "Original Name"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Unauthenticated PATCH is rejected
    client.cookies.clear()
    unauth_patch = client.patch("/api/v1/users/me", json={"display_name": "Hacker Name"})
    assert unauth_patch.status_code == 401

    # 3. Authenticated PATCH updates display_name and bio
    patch_res = client.patch(
        "/api/v1/users/me",
        headers=headers,
        json={
            "display_name": "Updated Stylist",
            "bio": "Curating minimal sustainable wardrobes.",
            "profile_image_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        },
    )
    assert patch_res.status_code == 200, patch_res.text
    updated_data = patch_res.json()
    assert updated_data["display_name"] == "Updated Stylist"
    assert updated_data["bio"] == "Curating minimal sustainable wardrobes."
    assert "https://images.unsplash.com/photo-1534528741775-53994a69daeb" in updated_data["profile_image_url"]

    # 4. Verify /auth/me reflects the updated profile
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["display_name"] == "Updated Stylist"
    assert me_res.json()["bio"] == "Curating minimal sustainable wardrobes."


def test_delete_post_security_and_cascade(client):
    """Verify post deletion, authorization checks, and dependent cleanup."""
    suffix1 = uuid.uuid4().hex[:8]
    suffix2 = uuid.uuid4().hex[:8]

    # Register User 1 (Author)
    u1_res = client.post(
        "/api/v1/auth/register",
        json={"username": f"author_{suffix1}", "email": f"a_{suffix1}@stylesphere.dev", "password": "Password123!"},
    )
    assert u1_res.status_code == 201
    token1 = u1_res.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Register User 2 (Other user)
    u2_res = client.post(
        "/api/v1/auth/register",
        json={"username": f"viewer_{suffix2}", "email": f"v_{suffix2}@stylesphere.dev", "password": "Password123!"},
    )
    assert u2_res.status_code == 201
    token2 = u2_res.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # 1. Author creates a post
    post_res = client.post(
        "/api/v1/posts",
        headers=headers1,
        json={"caption": "Spring look", "image_url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f"},
    )
    assert post_res.status_code == 201
    post_id = post_res.json()["id"]

    # 2. User 2 likes and comments on the post
    like_res = client.post(f"/api/v1/posts/{post_id}/like", headers=headers2)
    assert like_res.status_code == 200

    comment_res = client.post(
        f"/api/v1/posts/{post_id}/comments",
        headers=headers2,
        json={"text": "Super chic!"},
    )
    assert comment_res.status_code == 201

    # Save post
    save_res = client.post(f"/api/v1/saved?item_id={post_id}", headers=headers2)
    assert save_res.status_code == 201

    # 3. User 2 attempts to delete Author's post -> 403 Forbidden
    delete_unauth_res = client.delete(f"/api/v1/posts/{post_id}", headers=headers2)
    assert delete_unauth_res.status_code == 403

    # 4. Unauthenticated deletion -> 401 Unauthorized
    client.cookies.clear()
    delete_anon_res = client.delete(f"/api/v1/posts/{post_id}")
    assert delete_anon_res.status_code == 401

    # 5. Author deletes the post -> 204 No Content
    delete_author_res = client.delete(f"/api/v1/posts/{post_id}", headers=headers1)
    assert delete_author_res.status_code == 204

    # 6. Fetching deleted post returns 404
    get_deleted_res = client.get(f"/api/v1/posts/{post_id}", headers=headers1)
    assert get_deleted_res.status_code == 404

    # 7. Deleting already deleted post returns 404
    del_again_res = client.delete(f"/api/v1/posts/{post_id}", headers=headers1)
    assert del_again_res.status_code == 404


def test_feed_following_filter(client):
    """Verify backend-enforced following feed."""
    s1 = uuid.uuid4().hex[:8]
    s2 = uuid.uuid4().hex[:8]
    s3 = uuid.uuid4().hex[:8]

    # User 1 (Follower)
    u1 = client.post("/api/v1/auth/register", json={"username": f"u1_{s1}", "email": f"u1_{s1}@test.com", "password": "Password123!", "display_name": "User One"}).json()
    token1 = u1["access_token"]
    h1 = {"Authorization": f"Bearer {token1}"}

    # User 2 (Followed Creator)
    u2 = client.post("/api/v1/auth/register", json={"username": f"u2_{s2}", "email": f"u2_{s2}@test.com", "password": "Password123!", "display_name": "User Two"}).json()
    token2 = u2["access_token"]
    h2 = {"Authorization": f"Bearer {token2}"}

    # User 3 (Non-followed Creator)
    u3 = client.post("/api/v1/auth/register", json={"username": f"u3_{s3}", "email": f"u3_{s3}@test.com", "password": "Password123!", "display_name": "User Three"}).json()
    token3 = u3["access_token"]
    h3 = {"Authorization": f"Bearer {token3}"}

    # Create posts
    p2 = client.post("/api/v1/posts", headers=h2, json={"caption": "From Creator 2", "image_url": "https://img.test/2.jpg"}).json()
    p3 = client.post("/api/v1/posts", headers=h3, json={"caption": "From Creator 3", "image_url": "https://img.test/3.jpg"}).json()

    # User 1 follows User 2
    follow_res = client.post(f"/api/v1/social/follow/{u2['user_id']}", headers=h1)
    assert follow_res.status_code == 200

    # User 1 gets following feed
    feed_fol = client.get("/api/v1/posts?feed_type=following", headers=h1)
    assert feed_fol.status_code == 200
    fol_posts = feed_fol.json()
    fol_ids = [p["id"] for p in fol_posts]
    assert p2["id"] in fol_ids
    assert p3["id"] not in fol_ids

    # Anonymous user gets following feed -> returns empty list
    client.cookies.clear()
    anon_fol = client.get("/api/v1/posts?feed_type=following")
    assert anon_fol.status_code == 200
    assert anon_fol.json() == []

    # For You feed returns both
    feed_fy = client.get("/api/v1/posts?feed_type=for_you", headers=h1)
    assert feed_fy.status_code == 200
    fy_ids = [p["id"] for p in feed_fy.json()]
    assert p2["id"] in fy_ids
    assert p3["id"] in fy_ids


def test_like_notification_and_deduplication(client):
    """Verify like notifications, self-like prevention, and duplicate prevention."""
    sa = uuid.uuid4().hex[:8]
    sb = uuid.uuid4().hex[:8]

    ua = client.post("/api/v1/auth/register", json={"username": f"ua_{sa}", "email": f"ua_{sa}@test.com", "password": "Password123!", "display_name": "Author Alice"}).json()
    ha = {"Authorization": f"Bearer {ua['access_token']}"}

    ub = client.post("/api/v1/auth/register", json={"username": f"ub_{sb}", "email": f"ub_{sb}@test.com", "password": "Password123!", "display_name": "Bob Stylist"}).json()
    hb = {"Authorization": f"Bearer {ub['access_token']}"}

    # Author creates post
    post = client.post("/api/v1/posts", headers=ha, json={"caption": "Alice fit", "image_url": "https://img.test/a.jpg"}).json()
    post_id = post["id"]

    # Author likes own post (self-like) -> no notification should be sent
    client.post(f"/api/v1/posts/{post_id}/like", headers=ha)
    notifs_a1 = client.get("/api/v1/notifications", headers=ha).json()
    like_notifs_a1 = [n for n in notifs_a1 if n.get("type") == "like"]
    assert len(like_notifs_a1) == 0

    # Bob likes Alice's post
    client.post(f"/api/v1/posts/{post_id}/like", headers=hb)
    notifs_a2 = client.get("/api/v1/notifications", headers=ha).json()
    like_notifs_a2 = [n for n in notifs_a2 if n.get("type") == "like"]
    assert len(like_notifs_a2) == 1
    assert "Bob Stylist" in like_notifs_a2[0]["message"]

    # Bob unlikes and likes again -> no duplicate notification
    client.delete(f"/api/v1/posts/{post_id}/like", headers=hb)
    client.post(f"/api/v1/posts/{post_id}/like", headers=hb)
    notifs_a3 = client.get("/api/v1/notifications", headers=ha).json()
    like_notifs_a3 = [n for n in notifs_a3 if n.get("type") == "like"]
    assert len(like_notifs_a3) == 1

