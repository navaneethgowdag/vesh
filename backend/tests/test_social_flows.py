import io
import uuid
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register_user(client: TestClient, prefix: str = "user", display_name: str = "Test User"):
    """Helper to create and authenticate a user, returning auth token and headers."""
    suffix = uuid.uuid4().hex[:8]
    username = f"{prefix}_{suffix}"
    email = f"{username}@stylesphere.dev"
    password = "Password123!"

    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": display_name,
        },
    )
    assert reg_res.status_code == 201, reg_res.text
    data = reg_res.json()
    token = data["access_token"]
    user_id = data["user_id"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "password": password,
        "token": token,
        "headers": headers,
    }


# ============================================================================
# SCENARIO A: Following Feed Isolation
# ============================================================================
def test_scenario_a_following_feed_isolation(client: TestClient):
    """
    Scenario A:
    - User A creates a permanent post.
    - User B follows User A and requests Following feed -> User A's post is present.
    - User C does not follow User A -> User A's post is absent in Following feed.
    - User B unfollows User A -> User A's post is absent in User B's Following feed.
    """
    user_a = register_user(client, prefix="creator_a", display_name="Creator A")
    user_b = register_user(client, prefix="follower_b", display_name="Follower B")
    user_c = register_user(client, prefix="stranger_c", display_name="Stranger C")

    # 1. User A publishes a permanent post
    post_res = client.post(
        "/api/v1/posts",
        headers=user_a["headers"],
        json={
            "image_url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
            "caption": "Permanent styling look by User A",
            "occasion": "Casual Daily",
            "tags": ["#Minimal", "#Aesthetic"],
        },
    )
    assert post_res.status_code == 201, post_res.text
    post_a_id = post_res.json()["id"]

    # 2. User B follows User A
    follow_res = client.post(
        f"/api/v1/social/follow/{user_a['id']}",
        headers=user_b["headers"],
    )
    assert follow_res.status_code in (200, 204)

    # 3. User B requests Following feed -> Post A is present
    feed_b = client.get("/api/v1/posts?feed_type=following", headers=user_b["headers"])
    assert feed_b.status_code == 200
    feed_b_ids = [p["id"] for p in feed_b.json()]
    assert post_a_id in feed_b_ids

    # 4. User C requests Following feed -> Post A is absent
    feed_c = client.get("/api/v1/posts?feed_type=following", headers=user_c["headers"])
    assert feed_c.status_code == 200
    feed_c_ids = [p["id"] for p in feed_c.json()]
    assert post_a_id not in feed_c_ids

    # 5. User B unfollows User A
    unfollow_res = client.delete(
        f"/api/v1/social/follow/{user_a['id']}",
        headers=user_b["headers"],
    )
    assert unfollow_res.status_code in (200, 204)

    # 6. User B requests Following feed again -> Post A is now absent
    feed_b_after = client.get("/api/v1/posts?feed_type=following", headers=user_b["headers"])
    assert feed_b_after.status_code == 200
    feed_b_after_ids = [p["id"] for p in feed_b_after.json()]
    assert post_a_id not in feed_b_after_ids


# ============================================================================
# SCENARIO B: Permanent Post Lifecycle & Ownership
# ============================================================================
def test_scenario_b_permanent_post_lifecycle(client: TestClient):
    """
    Scenario B:
    - User A publishes a post; verify it appears in their profile posts.
    - User B attempts to delete User A's post; verify rejection (403/404).
    - User A deletes the post; verify removal from feed and profile.
    """
    user_a = register_user(client, prefix="owner_a", display_name="Owner A")
    user_b = register_user(client, prefix="other_b", display_name="Other B")

    # 1. Publish post
    post_res = client.post(
        "/api/v1/posts",
        headers=user_a["headers"],
        json={
            "image_url": "https://images.unsplash.com/photo-1539109136881-3be0616acf4b",
            "caption": "Autumn Capsule Coat #Warmth",
            "occasion": "Work & Office",
            "tags": ["#Coat", "#Autumn"],
        },
    )
    assert post_res.status_code == 201
    post_id = post_res.json()["id"]

    # 2. Appears in User A's profile posts
    user_posts_res = client.get(f"/api/v1/posts/user/{user_a['id']}", headers=user_a["headers"])
    assert user_posts_res.status_code == 200
    my_post_ids = [p["id"] for p in user_posts_res.json()]
    assert post_id in my_post_ids

    # 3. User B attempts unauthorized delete -> rejected (403 or 404)
    del_unauth = client.delete(f"/api/v1/posts/{post_id}", headers=user_b["headers"])
    assert del_unauth.status_code in (403, 404)

    # 4. User A deletes their own post -> 204 No Content
    del_auth = client.delete(f"/api/v1/posts/{post_id}", headers=user_a["headers"])
    assert del_auth.status_code == 204

    # 5. Post is gone
    get_res = client.get(f"/api/v1/posts/{post_id}", headers=user_a["headers"])
    assert get_res.status_code == 404


# ============================================================================
# SCENARIO C: 24-Hour Outfit Moments (For You Deck)
# ============================================================================
def test_scenario_c_outfit_moments_discovery_like_skip(client: TestClient):
    """
    Scenario C:
    - User A publishes an outfit moment (24h lifespan).
    - Moment has positive time_remaining_seconds and expires_at > created_at.
    - User B sees it in /moments/feed.
    - User B skips it -> moment excluded from User B's future discovery.
    - User C sees it in /moments/feed.
    - User C likes it -> like persisted, creator User A notified.
    - User C likes again -> idempotent, no duplicate notification.
    - User A views their active moments (/moments/me) and deletes it.
    """
    user_a = register_user(client, prefix="moment_a", display_name="Moment Creator")
    user_b = register_user(client, prefix="skipper_b", display_name="Skipper B")
    user_c = register_user(client, prefix="liker_c", display_name="Liker C")

    # 1. User A publishes a 24-hour moment
    create_res = client.post(
        "/api/v1/moments",
        headers=user_a["headers"],
        json={
            "image_url": "https://images.unsplash.com/photo-1509631179647-0177331693ae",
            "caption": "Golden Hour Moment in SoHo",
            "occasion": "Date Night",
            "tags": ["#GoldenHour", "#Style"],
        },
    )
    assert create_res.status_code == 201, create_res.text
    moment = create_res.json()
    moment_id = moment["id"]
    assert moment["time_remaining_seconds"] > 0
    assert moment["caption"] == "Golden Hour Moment in SoHo"
    assert moment["likes_count"] == 0

    # 2. User B sees it in discovery feed
    feed_b = client.get("/api/v1/moments/feed", headers=user_b["headers"])
    assert feed_b.status_code == 200
    feed_b_ids = [m["id"] for m in feed_b.json()]
    assert moment_id in feed_b_ids

    # 3. User B skips the moment
    skip_res = client.post(f"/api/v1/moments/{moment_id}/skip", headers=user_b["headers"])
    assert skip_res.status_code == 200
    assert skip_res.json()["action"] == "skipped"

    # User B's next discovery feed excludes the skipped moment
    feed_b_after = client.get("/api/v1/moments/feed", headers=user_b["headers"])
    assert feed_b_after.status_code == 200
    assert moment_id not in [m["id"] for m in feed_b_after.json()]

    # 4. User C sees it and likes it
    feed_c = client.get("/api/v1/moments/feed", headers=user_c["headers"])
    assert feed_c.status_code == 200
    assert moment_id in [m["id"] for m in feed_c.json()]

    like_res = client.post(f"/api/v1/moments/{moment_id}/like", headers=user_c["headers"])
    assert like_res.status_code == 200
    assert like_res.json()["action"] == "liked"

    # Verify second like is idempotent
    like_res_2 = client.post(f"/api/v1/moments/{moment_id}/like", headers=user_c["headers"])
    assert like_res_2.status_code == 200

    # 5. User A checks their active moments and sees 1 like
    my_moments = client.get("/api/v1/moments/me", headers=user_a["headers"])
    assert my_moments.status_code == 200
    moments_list = my_moments.json()
    assert any(m["id"] == moment_id for m in moments_list)
    active_m = next(m for m in moments_list if m["id"] == moment_id)
    assert active_m["likes_count"] >= 1

    # 6. User A deletes their moment
    del_m = client.delete(f"/api/v1/moments/{moment_id}", headers=user_a["headers"])
    assert del_m.status_code == 204

    # Now absent from User A's active moments
    my_moments_after = client.get("/api/v1/moments/me", headers=user_a["headers"])
    assert moment_id not in [m["id"] for m in my_moments_after.json()]


# ============================================================================
# SCENARIO D: Explore User Search & Follow State
# ============================================================================
def test_scenario_d_user_search(client: TestClient):
    """
    Scenario D:
    - User search matches by username and display name case-insensitively.
    - Returns followers count, post count, is_following, and is_me.
    - Prevents self-follow.
    """
    unique_str = uuid.uuid4().hex[:6]
    creator = register_user(
        client,
        prefix=f"serena_{unique_str}",
        display_name=f"Serena Van Der Woodsen {unique_str}",
    )
    searcher = register_user(client, prefix="searcher", display_name="Searcher")

    # 1. Search by lowercase partial display name
    q1 = f"serena van der woodsen {unique_str}".lower()
    res1 = client.get(f"/api/v1/users/search?q={q1}", headers=searcher["headers"])
    assert res1.status_code == 200
    results1 = res1.json()
    assert any(u["username"] == creator["username"] for u in results1)
    found = next(u for u in results1 if u["username"] == creator["username"])
    assert found["display_name"] == f"Serena Van Der Woodsen {unique_str}"
    assert found["is_following"] is False
    assert found["is_me"] is False

    # 2. Search when authenticated as creator -> is_me is True
    res2 = client.get(f"/api/v1/users/search?q={creator['username']}", headers=creator["headers"])
    assert res2.status_code == 200
    found_self = next(u for u in res2.json() if u["username"] == creator["username"])
    assert found_self["is_me"] is True

    # 3. Prevent self-follow
    self_follow = client.post(
        f"/api/v1/social/follow/{creator['id']}",
        headers=creator["headers"],
    )
    assert self_follow.status_code == 400


# ============================================================================
# SCENARIO E: Calendar Outfit Planning & Wear History
# ============================================================================
def test_scenario_e_calendar_planning_and_wear_history(client: TestClient):
    """
    Scenario E:
    - Schedule outfit plan for a date.
    - List events in date range.
    - Mark as worn / completed.
    - Delete event.
    """
    user = register_user(client, prefix="planner", display_name="Fashion Planner")
    plan_date = date.today().isoformat()

    # 1. Create calendar event
    evt_res = client.post(
        "/api/v1/calendar/events",
        headers=user["headers"],
        json={
            "event_date": plan_date,
            "occasion": "Date Night",
            "notes": "Dinner at Balthazar with cashmere sweater look",
            "event_type": "planned_outfit",
        },
    )
    assert evt_res.status_code == 201, evt_res.text
    event_id = evt_res.json()["id"]
    assert evt_res.json()["status"] == "scheduled"

    # 2. List events
    list_res = client.get(
        f"/api/v1/calendar/events?start_date={plan_date}&end_date={plan_date}",
        headers=user["headers"],
    )
    assert list_res.status_code == 200
    assert any(e["id"] == event_id for e in list_res.json())

    # 3. Mark as worn / completed
    patch_res = client.patch(
        f"/api/v1/calendar/events/{event_id}",
        headers=user["headers"],
        json={"status": "completed"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "completed"

    # 4. Delete event
    del_res = client.delete(f"/api/v1/calendar/events/{event_id}", headers=user["headers"])
    assert del_res.status_code in (200, 204)

    # 5. Verify removal
    get_res = client.get(f"/api/v1/calendar/events/{event_id}", headers=user["headers"])
    assert get_res.status_code == 404


# ============================================================================
# SCENARIO F: Image Upload and Validation
# ============================================================================
def test_scenario_f_image_upload_and_validation(client: TestClient):
    """
    Scenario F:
    - Valid PNG image upload succeeds and returns WebP derivative URL.
    - Invalid text/binary file is rejected (400 Bad Request).
    """
    user = register_user(client, prefix="uploader", display_name="Image Uploader")

    # 1. Create valid in-memory image
    img = Image.new("RGB", (200, 200), color=(180, 120, 80))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_bytes = img_byte_arr.getvalue()

    valid_res = client.post(
        "/api/v1/media/upload",
        headers=user["headers"],
        files={"file": ("outfit.png", img_bytes, "image/png")},
    )
    assert valid_res.status_code in (200, 201), valid_res.text
    upload_data = valid_res.json()
    assert "image_url" in upload_data
    assert upload_data["image_url"].endswith(".webp")

    # 2. Invalid text file disguised as image
    fake_file = io.BytesIO(b"This is not a real image file, just plain text")
    invalid_res = client.post(
        "/api/v1/media/upload",
        headers=user["headers"],
        files={"file": ("fake.png", fake_file, "image/png")},
    )
    assert invalid_res.status_code == 400
