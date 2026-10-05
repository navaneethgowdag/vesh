import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.learned_preference import LearnedPreference
from app.models.outfit import Outfit
from app.models.clothing import Clothing
from app.repositories.user_repository import UserRepository
from app.repositories.wardrobe_repository import WardrobeRepository
from app.utils.enums import FEEDBACK_WEIGHTS

logger = logging.getLogger(__name__)


class PersonalizationService:
    """
    Adaptive user personalization service.
    Implements continuous learning from behavioral feedback (view, like, save, wear, reject, skip)
    without overwriting explicit user preferences.
    """

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.wardrobe_repo = WardrobeRepository(db)
        self.learning_rate = 0.20

    def get_learned_preferences(self, user_id: UUID) -> LearnedPreference:
        return self.user_repo.get_or_create_learned_preferences(user_id)

    def record_feedback(
        self,
        user_id: UUID,
        outfit: Outfit,
        action: str,
        recency_factor: float = 1.0,
    ) -> LearnedPreference:
        """
        Record interaction feedback and update learned preferences across all supported outfit attributes.
        """
        action_lower = action.lower()
        weight = FEEDBACK_WEIGHTS.get(action_lower, 0.0)

        learned = self.get_learned_preferences(user_id)

        # Increment interaction count and adjust confidence
        learned.interaction_count = (learned.interaction_count or 0) + 1
        learned.confidence_score = round(min(0.95, 0.15 + 0.03 * learned.interaction_count), 3)

        confidence_factor = learned.confidence_score
        effective_delta = self.learning_rate * weight * recency_factor * confidence_factor

        # 1. Update style preferences
        style_scores = dict(getattr(learned, "style_scores", {}) or {})
        styles = getattr(outfit, "tags", []) or []
        for s in styles:
            s_name = str(s).strip()
            if s_name:
                current = style_scores.get(s_name, 0.5)
                style_scores[s_name] = round(max(-1.0, min(1.0, current + effective_delta)), 3)
        learned.style_scores = style_scores

        # 2. Update occasion preferences
        if outfit.occasion:
            occasion_scores = dict(getattr(learned, "occasion_scores", {}) or {})
            curr_occ = occasion_scores.get(outfit.occasion, 0.5)
            occasion_scores[outfit.occasion] = round(max(-1.0, min(1.0, curr_occ + effective_delta)), 3)
            learned.occasion_scores = occasion_scores

        # 3. Update season preferences
        if outfit.season:
            season_scores = dict(getattr(learned, "season_scores", {}) or {})
            curr_season = season_scores.get(outfit.season, 0.5)
            season_scores[outfit.season] = round(max(-1.0, min(1.0, curr_season + effective_delta)), 3)
            learned.season_scores = season_scores

        # 4. Update clothing attributes (colors, categories, fits, patterns, materials)
        items = outfit.clothing_items or []
        color_scores = dict(getattr(learned, "color_scores", {}) or {})
        category_scores = dict(getattr(learned, "category_scores", {}) or {})
        fit_scores = dict(getattr(learned, "fit_scores", {}) or {})
        pattern_scores = dict(getattr(learned, "pattern_scores", {}) or {})
        material_scores = dict(getattr(learned, "material_scores", {}) or {})

        for item in items:
            # Color
            if item.color:
                curr_c = color_scores.get(item.color, 0.5)
                color_scores[item.color] = round(max(-1.0, min(1.0, curr_c + effective_delta)), 3)

            # Category
            if item.category:
                curr_cat = category_scores.get(item.category, 0.5)
                category_scores[item.category] = round(max(-1.0, min(1.0, curr_cat + effective_delta)), 3)

            # Fit
            if item.fit:
                curr_fit = fit_scores.get(item.fit, 0.5)
                fit_scores[item.fit] = round(max(-1.0, min(1.0, curr_fit + effective_delta)), 3)

            # Pattern
            if item.pattern:
                curr_pat = pattern_scores.get(item.pattern, 0.5)
                pattern_scores[item.pattern] = round(max(-1.0, min(1.0, curr_pat + effective_delta)), 3)

            # Material
            if item.material:
                curr_mat = material_scores.get(item.material, 0.5)
                material_scores[item.material] = round(max(-1.0, min(1.0, curr_mat + effective_delta)), 3)

        learned.color_scores = color_scores
        learned.category_scores = category_scores
        learned.fit_scores = fit_scores
        learned.pattern_scores = pattern_scores
        learned.material_scores = material_scores

        # Commit learned preferences to Neon PostgreSQL
        self.user_repo.update_learned_preferences(learned)

        # If action is WEAR, increment wear count on all outfit items
        if action_lower == "wear" and items:
            item_ids = [item.id for item in items]
            self.wardrobe_repo.increment_wear_count(item_ids)

        logger.info(
            f"Updated learned preferences for user {user_id} on action={action_lower}: "
            f"new confidence={learned.confidence_score}, total interactions={learned.interaction_count}"
        )

        return learned

    def get_preference_score(self, user_id: UUID, attribute_type: str, attribute_value: str) -> float:
        """Retrieve the learned affinity score for a given attribute (returns value in range -1.0 to 1.0, default 0.5)."""
        learned = self.get_learned_preferences(user_id)
        table_map = {
            "style": getattr(learned, "style_scores", {}) or {},
            "color": getattr(learned, "color_scores", {}) or {},
            "category": getattr(learned, "category_scores", {}) or {},
            "fit": getattr(learned, "fit_scores", {}) or {},
            "pattern": getattr(learned, "pattern_scores", {}) or {},
            "material": getattr(learned, "material_scores", {}) or {},
            "occasion": getattr(learned, "occasion_scores", {}) or {},
            "season": getattr(learned, "season_scores", {}) or {},
            "weather": getattr(learned, "weather_scores", {}) or {},
        }
        scores = table_map.get(attribute_type.lower(), {})
        return scores.get(attribute_value, 0.5)
