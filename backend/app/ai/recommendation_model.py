from typing import List, Dict, Any, Optional
import numpy as np


def _safe_float(val: Any, default: float = 0.75) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


class RecommendationModel:
    """
    ML/Scoring model for ranking candidate outfits based on user preferences,
    weather, occasion, and compatibility.
    """

    def __init__(self):
        self.is_trained = False
        self.model = None

    def predict_score(
        self,
        features: Dict[str, Any],
        user_preference: Optional[Dict[str, Any]] = None,
        learned_preference: Optional[Dict[str, Any]] = None
    ) -> float:
        """
        Predict recommendation score. Uses trained ML model when available;
        falls back to deterministic compatibility and affinity scoring.
        """
        if self.is_trained and self.model is not None:
            try:
                feature_order = [
                    "style_match",
                    "color_match",
                    "category_match",
                    "weather_match",
                    "occasion_match",
                    "season_match",
                    "learned_preference_score",
                    "explicit_preference_score",
                    "compatibility_score",
                    "wear_count_ratio",
                ]
                x = np.array([[_safe_float(features.get(f), 0.75) for f in feature_order]], dtype=float)
                pred = self.model.predict(x)
                val = float(pred[0])
                return max(0.0, min(1.0, round(val, 4)))
            except Exception as e:
                # Deliberate graceful fallback with logging
                print(f"[RecommendationModel] ML inference fallback: {e}")

        # Deterministic scoring fallback
        base_compat = _safe_float(features.get("compatibility_score"), 0.75)
        color_val = features.get("color_harmony")
        if color_val is None:
            color_val = features.get("color_match")
        color_score = _safe_float(color_val, 0.75)

        style_val = features.get("style_harmony")
        if style_val is None:
            style_val = features.get("style_match")
        style_score = _safe_float(style_val, 0.75)
        
        # User affinity boost
        affinity_boost = 0.0
        if learned_preference:
            color_affinity = getattr(learned_preference, "color_scores", None) or learned_preference.get("color_affinity", {})
            style_affinity = getattr(learned_preference, "style_scores", None) or learned_preference.get("style_affinity", {})
            
            for color in features.get("colors", []):
                if isinstance(color_affinity, dict):
                    affinity_boost += color_affinity.get(color.lower(), 0.0) * 0.1
                
            for style in features.get("styles", []):
                if isinstance(style_affinity, dict):
                    affinity_boost += style_affinity.get(style.lower(), 0.0) * 0.15
        
        score = base_compat * 0.5 + color_score * 0.25 + style_score * 0.25 + affinity_boost
        # Bound score between 0.0 and 1.0
        return max(0.0, min(1.0, round(float(score), 4)))


recommendation_model = RecommendationModel()

