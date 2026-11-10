"""
Recommendation Machine Learning Service.
Integrates the trained Random Forest Regressor preference model (42-feature schema)
into TailorBird's production recommendation pipeline.

Responsibilities:
1. Loads active recommendation model bundle from persistent disk.
2. Extracts exact 42 features across categorical and numerical heads from candidate outfits.
3. Performs low-latency in-memory preference inference.
4. Provides deterministic fallback when ML is unavailable or disabled.
5. Supports atomic hot-reload upon model promotion.
"""

import os
import json
import time
import logging
from typing import Dict, Any, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd
from app.core.config import settings
from app.models.clothing import Clothing
from app.services.color_coordination_service import ColorCoordinationService

logger = logging.getLogger("tailorbird.ml.recommendation")

# Production 42-feature specification from tailorbird_preference_model.json
CATEGORICAL_FEATURES = [
    "occupation",
    "general_routine_style",
    "selected_styles",
    "preferred_colors",
    "disliked_colors",
    "selected_fits",
    "comfort_vs_appearance",
    "simple_vs_experimental",
    "budget_tier",
    "shopping_philosophy",
    "familiar_vs_new",
    "repeat_frequency",
    "variety_preference",
    "top_category",
    "top_subcategory",
    "top_color",
    "top_pattern",
    "bottom_category",
    "bottom_subcategory",
    "bottom_color",
    "bottom_pattern",
    "shoes_category",
    "shoes_subcategory",
    "shoes_color",
    "outfit_style",
    "outfit_fit",
    "color_combination",
]

NUMERICAL_FEATURES = [
    "target_formality",
    "comfort_priority",
    "color_pair_top_bottom",
    "color_pair_bottom_shoes",
    "color_pair_top_shoes",
    "color_harmony_score",
    "distinct_non_neutral_colors",
    "rule_of_three_penalty",
    "fit_match",
    "style_match_score",
    "color_preference_affinity",
    "outfit_formality",
    "formality_delta",
    "occasion_score",
    "hard_occasion_eligible",
]

ALL_42_FEATURES = CATEGORICAL_FEATURES + NUMERICAL_FEATURES


class RecommendationMLService:
    def __init__(self, base_artifacts_dir: Optional[str] = None):
        self.artifacts_dir = base_artifacts_dir or self._discover_artifacts_dir()
        self.prod_manifest_path = os.path.join(
            self.artifacts_dir, "recommendation", "current_production_model.json"
        )
        self.pipeline = None
        self.metadata: Dict[str, Any] = {}
        self.is_loaded = False
        self.active_version = "none"
        self.last_load_error: Optional[str] = None
        self.inference_count = 0
        self.total_latency_ms = 0.0

        # Load active model on initialization
        self.load_active_model()

    def _discover_artifacts_dir(self) -> str:
        candidates = [
            os.path.abspath("artifacts"),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "artifacts")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts")),
            os.getenv("ARTIFACTS_DIR", "artifacts"),
        ]
        for c in candidates:
            if os.path.isdir(c):
                return c
        return os.path.abspath("artifacts")

    def load_active_model(self) -> bool:
        """Load the active recommendation model into memory."""
        try:
            if not os.path.exists(self.prod_manifest_path):
                # Check legacy recommendation_engine directory fallback
                legacy_joblib = os.path.abspath("recommendation_engine/tailorbird_preference_model.joblib")
                legacy_json = os.path.abspath("recommendation_engine/tailorbird_preference_model.json")
                if os.path.exists(legacy_joblib):
                    model_bundle = joblib.load(legacy_joblib)
                    self.pipeline = model_bundle.get("model")
                    self.metadata = {k: v for k, v in model_bundle.items() if k != "model"}
                    self.is_loaded = True
                    self.active_version = self.metadata.get("model_version", "1.0.0")
                    self.last_load_error = None
                    logger.info(f"[RecommendationML] Loaded legacy model bundle v{self.active_version}")
                    return True
                self.is_loaded = False
                self.last_load_error = "Manifest not found"
                return False

            with open(self.prod_manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            checkpoint_rel = manifest.get("checkpoint_path", "")
            checkpoint_path = os.path.abspath(checkpoint_rel) if not os.path.isabs(checkpoint_rel) else checkpoint_rel

            if not os.path.exists(checkpoint_path):
                # Try relative to artifacts_dir
                checkpoint_path = os.path.join(self.artifacts_dir, os.path.basename(checkpoint_rel))

            if not os.path.exists(checkpoint_path):
                self.is_loaded = False
                self.last_load_error = f"Checkpoint file missing: {checkpoint_path}"
                logger.warning(f"[RecommendationML] {self.last_load_error}")
                return False

            bundle = joblib.load(checkpoint_path)
            if isinstance(bundle, dict) and "model" in bundle:
                self.pipeline = bundle["model"]
                self.metadata = {k: v for k, v in bundle.items() if k != "model"}
            else:
                self.pipeline = bundle
                self.metadata = manifest

            self.active_version = manifest.get("version_tag", manifest.get("model_version", "v1.0.0"))
            self.is_loaded = True
            self.last_load_error = None
            logger.info(f"[RecommendationML] Successfully loaded active preference model {self.active_version} from {checkpoint_path}")
            return True

        except Exception as e:
            self.is_loaded = False
            self.pipeline = None
            self.last_load_error = str(e)
            logger.error(f"[RecommendationML] Error loading model: {e}", exc_info=True)
            return False

    def get_info(self) -> Dict[str, Any]:
        """Return diagnostic and deployment info for Admin Dashboard."""
        avg_latency = (
            round(self.total_latency_ms / max(1, self.inference_count), 2)
            if self.inference_count > 0
            else 0.0
        )
        return {
            "model_name": self.metadata.get("model_name", "TailorBird Random Forest Regressor"),
            "algorithm": "RandomForestRegressor",
            "active_version": self.active_version,
            "status": "active" if self.is_loaded else "unavailable",
            "is_loaded": self.is_loaded,
            "feature_count": len(ALL_42_FEATURES),
            "target": self.metadata.get("target", "synthetic_preference_score"),
            "data_type": self.metadata.get("data_type", "synthetic"),
            "training_rows": self.metadata.get("training_rows", 10109),
            "testing_rows": self.metadata.get("testing_rows", 2624),
            "training_users": self.metadata.get("training_users", 400),
            "testing_users": self.metadata.get("testing_users", 100),
            "metrics": self.metadata.get("metrics", {"mae": 0.0811, "rmse": 0.1027, "r2": 0.5953}),
            "sklearn_version": self.metadata.get("sklearn_version", "1.9.1"),
            "last_error": self.last_load_error,
            "inference_count": self.inference_count,
            "avg_latency_ms": avg_latency,
            "features": ALL_42_FEATURES,
            "categorical_features": CATEGORICAL_FEATURES,
            "numerical_features": NUMERICAL_FEATURES,
        }

    def construct_42_features(
        self,
        items: List[Clothing],
        user: Any,
        user_pref: Any,
        target_occasion: str,
        occasion_prof: Dict[str, Any],
        temp: float,
        condition: str,
        color_analysis: Dict[str, Any],
        compat_score: float,
        score_occasion: float,
        hard_eligible: bool = True,
    ) -> Dict[str, Any]:
        """
        Construct the exact 42 features required by the Random Forest model
        from verified candidate outfit garments and user preferences.
        """
        # User profile defaults
        fits_dict = {}
        if user_pref and getattr(user_pref, "preferred_fits", None):
            if isinstance(user_pref.preferred_fits, dict):
                fits_dict = user_pref.preferred_fits

        lifestyle = fits_dict.get("lifestyle_occupation", {})
        occupation = lifestyle.get("category", "professional") if isinstance(lifestyle, dict) else "professional"
        workplace = lifestyle.get("workplace_type", "office") if isinstance(lifestyle, dict) else "office"

        # Explicit styles and preferences
        pref_styles = getattr(user_pref, "preferred_styles", []) or ["Casual", "Minimalist"]
        pref_colors = getattr(user_pref, "preferred_colors", []) or ["Black", "White", "Navy"]
        avoid_colors = fits_dict.get("avoided_colors", []) or fits_dict.get("disliked_colors", []) or []
        user_fits = fits_dict.get("fits", ["Regular"])
        budget_tier = fits_dict.get("budget_preference", "moderate")
        shopping_phil = fits_dict.get("shopping_preferences", {}).get("shopping_frequency", "quality_over_quantity")

        # Partition outfit items into top, bottom, shoes
        top_item = None
        bottom_item = None
        shoes_item = None

        for it in items:
            cat = (it.category or "").lower()
            sub = (it.subcategory or "").lower()
            name = (it.name or "").lower()

            if any(k in cat or k in sub or k in name for k in ["shoe", "footwear", "sneaker", "boot", "loafer"]):
                shoes_item = it
            elif any(k in cat or k in sub or k in name for k in ["bottom", "pant", "jean", "trouser", "skirt", "short"]):
                bottom_item = it
            elif any(k in cat or k in sub or k in name for k in ["top", "shirt", "tee", "blouse", "kurta", "kurti", "sweater", "dress", "saree"]):
                top_item = it

        # Fallbacks if strict partition leaves any slot open
        if not top_item and items:
            top_item = items[0]
        if not bottom_item:
            bottom_item = items[1] if len(items) > 1 else top_item
        if not shoes_item:
            shoes_item = items[2] if len(items) > 2 else bottom_item

        # Garment features
        top_cat = top_item.category or "Tops"
        top_sub = top_item.subcategory or "Shirts"
        top_color = top_item.color or "White"
        top_pattern = top_item.pattern or "Solid"

        bot_cat = bottom_item.category or "Bottoms"
        bot_sub = bottom_item.subcategory or "Jeans"
        bot_color = bottom_item.color or "Navy"
        bot_pattern = bottom_item.pattern or "Solid"

        sho_cat = shoes_item.category or "Shoes"
        sho_sub = shoes_item.subcategory or "Sneakers"
        sho_color = shoes_item.color or "White"

        # Pairwise color scores from ColorCoordinationService
        c_top = (top_color or "white").lower().strip()
        c_bot = (bot_color or "navy").lower().strip()
        c_sho = (sho_color or "white").lower().strip()

        score_tb = ColorCoordinationService.get_harmony_score(c_top, c_bot)
        score_bs = ColorCoordinationService.get_harmony_score(c_bot, c_sho)
        score_ts = ColorCoordinationService.get_harmony_score(c_top, c_sho)

        # Formality
        from app.services.recommendation_service import get_garment_formality
        formalities = [get_garment_formality(i) for i in items]
        outfit_formality = sum(formalities) / len(formalities) if formalities else 0.50
        target_formality = occasion_prof.get("target_formality", 0.40)
        formality_delta = abs(target_formality - outfit_formality)

        # Non-neutral count
        palette_info = ColorCoordinationService.analyze_palette(items)
        chromatic_count = palette_info.get("chromatic_count", 1)
        r3_penalty = 0.30 if chromatic_count > 3 else 0.0

        # Preference affinities
        style_match = 1.0 if any(getattr(i, "style", "Casual") in pref_styles for i in items) else 0.70
        color_affinity = 1.0 if any(i.color in pref_colors for i in items) else 0.70

        return {
            # Categorical (27)
            "occupation": str(occupation),
            "general_routine_style": str(workplace),
            "selected_styles": ", ".join(pref_styles) if isinstance(pref_styles, list) else str(pref_styles),
            "preferred_colors": ", ".join(pref_colors) if isinstance(pref_colors, list) else str(pref_colors),
            "disliked_colors": ", ".join(avoid_colors) if isinstance(avoid_colors, list) else str(avoid_colors),
            "selected_fits": ", ".join(user_fits) if isinstance(user_fits, list) else str(user_fits),
            "comfort_vs_appearance": "balanced",
            "simple_vs_experimental": "simple",
            "budget_tier": str(budget_tier),
            "shopping_philosophy": str(shopping_phil),
            "familiar_vs_new": "familiar",
            "repeat_frequency": "normal",
            "variety_preference": "moderate",
            "top_category": str(top_cat),
            "top_subcategory": str(top_sub),
            "top_color": str(top_color),
            "top_pattern": str(top_pattern),
            "bottom_category": str(bot_cat),
            "bottom_subcategory": str(bot_sub),
            "bottom_color": str(bot_color),
            "bottom_pattern": str(bot_pattern),
            "shoes_category": str(sho_cat),
            "shoes_subcategory": str(sho_sub),
            "shoes_color": str(sho_color),
            "outfit_style": getattr(top_item, "style", "Casual") or "Casual",
            "outfit_fit": getattr(top_item, "fit", "Regular") or "Regular",
            "color_combination": f"{top_color} + {bot_color}",
            # Numerical (15)
            "target_formality": float(target_formality),
            "comfort_priority": 0.70,
            "color_pair_top_bottom": float(score_tb),
            "color_pair_bottom_shoes": float(score_bs),
            "color_pair_top_shoes": float(score_ts),
            "color_harmony_score": float(color_analysis.get("score", 0.85)),
            "distinct_non_neutral_colors": int(chromatic_count),
            "rule_of_three_penalty": float(r3_penalty),
            "fit_match": 1.0,
            "style_match_score": float(style_match),
            "color_preference_affinity": float(color_affinity),
            "outfit_formality": float(outfit_formality),
            "formality_delta": float(formality_delta),
            "occasion_score": float(score_occasion),
            "hard_occasion_eligible": 1.0 if hard_eligible else 0.0,
        }

    def predict_preference_score(
        self,
        features_dict: Dict[str, Any],
    ) -> Optional[float]:
        """
        Predict outfit preference score using the Random Forest regressor.
        Returns float in [0.0, 1.0], or None if ML inference fails.
        """
        if not self.is_loaded or self.pipeline is None:
            return None

        t0 = time.time()
        try:
            # Construct single-row DataFrame with strict column order
            df = pd.DataFrame([features_dict])[ALL_42_FEATURES]
            pred = self.pipeline.predict(df)
            val = float(pred[0])
            clamped = max(0.0, min(1.0, round(val, 4)))

            latency = (time.time() - t0) * 1000.0
            self.inference_count += 1
            self.total_latency_ms += latency

            return clamped

        except Exception as e:
            logger.warning(f"[RecommendationML] Inference error: {e}. Graceful fallback activated.")
            return None


# Global service singleton
recommendation_ml_service = RecommendationMLService()
