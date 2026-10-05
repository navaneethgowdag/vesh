import uuid
import pytest
from unittest.mock import MagicMock
from app.services.personalization_service import PersonalizationService
from app.utils.enums import FEEDBACK_WEIGHTS


class DummyItem:
    def __init__(self, id, name, category, color, fit="Relaxed", style_tags=None):
        self.id = id
        self.name = name
        self.category = category
        self.color = color
        self.fit = fit
        self.pattern = "Solid"
        self.material = "Cotton"
        self.style_tags = style_tags or ["Minimal"]
        self.wear_count = 0


class DummyOutfit:
    def __init__(self, items, style="Minimal", occasion="Casual Daily", season="All-Season", tags=None):
        self.id = uuid.uuid4()
        self.clothing_items = items
        self.style = style
        self.occasion = occasion
        self.season = season
        self.tags = tags or ["Minimal"]


class DummyLearned:
    def __init__(self):
        self.id = uuid.uuid4()
        self.style_scores = {"Minimal": 0.40, "Casual": 0.50}
        self.color_scores = {"Black": 0.40, "Red": 0.50}
        self.category_scores = {"Tops": 0.50}
        self.fit_scores = {"Relaxed": 0.50}
        self.pattern_scores = {"Solid": 0.50}
        self.material_scores = {"Cotton": 0.50}
        self.occasion_scores = {"Casual Daily": 0.50}
        self.season_scores = {"All-Season": 0.50}
        self.weather_scores = {}
        self.confidence_score = 0.20
        self.interaction_count = 1


def test_feedback_weights_configuration():
    """Verify Section 12 feedback weights are correctly configured."""
    assert FEEDBACK_WEIGHTS["wear"] > FEEDBACK_WEIGHTS["save"]
    assert FEEDBACK_WEIGHTS["save"] > FEEDBACK_WEIGHTS["like"]
    assert FEEDBACK_WEIGHTS["like"] > FEEDBACK_WEIGHTS["view"]
    assert FEEDBACK_WEIGHTS["reject"] < 0
    assert FEEDBACK_WEIGHTS["skip"] < 0


def test_personalization_like_increases_score():
    """Verify liking an outfit increases preference for its colors and styles."""
    db = MagicMock()
    service = PersonalizationService(db)

    learned = DummyLearned()
    service.get_learned_preferences = MagicMock(return_value=learned)
    service.user_repo.update_learned_preferences = MagicMock(return_value=learned)

    initial_black = learned.color_scores["Black"]
    initial_minimal = learned.style_scores["Minimal"]

    item = DummyItem(uuid.uuid4(), "Black Tee", "Tops", "Black")
    outfit = DummyOutfit([item], style="Minimal")

    service.record_feedback(uuid.uuid4(), outfit, "like")

    # Assert scores increased
    assert learned.color_scores["Black"] > initial_black
    assert learned.style_scores["Minimal"] > initial_minimal
    assert learned.interaction_count == 2
    assert learned.confidence_score >= 0.20


def test_personalization_reject_decreases_score():
    """Verify rejecting an outfit decreases preference."""
    db = MagicMock()
    service = PersonalizationService(db)

    learned = DummyLearned()
    service.get_learned_preferences = MagicMock(return_value=learned)
    service.user_repo.update_learned_preferences = MagicMock(return_value=learned)

    initial_red = learned.color_scores["Red"]

    item = DummyItem(uuid.uuid4(), "Red Dress", "Dresses", "Red")
    outfit = DummyOutfit([item], style="Formal")

    service.record_feedback(uuid.uuid4(), outfit, "reject")

    # Assert score decreased
    assert learned.color_scores["Red"] < initial_red


def test_personalization_wear_is_strongest_signal():
    """Verify wear feedback produces a stronger delta than like feedback."""
    db = MagicMock()
    service = PersonalizationService(db)

    # 1. Like
    learned_like = DummyLearned()
    service.get_learned_preferences = MagicMock(return_value=learned_like)
    service.user_repo.update_learned_preferences = MagicMock(return_value=learned_like)

    item1 = DummyItem(uuid.uuid4(), "Black Tee", "Tops", "Black")
    outfit1 = DummyOutfit([item1], style="Minimal")
    service.record_feedback(uuid.uuid4(), outfit1, "like")
    like_delta = learned_like.color_scores["Black"] - 0.40

    # 2. Wear
    learned_wear = DummyLearned()
    service.get_learned_preferences = MagicMock(return_value=learned_wear)
    service.user_repo.update_learned_preferences = MagicMock(return_value=learned_wear)
    service.wardrobe_repo.increment_wear_count = MagicMock()

    item2 = DummyItem(uuid.uuid4(), "Black Tee", "Tops", "Black")
    outfit2 = DummyOutfit([item2], style="Minimal")
    service.record_feedback(uuid.uuid4(), outfit2, "wear")
    wear_delta = learned_wear.color_scores["Black"] - 0.40

    assert wear_delta > like_delta
    # Verify wear count increment was called on repository
    service.wardrobe_repo.increment_wear_count.assert_called_once()


def test_scores_are_strictly_bounded():
    """Verify learned preference scores are strictly bounded between -1.0 and 1.0."""
    db = MagicMock()
    service = PersonalizationService(db)

    learned = DummyLearned()
    service.get_learned_preferences = MagicMock(return_value=learned)
    service.user_repo.update_learned_preferences = MagicMock(return_value=learned)

    item = DummyItem(uuid.uuid4(), "Black Tee", "Tops", "Black")
    outfit = DummyOutfit([item], style="Minimal")

    # Simulate 50 consecutive wear events
    for _ in range(50):
        service.record_feedback(uuid.uuid4(), outfit, "wear")

    assert learned.color_scores["Black"] <= 1.0
    assert learned.color_scores["Black"] >= -1.0
