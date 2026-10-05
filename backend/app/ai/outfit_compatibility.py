from typing import List, Dict, Any, Optional
from app.ai.color_analysis import calculate_color_harmony


class OutfitCompatibilityEngine:
    """
    Evaluates outfit compatibility across 5 distinct dimensions:
    1. Category balance (e.g. top + bottom or dress + shoes)
    2. Color harmony (using color naming and color harmony rules)
    3. Style consistency
    4. Seasonality
    5. Formality consistency
    """

    def evaluate_compatibility(
        self,
        items: List[Any],
        target_occasion: Optional[str] = None,
        target_season: Optional[str] = None,
    ) -> Dict[str, Any]:
        item_dicts = []
        for i in items:
            if isinstance(i, dict):
                item_dicts.append(i)
            else:
                item_dicts.append({
                    "category": getattr(i, "category", ""),
                    "primary_color": getattr(i, "color", ""),
                    "style": getattr(i, "style", getattr(i, "occasion", "casual")),
                    "season": [getattr(i, "season", "All-Season")],
                    "formality": getattr(i, "formality", 3),
                })
        return self.compute_compatibility_score(
            items=item_dicts,
            context_season=target_season,
            context_occasion=target_occasion,
        )

    def compute_compatibility_score(
        self,
        items: List[Dict[str, Any]],
        context_season: Optional[str] = None,
        context_occasion: Optional[str] = None
    ) -> Dict[str, Any]:
        if not items:
            return {
                "overall_score": 0.0,
                "category_score": 0.0,
                "color_score": 0.0,
                "style_score": 0.0,
                "formality_score": 0.0,
                "season_score": 0.0,
                "breakdown": {},
                "is_compatible": False,
            }

        # 1. Category balance score
        cat_score = self._evaluate_category_balance(items)

        # 2. Color harmony score
        colors = [item.get("primary_color", "").lower() for item in items if item.get("primary_color")]
        color_score = calculate_color_harmony(colors)

        # 3. Style consistency score
        styles = [item.get("style", "").lower() for item in items if item.get("style")]
        style_score = self._evaluate_style_harmony(styles)

        # 4. Formality consistency
        formalities = [item.get("formality", 3) for item in items if item.get("formality") is not None]
        formality_score = self._evaluate_formality_spread(formalities)

        # 5. Season score
        season_score = 0.85
        if context_season:
            matches = sum(1 for item in items if context_season.lower() in [s.lower() for s in item.get("season", [])])
            season_score = matches / len(items) if items else 0.5

        # Weighted aggregate
        overall = (
            cat_score * 0.25 +
            color_score * 0.25 +
            style_score * 0.20 +
            formality_score * 0.15 +
            season_score * 0.15
        )

        return {
            "overall_score": round(overall, 3),
            "category_score": round(cat_score, 3),
            "color_score": round(color_score, 3),
            "style_score": round(style_score, 3),
            "formality_score": round(formality_score, 3),
            "season_score": round(season_score, 3),
            "breakdown": {
                "category_balance": round(cat_score, 3),
                "color_harmony": round(color_score, 3),
                "style_harmony": round(style_score, 3),
                "formality_consistency": round(formality_score, 3),
                "season_match": round(season_score, 3),
            },
            "is_compatible": overall >= 0.65,
        }

    def _evaluate_category_balance(self, items: List[Dict[str, Any]]) -> float:
        cats = [i.get("category", "").lower() for i in items]
        has_top = any("top" in c for c in cats)
        has_bottom = any("bottom" in c for c in cats)
        has_dress = any("dress" in c for c in cats)
        has_shoes = any("shoe" in c for c in cats)

        if has_dress and (has_shoes or len(items) >= 2):
            return 1.0
        if has_top and has_bottom:
            return 1.0 if has_shoes else 0.85
        if has_top or has_bottom:
            return 0.5
        return 0.3

    def _evaluate_style_harmony(self, styles: List[str]) -> float:
        if not styles:
            return 0.7
        unique_styles = set(styles)
        if len(unique_styles) == 1:
            return 1.0
        if len(unique_styles) == 2:
            return 0.85
        return 0.6

    def _evaluate_formality_spread(self, formalities: List[int]) -> float:
        if not formalities or len(formalities) == 1:
            return 1.0
        spread = max(formalities) - min(formalities)
        if spread <= 1:
            return 1.0
        if spread == 2:
            return 0.8
        if spread == 3:
            return 0.5
        return 0.2


compatibility_engine = OutfitCompatibilityEngine()

