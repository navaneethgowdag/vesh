import io
import uuid
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.image_service import UPLOAD_DIR
import os


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _create_user(client: TestClient, prefix: str = "usr"):
    uid = uuid.uuid4().hex[:8]
    username = f"{prefix}_{uid}"
    email = f"{username}@example.com"
    password = "SecurePassword123!"

    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": f"User {uid}",
        },
    )
    assert resp.status_code == 201, f"User creation failed: {resp.text}"
    token = resp.json()["access_token"]
    user_id = resp.json()["user_id"]
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "password": password,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


def _generate_test_image_bytes(format="JPEG", size=(200, 200), color=(180, 100, 50)):
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


class TestMediaUploadAndServing:
    def test_upload_image_success_and_retrieval(self, client: TestClient):
        user = _create_user(client, "media_usr")
        img_bytes = _generate_test_image_bytes("JPEG", (400, 400), (120, 80, 40))

        # 1. Upload via POST /api/v1/media/upload
        files = {
            "file": ("test_look.jpg", img_bytes, "image/jpeg"),
        }
        res = client.post("/api/v1/media/upload", files=files, headers=user["headers"])
        assert res.status_code == 200, f"Upload failed: {res.text}"
        data = res.json()
        assert "image_url" in data
        assert "thumbnail_url" in data
        assert data["image_url"].startswith("/static/uploads/")
        assert data["thumbnail_url"].startswith("/static/uploads/")
        assert data["image_url"].endswith(".webp")

        feed_filename = os.path.basename(data["image_url"])
        thumb_filename = os.path.basename(data["thumbnail_url"])

        # 2. Verify files exist on disk
        feed_disk_path = os.path.join(UPLOAD_DIR, feed_filename)
        thumb_disk_path = os.path.join(UPLOAD_DIR, thumb_filename)
        assert os.path.exists(feed_disk_path), "Feed image derivative was not saved on disk"
        assert os.path.exists(thumb_disk_path), "Thumbnail image derivative was not saved on disk"
        assert os.path.getsize(feed_disk_path) > 0

        # 3. Verify retrieval via GET /static/uploads/{filename} (StaticFiles mount)
        static_res = client.get(data["image_url"])
        assert static_res.status_code == 200, f"Static fetch failed: {static_res.status_code}"
        assert static_res.headers.get("content-type") == "image/webp"
        assert len(static_res.content) > 0
        assert static_res.headers.get("access-control-allow-origin") == "*"

        # 4. Verify retrieval via GET /api/v1/media/uploads/{filename}
        api_media_res = client.get(f"/api/v1/media/uploads/{feed_filename}")
        assert api_media_res.status_code == 200, f"API media fetch failed: {api_media_res.status_code}"
        assert api_media_res.headers.get("content-type") == "image/webp"
        assert len(api_media_res.content) == len(static_res.content)
        assert api_media_res.headers.get("access-control-allow-origin") == "*"

        # 5. Verify retrieval via GET /api/v1/media/{filename}
        direct_media_res = client.get(f"/api/v1/media/{feed_filename}")
        assert direct_media_res.status_code == 200
        assert direct_media_res.headers.get("content-type") == "image/webp"

    def test_upload_invalid_file_rejected(self, client: TestClient):
        user = _create_user(client, "media_bad")
        files = {
            "file": ("script.sh", b"echo 'hack'", "text/x-sh"),
        }
        res = client.post("/api/v1/media/upload", files=files, headers=user["headers"])
        assert res.status_code == 400


class TestFollowerCountsAndSocialEndpoints:
    def test_self_follow_rejected(self, client: TestClient):
        user = _create_user(client, "self_usr")
        res = client.post(f"/api/v1/social/follow/{user['id']}", headers=user["headers"])
        assert res.status_code == 400
        assert "cannot follow yourself" in res.json().get("detail", "").lower()

    def test_follow_unfollow_lifecycle_and_counts(self, client: TestClient):
        user_a = _create_user(client, "follow_a")
        user_b = _create_user(client, "follow_b")

        # Initial counts should be 0
        profile_b_init = client.get(f"/api/v1/users/{user_b['username']}", headers=user_a["headers"]).json()
        profile_a_init = client.get(f"/api/v1/users/{user_a['username']}", headers=user_a["headers"]).json()
        assert profile_b_init["followers_count"] == 0
        assert profile_a_init["following_count"] == 0
        assert profile_b_init["is_following"] is False

        # User A follows User B
        follow_res = client.post(f"/api/v1/social/follow/{user_b['id']}", headers=user_a["headers"])
        assert follow_res.status_code == 200
        follow_data = follow_res.json()
        assert follow_data["following"] is True
        assert follow_data["follower_count"] == 1
        assert follow_data["following_count"] == 1

        # Check User B's profile: followers_count == 1, is_following == True
        profile_b_after = client.get(f"/api/v1/users/{user_b['username']}", headers=user_a["headers"]).json()
        assert profile_b_after["followers_count"] == 1
        assert profile_b_after["is_following"] is True

        # Check User A's /auth/me: following_count == 1
        me_a_after = client.get("/api/v1/auth/me", headers=user_a["headers"]).json()
        assert me_a_after["following_count"] == 1

        # Duplicate follow is idempotent
        dup_res = client.post(f"/api/v1/social/follow/{user_b['id']}", headers=user_a["headers"])
        assert dup_res.status_code == 200
        assert dup_res.json()["following"] is True

        # User A unfollows User B
        unfollow_res = client.delete(f"/api/v1/social/follow/{user_b['id']}", headers=user_a["headers"])
        assert unfollow_res.status_code == 200
        unfollow_data = unfollow_res.json()
        assert unfollow_data["following"] is False
        assert unfollow_data["follower_count"] == 0
        assert unfollow_data["following_count"] == 0

        # Verify User B's followers decremented to 0
        profile_b_unfollowed = client.get(f"/api/v1/users/{user_b['username']}", headers=user_a["headers"]).json()
        assert profile_b_unfollowed["followers_count"] == 0
        assert profile_b_unfollowed["is_following"] is False

        # Verify User A's following decremented to 0
        me_a_unfollowed = client.get("/api/v1/auth/me", headers=user_a["headers"]).json()
        assert me_a_unfollowed["following_count"] == 0

    def test_followers_and_following_list_endpoints(self, client: TestClient):
        user_target = _create_user(client, "target")
        user_f1 = _create_user(client, "fan1")
        user_f2 = _create_user(client, "fan2")
        viewer = _create_user(client, "viewer")

        # Fan1 and Fan2 follow target
        client.post(f"/api/v1/social/follow/{user_target['id']}", headers=user_f1["headers"])
        client.post(f"/api/v1/social/follow/{user_target['id']}", headers=user_f2["headers"])

        # Target also follows Fan1 back
        client.post(f"/api/v1/social/follow/{user_f1['id']}", headers=user_target["headers"])

        # Viewer follows Fan1
        client.post(f"/api/v1/social/follow/{user_f1['id']}", headers=viewer["headers"])

        # 1. Fetch Target's followers from Viewer's perspective
        res_followers = client.get(f"/api/v1/social/followers/{user_target['id']}", headers=viewer["headers"])
        assert res_followers.status_code == 200
        followers = res_followers.json()
        assert len(followers) == 2
        follower_ids = [f["id"] for f in followers]
        assert user_f1["id"] in follower_ids
        assert user_f2["id"] in follower_ids

        # Fan 1 is followed by viewer, so is_following should be True for Fan 1
        fan1_entry = next(f for f in followers if f["id"] == user_f1["id"])
        assert fan1_entry["is_following"] is True
        assert fan1_entry["is_me"] is False

        # Fan 2 is NOT followed by viewer, so is_following should be False
        fan2_entry = next(f for f in followers if f["id"] == user_f2["id"])
        assert fan2_entry["is_following"] is False
        assert fan2_entry["is_me"] is False

        # 2. Fetch Target's following from Target's own perspective
        res_following = client.get(f"/api/v1/social/following/{user_target['id']}", headers=user_target["headers"])
        assert res_following.status_code == 200
        following = res_following.json()
        assert len(following) == 1
        assert following[0]["id"] == user_f1["id"]
        assert following[0]["username"] == user_f1["username"]

        # 3. Test pagination limit/offset
        paged_res = client.get(f"/api/v1/social/followers/{user_target['id']}?limit=1&offset=0")
        assert paged_res.status_code == 200
        assert len(paged_res.json()) == 1

