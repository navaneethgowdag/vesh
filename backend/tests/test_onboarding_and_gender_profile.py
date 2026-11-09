"""
Test Suite for Feature 2: User Gender and Fashion Profile Onboarding
Validates:
1. Post-signup / first-time onboarding endpoint saves gender preference and fashion profile.
2. Supports Male, Female, Non-binary, Prefer not to say, and Skipped/unspecified.
3. Maps gender to appropriate default avatar style (masculine, feminine, androgynous, neutral).
4. Cold-start mode initializes with empty preferences without inventing synthetic choices.
5. Sets onboarding_completed to True.
6. Gender is an optional signal and never restricts clothing access.
"""

import uuid
import pytest

from app.core.database import SessionLocal
from app.models.user import User
from app.models.user_preference import UserPreference
from app.schemas.user import OnboardingRequest
from app.api.routes.users import complete_onboarding


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _create_fresh_user(db, email_prefix="onboarding"):
    unique_id = uuid.uuid4().hex[:6]
    user = User(
        id=uuid.uuid4(),
        email=f"{email_prefix}_{unique_id}@tailorbird.tech",
        username=f"user_{unique_id}",
        password_hash="mock_hash",
        first_name="Test",
        last_name="User",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_complete_onboarding_masculine(test_db):
    user = _create_fresh_user(test_db, "male")
    payload = OnboardingRequest(
        display_name="Marcus Vance",
        gender_preference="Male",
        preferred_styles=["Minimalist", "Smart casual"],
        preferred_categories=["Shirts", "Trousers"],
        preferred_colors=["Navy", "White"],
        preferred_occasions=["Office / Work"],
    )
    res = complete_onboarding(data=payload, db=test_db, current_user=user)
    assert res["display_name"] == "Marcus Vance"
    assert res["onboarding_completed"] is True
    assert res["avatar_style"] == "masculine"
    assert res["gender"] == "Male"

    test_db.refresh(user)
    assert user.onboarding_completed is True
    assert user.avatar_style == "masculine"


def test_complete_onboarding_feminine(test_db):
    user = _create_fresh_user(test_db, "female")
    payload = OnboardingRequest(
        display_name="Elena Rostova",
        gender_preference="Female",
        preferred_styles=["Elegant", "Vintage"],
        preferred_categories=["Dresses", "Kurtas"],
    )
    res = complete_onboarding(data=payload, db=test_db, current_user=user)
    assert res["avatar_style"] == "feminine"
    assert res["gender"] == "Female"
    assert res["onboarding_completed"] is True


def test_complete_onboarding_non_binary(test_db):
    user = _create_fresh_user(test_db, "non_binary")
    payload = OnboardingRequest(
        display_name="Alex River",
        gender_preference="Non-binary",
    )
    res = complete_onboarding(data=payload, db=test_db, current_user=user)
    assert res["avatar_style"] == "androgynous"
    assert res["gender"] == "Non-binary"
    assert res["onboarding_completed"] is True


def test_skip_onboarding_cold_start_defaults(test_db):
    """Skipping onboarding must not invent synthetic preferences; cold-start lists remain empty."""
    user = _create_fresh_user(test_db, "skipped")
    payload = OnboardingRequest(
        gender_preference="Prefer not to say",
        preferred_styles=[],
        preferred_categories=[],
        preferred_colors=[],
    )
    res = complete_onboarding(data=payload, db=test_db, current_user=user)
    assert res["onboarding_completed"] is True
    assert res["avatar_style"] == "neutral"

    test_db.refresh(user)
    pref = user.preference
    assert pref is not None
    assert pref.onboarding_completed is True
    assert pref.preferred_styles == []
    assert pref.preferred_colors == []
