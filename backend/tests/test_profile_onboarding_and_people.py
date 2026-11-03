"""
Automated Test Suite for TailorBird:
- Profile Photo Direct Upload (BYTEA storage, validation, center-crop, max 5MB)
- Public Binary Avatar Retrieval (/users/{id}/avatar)
- Profile Photo Removal / Fallback to Faceless Avatar
- First-Time User Onboarding Flow (/users/me/onboarding) & Persistence in Neon
- Personalization Engine Integration (Onboarding answers boosting recommendations)
- Explore People Search (/users/search) with Privacy Safeguards
- Rebranding Verification (TailorBird root and health check)
"""

import io
import uuid
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.main import app
from app.models.user import User
from app.services.profile_image_service import ProfileImageService
from app.services.recommendation_service import RecommendationService

settings = get_settings()
client = TestClient(app)


def create_test_image(width=600, height=400, format="JPEG", color="blue"):
    """Helper to generate an in-memory image for upload testing."""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture
def auth_user():
    """Create a temporary test user and return user object, auth token, and header."""
    db = SessionLocal()
    unique = uuid.uuid4().hex[:8]
    user = User(
        username=f"user_{unique}",
        email=f"test_profile_{unique}@example.com",
        first_name="Test",
        last_name=f"Profile {unique}",
        bio=f"Capsule curator {unique}",
        password_hash="fakehashedpassword",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    headers = {"Authorization": f"Bearer {token}"}

    yield {"user": user, "token": token, "headers": headers, "db": db}

    # Teardown
    try:
        service = ProfileImageService(db)
        service.delete_avatar(user.id)
        db.delete(user)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


# ============================================================================
# 1. PROFILE PHOTO DIRECT UPLOAD & VALIDATION TESTS
# ============================================================================

def test_profile_image_service_validation_and_crop():
    """Test ProfileImageService processing, magic-bytes check, and 512x512 square crop."""
    db = SessionLocal()
    try:
        service = ProfileImageService(db)

        # 1. Valid non-square image
        raw_img = create_test_image(width=800, height=600, format="JPEG")
        processed_bytes, mime, w, h = service.validate_and_process_image(raw_img)

        assert mime in ("image/webp", "image/jpeg")
        assert w == 512
        assert h == 512
        assert len(processed_bytes) > 0

        # Verify processed result is an actual valid image of 512x512
        result_img = Image.open(io.BytesIO(processed_bytes))
        assert result_img.size == (512, 512)

        # 2. Rejection of invalid non-image bytes
        with pytest.raises(Exception):
            service.validate_and_process_image(b"NOT_AN_IMAGE_FILE_DATA")

        # 3. Rejection of oversized file (> 5MB)
        huge_bytes = b"0" * (5 * 1024 * 1024 + 100)
        with pytest.raises(Exception):
            service.validate_and_process_image(huge_bytes)
    finally:
        db.close()


def test_avatar_upload_and_public_retrieval(auth_user):
    """Test POST /api/v1/users/me/avatar direct upload and GET /api/v1/users/{id}/avatar."""
    user = auth_user["user"]
    headers = auth_user["headers"]

    img_data = create_test_image(width=500, height=500, format="PNG", color="red")
    files = {"file": ("avatar.png", img_data, "image/png")}

    # 1. Upload avatar
    resp = client.post("/api/v1/users/me/avatar", files=files, headers=headers)
    assert resp.status_code == 200, f"Upload failed: {resp.text}"
    result = resp.json()

    assert result["success"] is True
    assert result["avatar_url"] is not None
    assert f"/api/v1/users/{user.id}/avatar" in result["avatar_url"]

    # 2. Public retrieval without auth token (avatars are public)
    avatar_resp = client.get(f"/api/v1/users/{user.id}/avatar")
    assert avatar_resp.status_code == 200
    assert avatar_resp.headers["Content-Type"] in ("image/webp", "image/jpeg", "image/png")
    assert "Cache-Control" in avatar_resp.headers
    assert len(avatar_resp.content) > 0

    # 3. GET /api/v1/users/me/avatar with auth
    me_avatar_resp = client.get("/api/v1/users/me/avatar", headers=headers)
    assert me_avatar_resp.status_code == 200
    assert len(me_avatar_resp.content) == len(avatar_resp.content)


def test_avatar_delete_reverts_to_faceless(auth_user):
    """Test DELETE /api/v1/users/me/avatar removes uploaded photo for faceless avatar fallback."""
    user = auth_user["user"]
    headers = auth_user["headers"]

    # Upload first
    img_data = create_test_image(width=400, height=400, format="JPEG")
    client.post("/api/v1/users/me/avatar", files={"file": ("photo.jpg", img_data, "image/jpeg")}, headers=headers)

    # Delete avatar
    del_resp = client.delete("/api/v1/users/me/avatar", headers=headers)
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["success"] is True
    assert del_data["avatar_url"] is None

    # Public retrieval now returns 404
    get_del_resp = client.get(f"/api/v1/users/{user.id}/avatar")
    assert get_del_resp.status_code == 404


def test_profile_update_ignores_external_avatar_urls(auth_user):
    """Verify PATCH /users/me discards external image URL strings to prevent URL phishing."""
    headers = auth_user["headers"]

    patch_resp = client.patch(
        "/api/v1/users/me",
        json={"bio": "Updated bio text", "avatar_url": "https://external-phishing.com/avatar.jpg"},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    patched_user = patch_resp.json()
    assert patched_user["bio"] == "Updated bio text"
    # external avatar URL was safely ignored
    assert patched_user.get("profile_image_url") != "https://external-phishing.com/avatar.jpg"


# ============================================================================
# 2. ONBOARDING & PERSONALIZATION TESTS
# ============================================================================

def test_onboarding_submission_and_persistence(auth_user):
    """Test POST /api/v1/users/me/onboarding stores full personalization profile."""
    headers = auth_user["headers"]

    onboarding_payload = {
        "gender": "feminine",
        "avatar_style": "feminine",
        "preferred_styles": ["Minimalist", "Indian Ethnic", "Quiet Luxury"],
        "disliked_styles": ["Grunge"],
        "favorite_colors": ["#000000", "#F5F5DC", "#B87333"],
        "preferred_fits": ["Relaxed", "Tailored"],
        "wardrobe_staples": ["Blazers", "Trousers", "Kurtas"],
        "lifestyle_occasions": ["Work", "Evening", "Casual"],
        "budget_preference": "luxury",
        "styling_preference": "effortless chic",
        "country": "India",
    }

    resp = client.post("/api/v1/users/me/onboarding", json=onboarding_payload, headers=headers)
    assert resp.status_code == 200, f"Onboarding failed: {resp.text}"
    user_res = resp.json()

    assert user_res["onboarding_completed"] is True
    assert user_res["gender"] == "feminine"
    assert user_res["avatar_style"] == "feminine"

    # Verify retrieval via GET /users/me/preferences
    pref_resp = client.get("/api/v1/users/me/preferences", headers=headers)
    assert pref_resp.status_code == 200
    prefs = pref_resp.json()
    assert "Minimalist" in prefs["preferred_styles"]
    assert "Indian Ethnic" in prefs["preferred_styles"]
    assert prefs["gender"] == "feminine"
    assert prefs["budget_preference"] == "luxury"
    assert prefs["onboarding_completed"] is True


def test_onboarding_boosts_recommendation_scoring(auth_user):
    """Verify onboarding explicit style affinities boost recommendation scores."""
    user = auth_user["user"]
    db = auth_user["db"]
    headers = auth_user["headers"]

    # Submit onboarding preference with "Streetwear"
    client.post(
        "/api/v1/users/me/onboarding",
        json={"preferred_styles": ["Streetwear"], "gender": "masculine", "avatar_style": "masculine"},
        headers=headers,
    )

    rec_service = RecommendationService(db)
    user_pref = rec_service.user_repo.get_preferences(user.id)
    assert user_pref is not None
    assert "Streetwear" in user_pref.preferred_styles

    streetwear_item = type("MockClothing", (), {"style": "streetwear", "category": "top", "name": "Oversized Hoodie", "color": "black", "pattern": "solid"})()
    unrelated_item = type("MockClothing", (), {"style": "boho", "category": "top", "name": "Boho Blouse", "color": "neon_green", "pattern": "floral"})()

    streetwear_bonus = rec_service._compute_preference_rotation_bonus(
        items=[streetwear_item],
        preferred_colors=[],
        user_pref=user_pref,
    )
    unrelated_bonus = rec_service._compute_preference_rotation_bonus(
        items=[unrelated_item],
        preferred_colors=[],
        user_pref=user_pref,
    )

    # Streetwear bonus should be significantly higher due to onboarding affinity
    assert streetwear_bonus > unrelated_bonus


# ============================================================================
# 3. PEOPLE SEARCH & PRIVACY SAFEGUARD TESTS
# ============================================================================

def test_people_search_matches_and_privacy(auth_user):
    """Test GET /api/v1/users/search with query matching display_name, username, bio, and privacy checks."""
    user = auth_user["user"]
    headers = auth_user["headers"]

    # 1. Search by username prefix
    resp = client.get(f"/api/v1/users/search?q={user.username}", headers=headers)
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) >= 1
    found = next((u for u in results if u["id"] == str(user.id)), None)
    assert found is not None
    assert found["username"] == user.username
    assert found["display_name"] == user.display_name
    assert found["bio"] == user.bio
    assert found["is_me"] is True

    # 2. Verify privacy safeguards: No sensitive data exposed in search results
    for res in results:
        assert "password" not in res
        assert "password_hash" not in res
        assert "hashed_password" not in res
        assert "email" not in res
        assert "google_id" not in res
        assert "calendar_credentials" not in res

    # 3. Search by bio keyword
    bio_resp = client.get(f"/api/v1/users/search?q={user.bio.split()[-1]}", headers=headers)
    assert bio_resp.status_code == 200
    bio_results = bio_resp.json()
    assert any(u["id"] == str(user.id) for u in bio_results)


# ============================================================================
# 4. BRAND REBRANDING VERIFICATION TESTS
# ============================================================================

def test_tailorbird_brand_root_and_health():
    """Verify root / and health endpoints reflect TailorBird branding."""
    root_resp = client.get("/")
    assert root_resp.status_code == 200
    root_data = root_resp.json()
    assert root_data["service"] == "TailorBird API"

    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert health_data["app"] == "TailorBird"
