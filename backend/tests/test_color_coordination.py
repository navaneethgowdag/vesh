"""
Test Suite for Feature 3: Colour Coordination
Validates:
1. Neutral colour combinations (All neutral palette: 0.95 - 0.98 score).
2. Complementary combinations (Opposite hue wheel contrast).
3. Monochromatic combinations (Tonal variations of same hue family).
4. Analogous combinations (Adjacent hue wheel flow).
5. Unconventional combinations (Not rejected, receives reasonable score).
6. Missing colour attribute fallback.
7. Explicit event constraints take precedence over colour compatibility.
"""

import uuid
from datetime import date
import pytest

from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.services.color_coordination_service import ColorCoordinationService
from app.services.recommendation_service import RecommendationService


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_neutral_color_palette():
    top = Clothing(name="White Poplin Shirt", category="Tops", color="White")
    bottom = Clothing(name="Black Trousers", category="Bottoms", color="Black")

    analysis = ColorCoordinationService.analyze_palette([top, bottom])
    assert analysis["score"] >= 0.94
    assert analysis["harmony_type"] == "all_neutral"
    assert len(analysis["swatches"]) == 2
    assert "neutral" in analysis["explanation"].lower() or "monochromatic" in analysis["explanation"].lower()


def test_complementary_and_analogous_combinations():
    # Complementary: Navy and Cognac / Terracotta
    top_comp = Clothing(name="Navy Sweater", category="Tops", color="Navy")
    bot_comp = Clothing(name="Cognac Chinos", category="Bottoms", color="Cognac")
    analysis_comp = ColorCoordinationService.analyze_palette([top_comp, bot_comp])
    assert analysis_comp["score"] >= 0.92
    assert analysis_comp["harmony_type"] in ("complementary", "neutral_accent", "all_neutral")

    # Analogous: Blue and Green
    top_ana = Clothing(name="Sky Blue Shirt", category="Tops", color="Blue")
    bot_ana = Clothing(name="Forest Green Trousers", category="Bottoms", color="Green")
    analysis_ana = ColorCoordinationService.analyze_palette([top_ana, bot_ana])
    assert analysis_ana["score"] >= 0.85
    assert len(analysis_ana["swatches"]) == 2


def test_monochromatic_tonal_combination():
    top = Clothing(name="Light Blue Oxford", category="Tops", color="Light Blue")
    bottom = Clothing(name="Navy Chinos", category="Bottoms", color="Navy")

    analysis = ColorCoordinationService.analyze_palette([top, bottom])
    assert analysis["score"] >= 0.90
    assert len(analysis["swatches"]) == 2
    assert all(s["hex"].startswith("#") for s in analysis["swatches"])


def test_unconventional_color_combination_not_rejected():
    # Vibrant Orange + Vibrant Purple
    top = Clothing(name="Orange Top", category="Tops", color="Orange")
    bottom = Clothing(name="Purple Skirt", category="Bottoms", color="Purple")

    analysis = ColorCoordinationService.analyze_palette([top, bottom])
    # Unconventional combination should still produce a valid score and explanation without crashing
    assert 0.60 <= analysis["score"] <= 0.90
    assert len(analysis["swatches"]) == 2


def test_missing_color_attribute_graceful_fallback():
    top = Clothing(name="Plain Tee", category="Tops", color=None)
    bottom = Clothing(name="Pants", category="Bottoms", color=None)

    analysis = ColorCoordinationService.analyze_palette([top, bottom])
    assert analysis["score"] >= 0.85
    assert analysis["harmony_type"] == "all_neutral"


@pytest.mark.asyncio
async def test_explicit_event_constraint_takes_priority(test_db):
    user = User(
        id=uuid.uuid4(),
        email=f"color_event_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"color_user_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add(user)

    # Wardrobe items:
    # 1. Formal White Shirt + Formal Black Trousers (Neutral)
    formal_top = Clothing(user_id=user.id, name="Formal White Shirt", category="Tops", color="White", occasion="Work & Office")
    formal_bot = Clothing(user_id=user.id, name="Formal Black Trousers", category="Bottoms", color="Black", occasion="Work & Office")

    # 2. Casual Orange Tee + Casual Red Shorts (Vibrant)
    casual_top = Clothing(user_id=user.id, name="Casual Orange Tee", category="Tops", color="Orange", occasion="Casual Daily")
    casual_bot = Clothing(user_id=user.id, name="Casual Red Shorts", category="Bottoms", color="Red", occasion="Casual Daily")

    test_db.add_all([formal_top, formal_bot, casual_top, casual_bot])
    test_db.commit()

    service = RecommendationService(test_db)
    # Event is Black Tie / Formal
    event = service.calendar_repo.create(
        user_id=user.id,
        title="Annual Executive Gala",
        event_date=date.today(),
        event_type="business_meeting",
        notes="Black tie gala event",
    )

    recs = await service.generate_recommendations(
        user_id=user.id,
        calendar_event_id=event.id,
        limit=1,
    )

    assert len(recs) == 1
    selected_names = [i.name for i in recs[0].outfit.clothing_items]
    assert "Formal White Shirt" in selected_names
    assert "Formal Black Trousers" in selected_names
