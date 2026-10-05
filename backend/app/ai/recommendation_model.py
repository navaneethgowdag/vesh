from typing import List, Dict, Any, Optional
import numpy as np


class RecommendationModel:
    """
    ML/Scoring model for ranking candidate outfits based on user preferences,
    weather, occasion, and compatibility.
    """

    def __init__(self):
        self.is_trained = False

    def predict_score(
        self,
        features: Dict[str, Any],
        user_preference: Optional[Dict[str, Any]] = None,
        learned_preference: Optional[Dict[str, Any]] = None
    ) -> float:
        """
        Combine compatibility breakdown with user affinity scores.
        """
        base_compat = features.get("compatibility_score", 0.75)
        color_score = features.get("color_harmony", 0.75)
        style_score = features.get("style_harmony", 0.75)
        
        # User affinity boost
        affinity_boost = 0.0
        if learned_preference:
            color_affinity = learned_preference.get("color_affinity", {})
            style_affinity = learned_preference.get("style_affinity", {})
            
            for color in features.get("colors", []):
                affinity_boost += color_affinity.get(color.lower(), 0.0) * 0.1
                
            for style in features.get("styles", []):
                affinity_boost += style_affinity.get(style.lower(), 0.0) * 0.15
        
        score = base_compat * 0.5 + color_score * 0.25 + style_score * 0.25 + affinity_boost
        # Bound score between 0.0 and 1.0
        return max(0.0, min(1.0, round(float(score), 4)))


recommendation_model = RecommendationModel()

