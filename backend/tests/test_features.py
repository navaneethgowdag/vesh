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
