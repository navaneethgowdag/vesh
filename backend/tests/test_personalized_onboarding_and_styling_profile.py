"""
Comprehensive test suite for personalized onboarding and styling profile endpoints.
Verifies:
- 6-step onboarding payload persistence
- GET /api/v1/users/me/styling-profile
- PATCH /api/v1/users/me/styling-profile independent section updates
- Data isolation and safe persistence without raw DDL migrations
"""

import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.user_preference import UserPreference
from app.core.security import create_access_token


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def auth_user_and_headers(db_session):
    username = f"style_user_{uuid4().hex[:8]}"
    email = f"{username}@example.com"
    user = User(
        username=username,
        email=email,
        password_hash="hashed_pw_test",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    yield user, headers

    # Teardown
    try:
        pref = db_session.query(UserPreference).filter(UserPreference.user_id == user.id).first()
        if pref:
            db_session.delete(pref)
        db_session.delete(user)
        db_session.commit()
    except Exception:
        db_session.rollback()


def test_onboarding_and_styling_profile_workflow(auth_user_and_headers, db_session):
    user, headers = auth_user_and_headers
    client = TestClient(app)

    # 1. Submit complete 6-step onboarding
    onboarding_payload = {
        "display_name": "Aria Stylist",
        "gender": "female",
        "avatar_style": "feminine",
        "preferred_styles": ["Minimalist", "Smart casual"],
        "disliked_styles": ["Bold"],
        "preferred_colors": ["Black", "White", "Navy"],
        "disliked_colors": ["Orange"],
        "avoided_colors": ["Orange"],
        "preferred_fits": ["Slim", "Regular"],
        "preferred_occasions": ["Office", "Casual outing", "Date"],
        "lifestyle_occupation": {
            "occupation": "working_professional",
            "details": {
                "industry": "Technology",
                "dressCode": "Smart Casual",
                "workMode": "Hybrid",
            },
        },
        "weekly_routine": [
            {"day": "Monday", "activity": "Work", "time_range": "09:00 - 18:00", "dress_code": "Smart Casual"},
            {"day": "Tuesday", "activity": "Work", "time_range": "09:00 - 18:00", "dress_code": "Business Casual"},
            {"day": "Wednesday", "activity": "Work", "time_range": "09:00 - 18:00", "dress_code": "Smart Casual"},
            {"day": "Thursday", "activity": "Work", "time_range": "09:00 - 18:00", "dress_code": "Smart Casual"},
            {"day": "Friday", "activity": "Work", "time_range": "09:00 - 17:00", "dress_code": "Casual"},
            {"day": "Saturday", "activity": "Outing", "time_range": "12:00 - 22:00", "dress_code": "Casual"},
            {"day": "Sunday", "activity": "Rest", "time_range": "All Day", "dress_code": "Casual"},
        ],
        "shopping_preferences": {
            "budget_tier": "mid_range",
            "shopping_philosophy": "essentials_first",
            "preferred_categories": ["Tops & Shirts", "Bottoms & Jeans"],
            "preferred_platforms": ["Uniqlo", "Zara"],
        },
        "recommendation_settings": {
            "comfort_priority": 0.6,
            "familiar_vs_new": "balanced",
            "repeat_frequency": "moderate",
            "variety_preference": "balanced",
        },
    }

    onboard_res = client.post("/api/v1/users/me/onboarding", json=onboarding_payload, headers=headers)
    assert onboard_res.status_code == 200, onboard_res.text
    user_data = onboard_res.json()
    assert user_data["display_name"] == "Aria Stylist"

    # 2. Verify GET /api/v1/users/me/styling-profile returns all sections accurately
    profile_res = client.get("/api/v1/users/me/styling-profile", headers=headers)
    assert profile_res.status_code == 200, profile_res.text
    prof = profile_res.json()

    assert prof["onboarding_completed"] is True
    assert prof["lifestyle_occupation"]["occupation"] == "working_professional"
    assert prof["lifestyle_occupation"]["details"]["industry"] == "Technology"
    assert len(prof["weekly_routine"]) == 7
    assert prof["weekly_routine"][0]["day"] == "Monday"
    assert prof["weekly_routine"][0]["dress_code"] == "Smart Casual"

    assert "Minimalist" in prof["fashion_preferences"]["styles"]
    assert "Orange" in prof["fashion_preferences"]["disliked_colors"]
    assert prof["shopping_preferences"]["budget_tier"] == "mid_range"
    assert prof["recommendation_settings"]["comfort_priority"] == 0.6

    # 3. Test independent PATCH update to individual sections (e.g. routine & recommendation settings)
    patch_payload = {
        "lifestyle_occupation": {
            "occupation": "freelancer",
            "details": {"field": "Design", "workMode": "Remote"},
        },
        "recommendation_settings": {
            "comfort_priority": 0.8,
            "familiar_vs_new": "novel",
            "repeat_frequency": "strict",
            "variety_preference": "high",
        },
    }
    patch_res = client.patch("/api/v1/users/me/styling-profile", json=patch_payload, headers=headers)
    assert patch_res.status_code == 200, patch_res.text
    patched = patch_res.json()

    assert patched["lifestyle_occupation"]["occupation"] == "freelancer"
    assert patched["lifestyle_occupation"]["details"]["field"] == "Design"
    assert patched["recommendation_settings"]["comfort_priority"] == 0.8
    assert patched["recommendation_settings"]["familiar_vs_new"] == "novel"
    # Previously saved weekly routine is preserved
    assert len(patched["weekly_routine"]) == 7
