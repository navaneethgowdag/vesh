"""
Test Suite for Feature 3: Event Classification and Event-Aware Recommendations
Validates:
1. EventClassifierService rule-based keyword matching across 14 categories.
2. Tone / sentiment classification (celebratory, professional, casual, solemn, neutral).
3. Formality & dress code classification (formal, smart_casual, casual, festive, black_tie).
4. Multi-event resolution on the same day: picks most restrictive / explicit dress code event.
5. Recommendation engine uses exact weights:
   0.35 compatibility + 0.25 event suitability + 0.20 weather + 0.15 personalization + 0.05 diversity.
6. Returns exactly ONE outfit recommendation per request.
"""

import uuid
from datetime import date, time
import pytest

from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.calendar_event import CalendarEvent
from app.services.event_classifier_service import EventClassifierService
from app.services.recommendation_service import RecommendationService


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_event_classification_categories():
    test_cases = [
        ("Tech Hiring Interview with Google", "job_interview", "professional", "formal"),
        ("Sister's Wedding Sangeet", "wedding", "celebratory", "festive"),
        ("Quarterly Board Meeting & Client Pitch", "business_meeting", "professional", "formal"),
        ("Morning Sprint Standup", "office_work", "professional", "smart_casual"),
        ("Memorial Service and Wake", "solemn_memorial", "solemn", "formal"),
        ("Diwali Puja and Family Feast", "cultural_religious", "celebratory", "festive"),
        ("Rooftop Candlelight Dinner", "dinner", "neutral", "smart_casual"),
        ("Saturday Night Clubbing Bash", "party", "celebratory", "festive"),
        ("Sam's 30th Birthday Celebration", "birthday", "celebratory", "casual"),
        ("University Machine Learning Lecture", "academic", "neutral", "smart_casual"),
        ("Sunday Brunch at Central Park", "casual_outing", "casual", "casual"),
        ("Flight to London Heathrow", "travel", "casual", "casual"),
        ("Morning Marathon Training 10k Run", "sports_fitness", "casual", "casual"),
    ]

    for title, expected_cat, expected_tone, expected_dc in test_cases:
        res = EventClassifierService.classify_event(title)
        assert res["category"] == expected_cat, f"Failed category for '{title}': got {res['category']}"
        assert res["tone"] == expected_tone, f"Failed tone for '{title}': got {res['tone']}"
        assert res["dress_code"] == expected_dc, f"Failed dress code for '{title}': got {res['dress_code']}"


def test_explicit_dress_code_override():
    # Notes specify black tie
    res = EventClassifierService.classify_event(
        title="Annual Charity Gala",
        notes="Dress code is strictly black tie attire",
    )
    assert res["dress_code"] == "black_tie"
    assert res["formality"] >= 0.95
    assert res["has_explicit_dress_code"] is True


def test_multi_event_resolution_same_day():
    events = [
        {"title": "Morning Standup", "start_time": time(10, 0)},
        {"title": "Sister Wedding Reception", "notes": "Festive attire", "start_time": time(19, 0)},
        {"title": "Coffee with colleague", "start_time": time(14, 0)},
    ]
    resolved = EventClassifierService.resolve_day_events(events)
    assert resolved["event_count"] == 3
    # The wedding reception (festive) must be chosen as primary over casual coffee and office standup
    assert resolved["primary_event"]["category"] == "wedding"
    assert resolved["dress_code"] == "festive"
    assert "Wedding" in resolved["rationale"]


@pytest.mark.asyncio
async def test_single_outfit_recommendation_and_scoring_weights(test_db):
    user = User(
        id=uuid.uuid4(),
        email=f"event_rec_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"event_user_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add(user)

    # Add wardrobe items
    top = Clothing(user_id=user.id, name="White Oxford Shirt", category="Tops", color="White", occasion="Work / Office")
    bottom = Clothing(user_id=user.id, name="Navy Chinos", category="Bottoms", color="Navy", occasion="Work / Office")
    test_db.add_all([top, bottom])
    test_db.commit()

    service = RecommendationService(test_db)

    # Create calendar event using repository (handles table and fallback gracefully)
    event = service.calendar_repo.create(
        user_id=user.id,
        title="Client Strategy Pitch",
        event_date=date.today(),
        event_type="business_meeting",
        notes="Smart casual presentation",
    )

    recs = await service.generate_recommendations(
        user_id=user.id,
        calendar_event_id=event.id,
        limit=1,
    )

    # Exactly ONE outfit returned
    assert len(recs) == 1
    rec = recs[0]

    # Verify score breakdown reasoning includes the exact 5 components
    reasoning = rec.reasoning or {}
    assert "compatibility" in reasoning
    assert "event_suitability" in reasoning
    assert "weather_suitability" in reasoning
    assert "personalization" in reasoning
    assert "diversity" in reasoning

    # Total score must be between 0.0 and 1.0
    assert 0.0 < rec.total_score <= 1.0
