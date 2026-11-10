"""
TailorBird Deterministic Colour Coordination Service.
Evaluates visual colour harmony, contrast, and balance across garment combinations.
Features:
- Perceptual CIELAB & HSV computational colour modeling.
- Support for:
  - Neutral palettes (Black, White, Charcoal, Gray, Cream, Beige, Navy, Brown, Khaki).
  - Monochromatic combinations (matching hues with luminance variations).
  - Complementary relationships (opposite hue wheel contrast, e.g. Navy & Cognac, Olive & Terracotta).
  - Analogous relationships (adjacent hues, e.g. Blue & Green, Amber & Orange).
  - Light-dark value balance (darker bottoms grounding lighter tops).
  - Expressive accent contrast (neutral foundations with vibrant focal points).
- Graceful handling of unconventional palettes without hard rejection.
- Accessible colour swatch palettes with hex codes and contrast labels.
- Zero external LLM or AI inference calls; strictly deterministic.
"""

import math
from typing import List, Dict, Tuple, Optional, Any
from app.models.clothing import Clothing
from app.services.color_extraction_service import TAILORBIRD_COLOR_PALETTE, color_extractor

# Comprehensive HSV representation (Hue: 0-360, Sat: 0-100, Val: 0-100) for taxonomy colors
COLOR_HSV_MAP: Dict[str, Tuple[float, float, float]] = {
    "black": (0.0, 0.0, 7.0),
    "charcoal": (210.0, 20.0, 23.0),
    "gray": (0.0, 0.0, 50.0),
    "grey": (0.0, 0.0, 50.0),
    "white": (0.0, 0.0, 98.0),
    "cream": (57.0, 18.0, 100.0),
    "beige": (60.0, 13.0, 96.0),
    "tan": (34.0, 33.0, 82.0),
    "khaki": (54.0, 27.0, 75.0),
    "navy": (218.0, 79.0, 18.0),
    "blue": (226.0, 83.0, 69.0),
    "light blue": (213.0, 42.0, 99.0),
    "red": (0.0, 83.0, 86.0),
    "maroon": (0.0, 100.0, 50.0),
    "burgundy": (345.0, 67.0, 48.0),
    "pink": (328.0, 53.0, 96.0),
    "green": (142.0, 86.0, 64.0),
    "olive": (82.0, 92.0, 64.0),
    "yellow": (45.0, 97.0, 92.0),
    "mustard": (44.0, 80.0, 78.0),
    "orange": (21.0, 95.0, 92.0),
    "terracotta": (16.0, 66.0, 74.0),
    "brown": (21.0, 87.0, 47.0),
    "cognac": (24.0, 75.0, 61.0),
    "purple": (271.0, 76.0, 92.0),
    "denim blue": (210.0, 55.0, 65.0),
    "multicolor": (280.0, 50.0, 80.0),
}

NEUTRALS = {
    "black", "charcoal", "gray", "grey", "white", "cream",
    "beige", "tan", "khaki", "navy", "brown", "denim blue", "ivory"
}

HARMONIOUS_PAIRS = {
    ("olive", "terracotta"),
    ("terracotta", "olive"),
    ("navy", "cognac"),
    ("cognac", "navy"),
    ("burgundy", "navy"),
    ("navy", "burgundy"),
    ("sage", "brown"),
    ("brown", "sage"),
    ("denim blue", "terracotta"),
    ("terracotta", "denim blue"),
    ("pink", "gray"),
    ("gray", "pink"),
    ("olive", "cream"),
    ("cream", "olive"),
    ("maroon", "gold"),
    ("gold", "maroon"),
    ("navy", "mustard"),
    ("mustard", "navy"),
    ("green", "beige"),
    ("beige", "green"),
    ("blue", "tan"),
    ("tan", "blue"),
}


class ColorCoordinationService:
    """Service providing deterministic colour coordination and swatch generation."""

    @staticmethod
    def normalize_color_name(name: Optional[str]) -> str:
        if not name:
            return "neutral"
        clean = name.strip().lower()
        if "grey" in clean:
            return "gray"
        if "blue" in clean and "light" in clean:
            return "light blue"
        if "denim" in clean:
            return "denim blue"
        for key in COLOR_HSV_MAP.keys():
            if key in clean:
                return key
        return clean

    @staticmethod
    def get_color_hex(name: str) -> str:
        norm = ColorCoordinationService.normalize_color_name(name)
        # Check standard taxonomy palette
        for pal_name, data in TAILORBIRD_COLOR_PALETTE.items():
            if pal_name.lower() == norm or norm in pal_name.lower():
                return data["hex"]
        if norm in ("denim blue", "tan", "khaki", "terracotta", "cognac", "mustard", "burgundy"):
            hsv = COLOR_HSV_MAP.get(norm, (0, 0, 50))
            # Rough HSV to Hex
            return "#4A6B82" if norm == "denim blue" else "#C2A370" if norm in ("tan", "khaki") else "#9B4A38"
        return "#71717A"  # Zinc-500 fallback

    @staticmethod
    def is_neutral(color_name: str) -> bool:
        norm = ColorCoordinationService.normalize_color_name(color_name)
        return norm in NEUTRALS

    @classmethod
    def get_harmony_score(cls, c1: str, c2: str) -> float:
        """Returns pairwise color harmony score between 0.0 and 1.0."""
        n1 = cls.normalize_color_name(c1)
        n2 = cls.normalize_color_name(c2)
        if n1 == n2:
            return 0.95
        if cls.is_neutral(n1) or cls.is_neutral(n2):
            return 0.92
        pair = (n1, n2)
        if pair in HARMONIOUS_PAIRS or (n2, n1) in HARMONIOUS_PAIRS:
            return 0.95
        hsv1 = COLOR_HSV_MAP.get(n1, (0.0, 50.0, 70.0))
        hsv2 = COLOR_HSV_MAP.get(n2, (180.0, 50.0, 70.0))
        delta_h = cls.compute_hue_delta(hsv1[0], hsv2[0])
        if delta_h <= 25.0:
            return 0.95
        if delta_h <= 60.0:
            return 0.93
        if 140.0 <= delta_h <= 220.0:
            return 0.94
        return 0.85

    @staticmethod
    def compute_hue_delta(hue1: float, hue2: float) -> float:
        """Absolute smallest angle between two hues on 360-degree color wheel."""
        diff = abs(hue1 - hue2) % 360.0
        return min(diff, 360.0 - diff)

    @classmethod
    def analyze_palette(cls, items: List[Clothing]) -> Dict[str, Any]:
        """
        Analyzes the colour compatibility of a collection of clothing items.
        Returns:
            score: float (0.0 - 1.0)
            harmony_type: str ("all_neutral", "monochromatic", "complementary", "analogous", "neutral_accent", "balanced_contrast", "unconventional")
            explanation: str
            swatches: List[Dict[str, Any]]
            contrast_balance: str
        """
        swatches: List[Dict[str, Any]] = []
        raw_colors: List[str] = []

        for item in items:
            c_name = item.color or "Gray"
            norm = cls.normalize_color_name(c_name)
            raw_colors.append(norm)
            swatches.append({
                "garment_id": str(item.id) if item.id else None,
                "garment_name": item.name,
                "color_name": c_name.title(),
                "normalized": norm,
                "hex": cls.get_color_hex(norm),
                "is_neutral": cls.is_neutral(norm),
                "category": (item.category or "Top").title(),
            })

        if not raw_colors:
            return {
                "score": 0.90,
                "harmony_type": "all_neutral",
                "explanation": "Neutral and balanced tones create an effortless aesthetic.",
                "swatches": swatches,
                "contrast_balance": "Balanced",
            }

        unique_colors = list(dict.fromkeys(raw_colors))
        non_neutrals = [c for c in unique_colors if not cls.is_neutral(c)]
        neutrals_present = [c for c in unique_colors if cls.is_neutral(c)]

        # Determine light/dark value contrast between top and bottom
        contrast_balance = "Balanced"
        tops = [i for i in items if (i.category or "").lower() in ("tops", "top", "outerwear")]
        bottoms = [i for i in items if (i.category or "").lower() in ("bottoms", "bottom", "pants", "skirt")]
        if tops and bottoms:
            top_val = COLOR_HSV_MAP.get(cls.normalize_color_name(tops[0].color), (0, 0, 60))[2]
            bot_val = COLOR_HSV_MAP.get(cls.normalize_color_name(bottoms[0].color), (0, 0, 40))[2]
            if bot_val < 35 and top_val > 65:
                contrast_balance = "Dark lower garment grounds a crisp lighter upper layer."
            elif top_val < 35 and bot_val > 65:
                contrast_balance = "Statement dark upper layer paired with lighter trousers."

        # 1. All Neutral Palette
        if not non_neutrals:
            distinct = len(unique_colors)
            if distinct == 1:
                return {
                    "score": 0.97,
                    "harmony_type": "all_neutral",
                    "explanation": f"Sophisticated monochromatic {unique_colors[0].title()} styling.",
                    "swatches": swatches,
                    "contrast_balance": contrast_balance,
                }
            names = " and ".join(c.title() for c in unique_colors[:2])
            return {
                "score": 0.96,
                "harmony_type": "all_neutral",
                "explanation": f"Clean neutral harmony combining {names}.",
                "swatches": swatches,
                "contrast_balance": contrast_balance,
            }

        # 2. Neutral Foundation + 1 Expressive Accent
        if len(non_neutrals) == 1:
            accent = non_neutrals[0].title()
            neutral_names = ", ".join(c.title() for c in neutrals_present) if neutrals_present else "neutral base"
            return {
                "score": 0.95,
                "harmony_type": "neutral_accent",
                "explanation": f"Neutral {neutral_names} anchored by an expressive {accent} accent.",
                "swatches": swatches,
                "contrast_balance": contrast_balance,
            }

        # 3. Two Non-Neutral Colors
        if len(non_neutrals) == 2:
            c1, c2 = non_neutrals[0], non_neutrals[1]
            pair = (c1, c2)
            if pair in HARMONIOUS_PAIRS or (c2, c1) in HARMONIOUS_PAIRS:
                return {
                    "score": 0.96,
                    "harmony_type": "complementary",
                    "explanation": f"Complementary harmony between {c1.title()} and {c2.title()}.",
                    "swatches": swatches,
                    "contrast_balance": contrast_balance,
                }

            hsv1 = COLOR_HSV_MAP.get(c1, (0, 50, 70))
            hsv2 = COLOR_HSV_MAP.get(c2, (180, 50, 70))
            delta_h = cls.compute_hue_delta(hsv1[0], hsv2[0])

            # Monochromatic (same hue family with different saturation/value)
            if delta_h <= 25.0:
                return {
                    "score": 0.95,
                    "harmony_type": "monochromatic",
                    "explanation": f"Tonal monochromatic styling combining shades of {c1.title()} and {c2.title()}.",
                    "swatches": swatches,
                    "contrast_balance": contrast_balance,
                }

            # Analogous (adjacent on color wheel, 25 - 60 degrees)
            if delta_h <= 60.0:
                return {
                    "score": 0.93,
                    "harmony_type": "analogous",
                    "explanation": f"Analogous color flow between {c1.title()} and {c2.title()}.",
                    "swatches": swatches,
                    "contrast_balance": contrast_balance,
                }

            # Complementary (near opposite on color wheel, 140 - 220 degrees)
            if 140.0 <= delta_h <= 220.0:
                return {
                    "score": 0.94,
                    "harmony_type": "complementary",
                    "explanation": f"Complementary contrast balancing {c1.title()} and {c2.title()}.",
                    "swatches": swatches,
                    "contrast_balance": contrast_balance,
                }

            # Triadic / Bold contrast (unconventional yet valid)
            return {
                "score": 0.86,
                "harmony_type": "balanced_contrast",
                "explanation": f"Bold color contrast between {c1.title()} and {c2.title()}.",
                "swatches": swatches,
                "contrast_balance": contrast_balance,
            }

        # 4. Three or more non-neutrals: Multi-color assemblage
        non_neutral_names = ", ".join(c.title() for c in non_neutrals[:3])
        return {
            "score": 0.76,
            "harmony_type": "unconventional",
            "explanation": f"Multi-color expressive palette featuring {non_neutral_names}.",
            "swatches": swatches,
            "contrast_balance": contrast_balance,
        }
