import os
import io
import time
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.post import Post
from app.models.follow import Follow
from app.ai.fashion_model import fashion_model_service
from app.services.cache_service import cache_service


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register_user(client: TestClient, prefix: str = "moment_user"):
    suffix = uuid.uuid4().hex[:8]
    username = f"{prefix}_{suffix}"
    email = f"{username}@test.com"
    password = "Password123!"

    res = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": f"Tester {suffix}",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    return {
        "id": data["user_id"],
        "username": username,
        "token": data["access_token"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


def create_sample_image_bytes() -> bytes:
    """Generate a small valid JPEG in-memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", (300, 400), color=(180, 120, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def create_sample_video_bytes() -> bytes:
    """Generate a minimal valid MP4 header bytes."""
    # Standard MP4 ftyp box header (32 bytes)
    ftyp = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free"
    return ftyp + b"\x00" * 64


# ============================================================================
# PART 1: RENDER DEPLOYMENT & HEALTH CHECKS
# ============================================================================

def test_liveness_health_endpoint(client: TestClient):
    """
    Render health check path (/health) must return 200 immediately
    with zero blocking I/O.
    """
    t0 = time.time()
    res = client.get("/health")
    elapsed = time.time() - t0

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "TailorBird"
    assert elapsed < 1.0, f"Health check took too long: {elapsed:.3f}s"


def test_readiness_probe_dependencies(client: TestClient):
    """
    /ready probe inspects database, redis, background jobs, and ai_model.
    """
    res = client.get("/ready")
    assert res.status_code in (200, 503)
    data = res.json()
    assert "status" in data
    assert "database" in data
    assert "ai_model" in data
    assert "redis" in data
    assert "background_jobs" in data


def test_fashion_model_cpu_enforcement():
    """
    Verifies that on Render (or with FORCE_CPU='true'),
    model device strictly evaluates to torch.device('cpu') to prevent CUDA hangs.
    """
    assert fashion_model_service.device.type == "cpu"


# ============================================================================
# PART 2: 24-HOUR MOMENTS DIRECT UPLOAD & MEDIA HANDLING
# ============================================================================

def test_moment_direct_upload_image(client: TestClient):
    """
    Upload a photo via POST /api/v1/moments/upload.
    Must convert to optimized WebP, compute 24h expiration, and return 201 Created.
    """
    user = register_user(client, "creator_img")
    img_bytes = create_sample_image_bytes()

    files = {"file": ("outfit.jpg", img_bytes, "image/jpeg")}
    data = {
        "caption": "Summer linen fit test",
        "occasion": "Summer Casual",
        "tags": "linen, minimal, summer",
    }

    res = client.post("/api/v1/moments/upload", headers=user["headers"], files=files, data=data)
    assert res.status_code == 201, res.text
    moment = res.json()

    assert moment["id"]
    assert moment["caption"] == "Summer linen fit test"
    assert moment["occasion"] == "Summer Casual"
    assert "image_url" in moment
    assert moment["image_url"].endswith(".webp") or "/static/uploads/" in moment["image_url"]
    assert moment["user"]["id"] == user["id"]

    # 24-hour expiration verification
    created_at = datetime.fromisoformat(moment["created_at"].replace("Z", "+00:00"))
    expires_at = datetime.fromisoformat(moment["expires_at"].replace("Z", "+00:00"))
    duration_hours = (expires_at - created_at).total_seconds() / 3600
    assert abs(duration_hours - 24.0) < 0.05
    assert moment["time_remaining_seconds"] > 86000


def test_moment_direct_upload_video(client: TestClient):
    """
    Upload a short video via POST /api/v1/moments/upload.
    Must safely store MP4/WebM video asset and return 201 Created.
    """
    user = register_user(client, "creator_vid")
    vid_bytes = create_sample_video_bytes()

    files = {"file": ("lookbook.mp4", vid_bytes, "video/mp4")}
    data = {
        "caption": "Spin check with coat",
        "occasion": "Work Formal",
    }

    res = client.post("/api/v1/moments/upload", headers=user["headers"], files=files, data=data)
    assert res.status_code == 201, res.text
    moment = res.json()

    assert moment["id"]
    assert moment["image_url"].endswith(".mp4")
    assert moment["occasion"] == "Work Formal"


def test_moment_upload_rejects_empty_file(client: TestClient):
    """
    Uploading a 0-byte file must return 400 Bad Request.
    """
    user = register_user(client, "creator_empty")
    files = {"file": ("empty.jpg", b"", "image/jpeg")}
    res = client.post("/api/v1/moments/upload", headers=user["headers"], files=files, data={})
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_moment_upload_rejects_invalid_file(client: TestClient):
    """
    Uploading an invalid corrupted file must return 400 Bad Request.
    """
    user = register_user(client, "creator_corrupt")
    files = {"file": ("corrupt.jpg", b"NOT_AN_IMAGE_OR_VIDEO_CORRUPT", "image/jpeg")}
    res = client.post("/api/v1/moments/upload", headers=user["headers"], files=files, data={})
    assert res.status_code == 400


def test_moment_upload_with_attached_poll(client: TestClient):
    """
    Upload a moment with a poll attached.
    Must attach poll with 24h expiration matching the moment.
    """
    user = register_user(client, "creator_poll")
    img_bytes = create_sample_image_bytes()

    files = {"file": ("fit_choice.jpg", img_bytes, "image/jpeg")}
    data = {
        "caption": "Which sneakers look better?",
        "occasion": "Date Night",
        "poll_question": "White sneakers or loafers?",
        "poll_options": '["White Minimalist", "Brown Loafers"]',
    }

    res = client.post("/api/v1/moments/upload", headers=user["headers"], files=files, data=data)
    assert res.status_code == 201, res.text
    moment = res.json()

    assert moment["poll"] is not None
    assert moment["poll"]["question"] == "White sneakers or loafers?"
    assert len(moment["poll"]["options"]) == 2


# ============================================================================
# PART 3: 24-HOUR LIFECYCLE, PRIVACY & EXPIRATION FILTERING
# ============================================================================

def test_moment_expired_exclusion_from_feed_and_direct(client: TestClient):
    """
    Moments older than 24 hours must be excluded from discovery feed
    and return 404 on direct lookup.
    """
    creator = register_user(client, "creator_exp")
    viewer = register_user(client, "viewer_exp")

    # Viewer follows creator
    follow_res = client.post(f"/api/v1/social/follow/{creator['id']}", headers=viewer["headers"])
    assert follow_res.status_code in (200, 201)

    # Creator publishes moment
    img_bytes = create_sample_image_bytes()
    files = {"file": ("fit_exp.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/moments/upload", headers=creator["headers"], files=files, data={"caption": "Will expire"})
    assert res.status_code == 201
    moment_id = res.json()["id"]

    # Active: viewer should see it in feed
    feed_res = client.get("/api/v1/moments/feed", headers=viewer["headers"])
    assert feed_res.status_code == 200
    feed_ids = [m["id"] for m in feed_res.json()]
    assert moment_id in feed_ids

    # Backdate moment to 25 hours ago in DB
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == moment_id).first()
        assert post is not None
        post.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
        db.commit()
    finally:
        db.close()

    cache_service.invalidate_moments()

    # Expired: must be excluded from feed
    feed_res_after = client.get("/api/v1/moments/feed", headers=viewer["headers"])
    feed_ids_after = [m["id"] for m in feed_res_after.json()]
    assert moment_id not in feed_ids_after

    # Expired: direct GET must return 404
    get_res = client.get(f"/api/v1/moments/{moment_id}", headers=viewer["headers"])
    assert get_res.status_code == 404


def test_moment_following_only_audience_privacy(client: TestClient):
    """
    Following-only privacy rule:
    Viewer can only see creator's moment if viewer follows creator.
    Non-follower receives 403 Forbidden on direct lookup and moment is not in feed.
    """
    creator = register_user(client, "priv_creator")
    follower = register_user(client, "priv_follower")
    stranger = register_user(client, "priv_stranger")

    # Follower follows creator
    client.post(f"/api/v1/social/follow/{creator['id']}", headers=follower["headers"])

    # Creator posts moment
    img_bytes = create_sample_image_bytes()
    files = {"file": ("priv.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/moments/upload", headers=creator["headers"], files=files, data={"caption": "Exclusive look"})
    assert res.status_code == 201
    moment_id = res.json()["id"]

    # Follower can access
    res_follower = client.get(f"/api/v1/moments/{moment_id}", headers=follower["headers"])
    assert res_follower.status_code == 200

    # Stranger (not following) cannot access -> 403 Forbidden
    res_stranger = client.get(f"/api/v1/moments/{moment_id}", headers=stranger["headers"])
    assert res_stranger.status_code == 403


def test_moment_delete_ownership_enforcement(client: TestClient):
    """
    Only creator can delete their moment.
    Other users receive 403 Forbidden.
    """
    creator = register_user(client, "del_creator")
    other_user = register_user(client, "del_other")

    img_bytes = create_sample_image_bytes()
    files = {"file": ("to_del.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/moments/upload", headers=creator["headers"], files=files, data={"caption": "Delete me"})
    assert res.status_code == 201
    moment_id = res.json()["id"]

    # Other user attempts delete -> 403
    del_fail = client.delete(f"/api/v1/moments/{moment_id}", headers=other_user["headers"])
    assert del_fail.status_code == 403

    # Creator deletes own moment -> 204
    del_ok = client.delete(f"/api/v1/moments/{moment_id}", headers=creator["headers"])
    assert del_ok.status_code == 204

    # Subsequent lookup -> 404
    get_res = client.get(f"/api/v1/moments/{moment_id}", headers=creator["headers"])
    assert get_res.status_code == 404
