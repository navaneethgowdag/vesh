import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.post import Post
from app.services.cache_service import cache_service


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register_user(client: TestClient, prefix: str = "user", display_name: str = "Test User"):
    suffix = uuid.uuid4().hex[:8]
    username = f"{prefix}_{suffix}"
    email = f"{username}@test.com"
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
# 1. FOLLOWING-ONLY AUDIENCE RULE VERIFICATION FOR 24-HOUR MOMENTS
# ============================================================================
def test_moment_following_only_audience_rules(client: TestClient):
    """
    Verify Following-Only Audience Rule:
    A user's 24-hour moments must be visible only to users who follow that creator.

    Test matrix:
    1. User B follows User A -> B can see A's active moments in feed & direct GET.
    2. User A follows User C, but C does NOT follow A -> C CANNOT see A's moments,
       excluded from feed and direct GET returns 403 Forbidden.
    3. User D neither follows A nor is followed by A -> D CANNOT see A's moments,
       excluded from feed and direct GET returns 403 Forbidden.
    4. User B unfollows A -> B can no longer retrieve A's moments through feed or direct GET.
    5. Unauthorized user D cannot like or skip -> direct POST /like & /skip return 403.
    6. Anonymous user -> feed returns [], direct GET returns 403.
    7. Creator Alice -> feed excludes own moment, /moments/me includes it, direct GET succeeds.
    """
    user_a = register_user(client, prefix="creator_a", display_name="Creator Alice")
    user_b = register_user(client, prefix="follower_b", display_name="Follower Bob")
    user_c = register_user(client, prefix="followed_c", display_name="Curator Charlie")
    user_d = register_user(client, prefix="stranger_d", display_name="Stranger David")

    # Establish connections:
    # 1. B follows A
    res_ba = client.post(f"/api/v1/social/follow/{user_a['id']}", headers=user_b["headers"])
    assert res_ba.status_code in (200, 204)

    # 2. A follows C (C does NOT follow A)
    res_ac = client.post(f"/api/v1/social/follow/{user_c['id']}", headers=user_a["headers"])
    assert res_ac.status_code in (200, 204)

    # 3. D has no relationship with A

    # Creator Alice publishes a 24-hour outfit moment
    m_res = client.post(
        "/api/v1/moments",
        headers=user_a["headers"],
        json={
            "image_url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
            "caption": "Alice's Daily Look in Soho",
            "occasion": "Casual Daily",
            "tags": ["#AliceStyle"],
        },
    )
    assert m_res.status_code == 201, m_res.text
    moment = m_res.json()
    moment_id = moment["id"]
    assert moment["time_remaining_seconds"] > 0
    assert moment["likes_count"] == 0

    # CASE 1: User B follows User A -> B can see A's active moments
    feed_b = client.get("/api/v1/moments/feed", headers=user_b["headers"])
    assert feed_b.status_code == 200
    feed_b_ids = [m["id"] for m in feed_b.json()]
    assert moment_id in feed_b_ids

    direct_b = client.get(f"/api/v1/moments/{moment_id}", headers=user_b["headers"])
    assert direct_b.status_code == 200
    assert direct_b.json()["id"] == moment_id

    # CASE 2: User A follows User C, but C does NOT follow A -> C CANNOT see A's moments
    feed_c = client.get("/api/v1/moments/feed", headers=user_c["headers"])
    assert feed_c.status_code == 200
    feed_c_ids = [m["id"] for m in feed_c.json()]
    assert moment_id not in feed_c_ids, "User C should not see moment of User A whom C does not follow"

    direct_c = client.get(f"/api/v1/moments/{moment_id}", headers=user_c["headers"])
    assert direct_c.status_code == 403, "Direct GET should be 403 for non-follower"
    assert "not authorized" in direct_c.json()["detail"].lower()

    # CASE 3: User D has no relationship -> D CANNOT see A's moments
    feed_d = client.get("/api/v1/moments/feed", headers=user_d["headers"])
    assert feed_d.status_code == 200
    feed_d_ids = [m["id"] for m in feed_d.json()]
    assert moment_id not in feed_d_ids

    direct_d = client.get(f"/api/v1/moments/{moment_id}", headers=user_d["headers"])
    assert direct_d.status_code == 403
    assert "not authorized" in direct_d.json()["detail"].lower()

    # CASE 4: Unauthorized user D cannot like or skip
    like_d = client.post(f"/api/v1/moments/{moment_id}/like", headers=user_d["headers"])
    assert like_d.status_code == 403
    skip_d = client.post(f"/api/v1/moments/{moment_id}/skip", headers=user_d["headers"])
    assert skip_d.status_code == 403

    # CASE 5: Unauthenticated viewer receives empty feed & 403 on direct fetch
    client.cookies.clear()
    anon_feed = client.get("/api/v1/moments/feed")
    assert anon_feed.status_code == 200
    assert anon_feed.json() == []

    anon_direct = client.get(f"/api/v1/moments/{moment_id}")
    assert anon_direct.status_code == 403

    # CASE 6: Creator Alice can access own moment through /moments/me & direct GET
    feed_a = client.get("/api/v1/moments/feed", headers=user_a["headers"])
    assert feed_a.status_code == 200
    assert moment_id not in [m["id"] for m in feed_a.json()]

    me_a = client.get("/api/v1/moments/me", headers=user_a["headers"])
    assert me_a.status_code == 200
    assert any(m["id"] == moment_id for m in me_a.json())

    direct_a = client.get(f"/api/v1/moments/{moment_id}", headers=user_a["headers"])
    assert direct_a.status_code == 200
    assert direct_a.json()["id"] == moment_id

    # CASE 7: User B unfollows User A -> B can no longer retrieve A's moments
    unfol_res = client.delete(f"/api/v1/social/follow/{user_a['id']}", headers=user_b["headers"])
    assert unfol_res.status_code in (200, 204)

    feed_b_after = client.get("/api/v1/moments/feed", headers=user_b["headers"])
    assert feed_b_after.status_code == 200
    feed_b_after_ids = [m["id"] for m in feed_b_after.json()]
    assert moment_id not in feed_b_after_ids

    direct_b_after = client.get(f"/api/v1/moments/{moment_id}", headers=user_b["headers"])
    assert direct_b_after.status_code == 403


# ============================================================================
# 2. MOMENT 24-HOUR EXPIRATION AND DELETION
# ============================================================================
def test_moment_expiration_and_deletion(client: TestClient):
    """
    Verify:
    1. Moments older than 24h are excluded from feed and return 404 on direct fetch.
    2. Creator can delete active moment -> returns 204.
    3. Unauthorized user cannot delete moment -> returns 403.
    """
    user_a = register_user(client, prefix="exp_a", display_name="Alice Expiry")
    user_b = register_user(client, prefix="exp_b", display_name="Bob Expiry")

    # B follows A
    client.post(f"/api/v1/social/follow/{user_a['id']}", headers=user_b["headers"])

    # Active moment
    res_act = client.post(
        "/api/v1/moments",
        headers=user_a["headers"],
        json={"image_url": "https://img.test/active.jpg", "caption": "Fresh Moment"},
    )
    assert res_act.status_code == 201
    act_id = res_act.json()["id"]

    # Expired moment (>25 hours ago) created directly in DB
    db = SessionLocal()
    try:
        expired_post = Post(
            user_id=uuid.UUID(user_a["id"]),
            caption="[MOMENT:24H:Casual Daily]Old Expired Look",
            image_url="https://img.test/expired.jpg",
            created_at=datetime.now(timezone.utc) - timedelta(hours=26),
        )
        db.add(expired_post)
        db.commit()
        db.refresh(expired_post)
        exp_id = str(expired_post.id)
    finally:
        db.close()

    # Bob's feed includes active, but excludes expired
    feed_b = client.get("/api/v1/moments/feed", headers=user_b["headers"])
    assert feed_b.status_code == 200
    feed_b_ids = [m["id"] for m in feed_b.json()]
    assert act_id in feed_b_ids
    assert exp_id not in feed_b_ids

    # Bob direct GET on expired -> 404 Not Found
    exp_direct = client.get(f"/api/v1/moments/{exp_id}", headers=user_b["headers"])
    assert exp_direct.status_code == 404

    # Bob attempts to delete Alice's active moment -> 403 Forbidden
    del_unauth = client.delete(f"/api/v1/moments/{act_id}", headers=user_b["headers"])
    assert del_unauth.status_code == 403

    # Alice deletes active moment -> 204 No Content
    del_auth = client.delete(f"/api/v1/moments/{act_id}", headers=user_a["headers"])
    assert del_auth.status_code == 204

    # Alice checks /moments/me -> act_id is gone
    me_a = client.get("/api/v1/moments/me", headers=user_a["headers"])
    assert me_a.status_code == 200
    assert act_id not in [m["id"] for m in me_a.json()]


# ============================================================================
# 3. STRICT SEPARATION: PERMANENT POSTS VS 24-HOUR MOMENTS
# ============================================================================
def test_strict_separation_posts_and_moments(client: TestClient):
    """
    Verify:
    1. Permanent posts appear in Following feed and profile grid, never in /moments/feed.
    2. 24h moments appear in /moments/feed, never in Following feed or profile grid.
    3. Permanent Following feed behavior remains unchanged.
    """
    user_a = register_user(client, prefix="sep_a", display_name="Curator Sep")
    user_b = register_user(client, prefix="sep_b", display_name="Follower Sep")

    client.post(f"/api/v1/social/follow/{user_a['id']}", headers=user_b["headers"])

    # 1. User A creates permanent post
    post_res = client.post(
        "/api/v1/posts",
        headers=user_a["headers"],
        json={"image_url": "https://img.test/perm.jpg", "caption": "Permanent Editorial Look"},
    )
    assert post_res.status_code == 201
    perm_id = post_res.json()["id"]

    # 2. User A creates 24h outfit moment
    moment_res = client.post(
        "/api/v1/moments",
        headers=user_a["headers"],
        json={"image_url": "https://img.test/moment.jpg", "caption": "Ephemeral Outfit Moment"},
    )
    assert moment_res.status_code == 201
    moment_id = moment_res.json()["id"]

    # 3. Following feed has permanent post, NEVER moment
    fol_feed = client.get("/api/v1/posts?feed_type=following", headers=user_b["headers"])
    assert fol_feed.status_code == 200
    fol_ids = [p["id"] for p in fol_feed.json()]
    assert perm_id in fol_ids
    assert moment_id not in fol_ids

    # 4. User A profile grid has permanent post, NEVER moment
    profile = client.get(f"/api/v1/posts/user/{user_a['id']}", headers=user_b["headers"])
    assert profile.status_code == 200
    prof_ids = [p["id"] for p in profile.json()]
    assert perm_id in prof_ids
    assert moment_id not in prof_ids

    # 5. Moments discovery feed has moment, NEVER permanent post
    moments_feed = client.get("/api/v1/moments/feed", headers=user_b["headers"])
    assert moments_feed.status_code == 200
    moments_ids = [m["id"] for m in moments_feed.json()]
    assert moment_id in moments_ids
    assert perm_id not in moments_ids


# ============================================================================
# 4. REDIS CACHE INVALIDATION AND RECHECK VERIFICATION
# ============================================================================
def test_redis_cache_invalidation_helper():
    """Verify cache_service invalidate_moments executes without error."""
    cache_service.invalidate_moments()
    cache_service.invalidate_moments(user_id=uuid.uuid4())
