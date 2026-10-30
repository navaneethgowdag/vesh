import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.learned_preference import LearnedPreference
from app.models.user_preference import UserPreference
from app.models.outfit import Outfit
from app.models.clothing import Clothing
from app.repositories.user_repository import UserRepository
from app.repositories.wardrobe_repository import WardrobeRepository
from app.utils.enums import FEEDBACK_WEIGHTS

logger = logging.getLogger(__name__)


def calculate_time_decay(days_elapsed: float, half_life_days: float = 30.0) -> float:
    """Calculates exponential time decay factor e^(-lambda * delta_t)."""
    if days_elapsed <= 0.0:
        return 1.0
    decay_lambda = math.log(2) / max(1.0, half_life_days)
    return round(math.exp(-decay_lambda * days_elapsed), 4)


class PersonalizationService:
    """
    Phase 4 Adaptive Personalization & Continuous Learning Engine.
    Implements:
    - Weighted feedback aggregation with Bayesian smoothing.
    - Reason-specific negative feedback targeting (style, color, occasion, formality).
    - Exponential time decay so past behavior does not indefinitely dominate.
    - Transparent, evidence-backed outfit scoring and explainability.
    - User controls (enable/disable, reset, explicit overrides).
    """

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.wardrobe_repo = WardrobeRepository(db)
        self.learning_rate = 0.20

    def calculate_time_decay(self, past_or_days: Any, now_dt: Optional[datetime] = None, half_life_days: float = 30.0) -> float:
        """Calculates exponential time decay factor given either days elapsed or datetime objects."""
        if isinstance(past_or_days, (int, float)):
            return calculate_time_decay(float(past_or_days), half_life_days)
        if now_dt is None:
            now_dt = datetime.now(timezone.utc)
        delta_days = max(0.0, (now_dt - past_or_days).total_seconds() / 86400.0)
        return calculate_time_decay(delta_days, half_life_days)

    def get_learned_preferences(self, user_id: UUID) -> LearnedPreference:
        return self.user_repo.get_or_create_learned_preferences(user_id)

    def record_feedback(
        self,
        user_id: UUID,
        outfit: Outfit,
        action: str,
        reason: Optional[str] = None,
        recency_factor: float = 1.0,
    ) -> LearnedPreference:
        """
        Record interaction feedback and update learned preferences across all supported outfit attributes.
        Supports targeted reason adjustments for explicit negative or constructive feedback.
        """
        action_lower = action.lower()
        base_weight = FEEDBACK_WEIGHTS.get(action_lower, 0.0)

        learned = self.get_learned_preferences(user_id)

        # 1. Update interaction count and Bayesian confidence score
        current_interactions = (learned.interaction_count or 0) + 1
        learned.interaction_count = current_interactions
        # Bayesian smoothing: confidence = interactions / (interactions + 5)
        learned.confidence_score = round(min(0.95, current_interactions / (current_interactions + 5.0)), 3)

        confidence_factor = learned.confidence_score
        effective_delta = self.learning_rate * base_weight * recency_factor * confidence_factor

        # Reason-specific adjustment factors
        clean_reason = (reason or "").lower().strip()
        style_delta = effective_delta
        color_delta = effective_delta
        occasion_delta = effective_delta
        cat_delta = effective_delta

        if action_lower == "reject" or action_lower == "skip":
            if "style" in clean_reason:
                # Targeted style rejection: heavier penalty on style, neutral on color
                style_delta = -0.30 * confidence_factor
                color_delta = 0.0
                cat_delta = -0.05 * confidence_factor
            elif "color" in clean_reason:
                # Targeted color rejection: heavier penalty on color, neutral on style
                color_delta = -0.30 * confidence_factor
                style_delta = 0.0
            elif "occasion" in clean_reason:
                # Targeted occasion clash
                occasion_delta = -0.30 * confidence_factor
                style_delta = 0.0
                color_delta = 0.0
            elif "formal" in clean_reason:
                # Too formal: reduce formal styles
                style_delta = -0.25 * confidence_factor
            elif "casual" in clean_reason:
                # Too casual: reduce casual styles
                style_delta = -0.25 * confidence_factor

        # 2. Update style scores
        style_scores = dict(getattr(learned, "style_scores", {}) or {})
        outfit_styles = []
        if hasattr(outfit, "style") and outfit.style:
            outfit_styles.append(outfit.style)
        if hasattr(outfit, "tags") and outfit.tags:
            outfit_styles.extend(outfit.tags)

        # Also pull styles from clothing items
        items = outfit.clothing_items or []
        for it in items:
            it_style = getattr(it, "style", None)
            if it_style and it_style not in outfit_styles:
                outfit_styles.append(it_style)

        for s in outfit_styles:
            s_name = str(s).strip()
            if s_name:
                current = style_scores.get(s_name, 0.0)
                style_scores[s_name] = round(max(-1.0, min(1.0, current + style_delta)), 3)
        learned.style_scores = style_scores

        # 3. Update occasion scores
        if outfit.occasion:
            occasion_scores = dict(getattr(learned, "occasion_scores", {}) or {})
            curr_occ = occasion_scores.get(outfit.occasion, 0.0)
            occasion_scores[outfit.occasion] = round(max(-1.0, min(1.0, curr_occ + occasion_delta)), 3)
            learned.occasion_scores = occasion_scores

        # 4. Update season scores
        if outfit.season:
            season_scores = dict(getattr(learned, "season_scores", {}) or {})
            curr_season = season_scores.get(outfit.season, 0.0)
            season_scores[outfit.season] = round(max(-1.0, min(1.0, curr_season + effective_delta)), 3)
            learned.season_scores = season_scores

        # 5. Update clothing attributes (colors, categories, fits, patterns, materials)
        color_scores = dict(getattr(learned, "color_scores", {}) or {})
        category_scores = dict(getattr(learned, "category_scores", {}) or {})
        fit_scores = dict(getattr(learned, "fit_scores", {}) or {})
        pattern_scores = dict(getattr(learned, "pattern_scores", {}) or {})
        material_scores = dict(getattr(learned, "material_scores", {}) or {})

        for item in items:
            # Color
            if item.color:
                curr_c = color_scores.get(item.color, 0.0)
                color_scores[item.color] = round(max(-1.0, min(1.0, curr_c + color_delta)), 3)
            if getattr(item, "secondary_color", None):
                curr_sc = color_scores.get(item.secondary_color, 0.0)
                color_scores[item.secondary_color] = round(max(-1.0, min(1.0, curr_sc + (color_delta * 0.5))), 3)

            # Category
            if item.category:
                curr_cat = category_scores.get(item.category, 0.0)
                category_scores[item.category] = round(max(-1.0, min(1.0, curr_cat + cat_delta)), 3)

            # Fit
            if item.fit:
                curr_fit = fit_scores.get(item.fit, 0.0)
                fit_scores[item.fit] = round(max(-1.0, min(1.0, curr_fit + effective_delta)), 3)

            # Pattern
            if item.pattern:
                curr_pat = pattern_scores.get(item.pattern, 0.0)
                pattern_scores[item.pattern] = round(max(-1.0, min(1.0, curr_pat + effective_delta)), 3)

            # Material
            if item.material:
                curr_mat = material_scores.get(item.material, 0.0)
                material_scores[item.material] = round(max(-1.0, min(1.0, curr_mat + effective_delta)), 3)

        learned.color_scores = color_scores
        learned.category_scores = category_scores
        learned.fit_scores = fit_scores
        learned.pattern_scores = pattern_scores
        learned.material_scores = material_scores

        # 6. Commit to Neon PostgreSQL
        self.user_repo.update_learned_preferences(learned)

        logger.info(
            f"Updated learned preferences for user {user_id} on action={action_lower} reason={reason}: "
            f"new confidence={learned.confidence_score}, total interactions={learned.interaction_count}"
        )

        return learned

    def score_candidate_personalization(
        self,
        items: Optional[List[Clothing]] = None,
        target_occasion: str = "Casual Daily",
        user_id: Optional[UUID] = None,
        user_pref: Optional[UserPreference] = None,
        recent_outfit_ids: Optional[set] = None,
        clothing_items: Optional[List[Clothing]] = None,
        occasion: Optional[str] = None,
        **kwargs,
    ) -> Tuple[float, float, Dict[str, Any], List[str]]:
        """
        Phase 4: Computes personalization score (S_pref) and diversity score (S_div)
        for a candidate outfit combination.
        Returns:
        (s_pref, s_div, score_breakdown, personalized_rationales)
        """
        items = items or clothing_items or []
        target_occasion = occasion or target_occasion

        if user_pref is None and user_id:
            user_pref = self.user_repo.get_preferences(user_id)

        # Check if personalization is disabled by user
        pref_enabled = True
        if user_pref is not None:
            if hasattr(user_pref, "personalization_enabled"):
                pref_enabled = bool(user_pref.personalization_enabled)
            elif isinstance(getattr(user_pref, "preferred_fits", None), dict):
                val = user_pref.preferred_fits.get("personalization_enabled")
                if val is not None:
                    pref_enabled = bool(val)
        if not pref_enabled:
            return 0.5, 0.5, {
                "style_affinity": 0.5,
                "color_affinity": 0.5,
                "occasion_affinity": 0.5,
                "category_affinity": 0.5,
                "personalization_score": 0.5,
                "diversity_score": 0.5,
                "pref_weight": 0.0,
                "div_weight": 0.0,
                "disabled": True,
            }, []
        learned = self.get_learned_preferences(user_id)
        confidence = float(learned.confidence_score or 0.1)

        # A. Explicit Preferences Extraction
        explicit_styles = set(s.lower().strip() for s in (user_pref.styles if user_pref else []))
        disliked_styles = set(s.lower().strip() for s in (getattr(user_pref, "disliked_styles", []) or []))
        fav_colors = set(c.lower().strip() for c in (user_pref.favorite_colors if user_pref else []))
        avoided_colors = set(c.lower().strip() for c in (getattr(user_pref, "avoided_colors", []) or []))
        fav_occasions = set(o.lower().strip() for o in (getattr(user_pref, "favorite_occasions", []) or []))

        learned_styles = {k.lower().strip(): v for k, v in (learned.style_scores or {}).items()}
        learned_colors = {k.lower().strip(): v for k, v in (learned.color_scores or {}).items()}
        learned_occasions = {k.lower().strip(): v for k, v in (learned.occasion_scores or {}).items()}
        learned_cats = {k.lower().strip(): v for k, v in (learned.category_scores or {}).items()}

        rationales: List[str] = []

        # 1. Style Affinity Score (Weight 0.35)
        style_scores_list = []
        outfit_style_names = []
        for it in items:
            s = (getattr(it, "style", None) or "").lower().strip()
            if s:
                outfit_style_names.append(s)
                # Check disliked styles
                if s in disliked_styles:
                    style_scores_list.append(-0.5)
                elif s in explicit_styles:
                    style_scores_list.append(1.0)
                elif s in learned_styles:
                    # Map [-1.0, 1.0] to [0.0, 1.0]
                    style_scores_list.append(max(0.0, min(1.0, (learned_styles[s] + 1.0) / 2.0)))
                else:
                    style_scores_list.append(0.5)

        avg_style_score = sum(style_scores_list) / len(style_scores_list) if style_scores_list else 0.5
        avg_style_score = max(0.0, min(1.0, avg_style_score))

        # Explanation generation for style
        matching_top_styles = [s for s in outfit_style_names if s in explicit_styles or (s in learned_styles and learned_styles[s] > 0.65)]
        if matching_top_styles:
            style_name = matching_top_styles[0].title()
            if matching_top_styles[0] in explicit_styles:
                rationales.append(f"Matches your signature {style_name} aesthetic")
            elif confidence >= 0.2:
                rationales.append(f"Aligns with your preferred {style_name} style (learned from your saved looks)")

        # 2. Color Affinity Score (Weight 0.35)
        color_scores_list = []
        matched_fav_colors = []
        for it in items:
            c = (it.color or "").lower().strip()
            if c:
                if c in avoided_colors:
                    color_scores_list.append(0.0)
                elif c in fav_colors:
                    color_scores_list.append(1.0)
                    matched_fav_colors.append(it.color)
                elif c in learned_colors:
                    color_scores_list.append(max(0.0, min(1.0, (learned_colors[c] + 1.0) / 2.0)))
                    if learned_colors[c] > 0.65:
                        matched_fav_colors.append(it.color)
                else:
                    color_scores_list.append(0.5)

        avg_color_score = sum(color_scores_list) / len(color_scores_list) if color_scores_list else 0.5
        avg_color_score = max(0.0, min(1.0, avg_color_score))

        if matched_fav_colors:
            unique_matched = list(dict.fromkeys(matched_fav_colors))[:2]
            rationales.append(f"Features your favored {' & '.join(unique_matched)} color palette")

        # 3. Occasion Affinity Score (Weight 0.15)
        occ_key = target_occasion.lower().strip()
        if occ_key in fav_occasions:
            occ_score = 1.0
        elif occ_key in learned_occasions:
            occ_score = max(0.0, min(1.0, (learned_occasions[occ_key] + 1.0) / 2.0))
        else:
            occ_score = 0.5

        if occ_score >= 0.75:
            rationales.append(f"Tailored specifically for your {target_occasion} calendar context")

        # 4. Category Affinity Score (Weight 0.15)
        cat_scores_list = []
        for it in items:
            cat = (it.category or "").lower().strip()
            if cat in learned_cats:
                cat_scores_list.append(max(0.0, min(1.0, (learned_cats[cat] + 1.0) / 2.0)))
            else:
                cat_scores_list.append(0.5)
        avg_cat_score = sum(cat_scores_list) / len(cat_scores_list) if cat_scores_list else 0.5

        # Combined S_pref
        s_pref = (
            0.35 * avg_style_score +
            0.35 * avg_color_score +
            0.15 * occ_score +
            0.15 * avg_cat_score
        )
        s_pref = round(max(0.0, min(1.0, s_pref)), 3)

        # 5. Diversity & Usage Score (S_div)
        # Check wear counts and recent wear dates
        wear_counts = [getattr(it, "wear_count", 0) or 0 for it in items]
        avg_wear_count = sum(wear_counts) / len(wear_counts) if wear_counts else 0

        # Underused wardrobe revival bonus
        underused_bonus = 0.0
        underused_item = None
        for it in items:
            if (getattr(it, "wear_count", 0) or 0) <= 1:
                underused_bonus = 0.20
                underused_item = it.name
                break

        # Recently worn avoidance penalty
        recently_worn_penalty = 0.0
        avoid_days = getattr(user_pref, "avoid_recently_worn_days", 7)
        threshold_dt = datetime.now(timezone.utc) - timedelta(days=avoid_days)

        for it in items:
            last_worn = getattr(it, "last_worn_at", None)
            if last_worn and last_worn >= threshold_dt:
                recently_worn_penalty += 0.25

        base_div = 0.70 + underused_bonus - recently_worn_penalty
        s_div = round(max(0.0, min(1.0, base_div)), 3)

        if underused_item and underused_bonus > 0:
            rationales.append(f"Revives your {underused_item}, currently underused in your rotation")

        breakdown = {
            "style_affinity": round(avg_style_score, 3),
            "color_affinity": round(avg_color_score, 3),
            "occasion_affinity": round(occ_score, 3),
            "category_affinity": round(avg_cat_score, 3),
            "personalization_score": s_pref,
            "diversity_score": s_div,
            "confidence": confidence,
            "underused_bonus": round(underused_bonus, 2),
            "recently_worn_penalty": round(recently_worn_penalty, 2),
            "pref_weight": round(0.25 * confidence, 4),
            "div_weight": 0.10,
        }

        return s_pref, s_div, breakdown, rationales

    def reset_learned_preferences(self, user_id: UUID) -> LearnedPreference:
        """Resets all inferred scores and behavioral counters back to initial cold-start baseline."""
        return self.user_repo.reset_learned_preferences(user_id)

    def get_inferred_profile(self, user_id: UUID) -> Dict[str, Any]:
        """Provides structured summary of inferred preferences and evidence for Settings UI."""
        learned = self.get_learned_preferences(user_id)
        confidence = float(learned.confidence_score or 0.1)

        # Extract top positive styles
        styles = sorted(
            [(k, v) for k, v in (learned.style_scores or {}).items() if v > 0.2],
            key=lambda x: x[1],
            reverse=True,
        )

        # Extract top positive colors
        colors = sorted(
            [(k, v) for k, v in (learned.color_scores or {}).items() if v > 0.2],
            key=lambda x: x[1],
            reverse=True,
        )

        tier = "Cold Start" if confidence < 0.25 else ("Emerging Profile" if confidence < 0.65 else "Established Signature")

        return {
            "confidence": confidence,
            "confidence_score": confidence,
            "confidence_tier": tier,
            "interaction_count": learned.interaction_count or 0,
            "total_interactions": learned.interaction_count or 0,
            "style_scores": learned.style_scores or {},
            "color_scores": learned.color_scores or {},
            "top_styles": [{"style": k, "name": k, "score": round(v, 2)} for k, v in styles[:5]],
            "top_colors": [{"color": k, "name": k, "score": round(v, 2)} for k, v in colors[:6]],
            "updated_at": learned.updated_at,
        }
