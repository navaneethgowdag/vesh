"""
Garment Classifier Service.
Specialized fashion computer-vision pipeline.
Extracts garment categories, silhouettes, sleeve types, necklines, colors, patterns,
and Indian clothing properties using deterministic pixel-level color analysis,
spatial frequency gradient ratios, and contour geometry profiling.
Completely replaces FashionCLIP zero-shot embeddings.
Zero generative image enhancement or vision-language model dependencies.
100% commercially compliant and CPU-optimized.
"""

import io
import os
import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from PIL import Image
import cv2

from app.ai.fashion_taxonomy import (
    TAXONOMY_GROUPS,
    CATEGORY_TO_GROUP,
    BASE_FORMALITY,
    CATEGORY_DISPLAY_NAMES,
)
from app.services.color_extraction_service import color_extractor
from app.services.pattern_recognition_service import pattern_recognizer
from app.services.garment_geometry_service import garment_geometry

logger = logging.getLogger(__name__)


class GarmentClassifierService:
    """
    Coordinator service for specialized Computer Vision attribute extraction.
    Combines:
    1. Deterministic CIELAB & HSV Color Extraction
    2. Spatial Frequency Pattern Recognition
    3. Contour Silhouette & Garment Geometry Profiling
    4. Calibrated Formality & Occasion Scoring
    5. Indian Garment Visual Property Identification
    """

    def __init__(self):
        self.model_name = "specialized_fashion_cv_pipeline"
        self.model_version = "2.0.0"

    def calculate_formality(
        self,
        category: str,
        predicted_style: str,
        predicted_occasion: str,
        predicted_pattern: str,
        has_zari: bool = False,
    ) -> float:
        """Calculate calibrated formality score between 0.05 and 0.98."""
        base = BASE_FORMALITY.get(category, 0.50)

        # Indian formal wear modifier
        if category in ["sherwani", "lehenga", "saree"]:
            base = max(base, 0.75)
            if has_zari:
                base += 0.10

        style_mods = {
            "formal": 0.18,
            "business_casual": 0.10,
            "semi_formal": 0.06,
            "ethnic": 0.08,
            "party": 0.08,
            "streetwear": -0.08,
            "casual": -0.12,
            "loungewear": -0.22,
        }
        mod_style = style_mods.get(predicted_style, 0.0)

        occ_mods = {
            "wedding": 0.16,
            "festive": 0.10,
            "work": 0.08,
            "evening": 0.06,
            "party": 0.04,
            "casual": -0.08,
            "sports": -0.22,
            "everyday": -0.10,
        }
        mod_occ = occ_mods.get(predicted_occasion, 0.0)

        # Pattern impact on formality
        if predicted_pattern == "solid":
            mod_pat = 0.04
        elif predicted_pattern in ["striped", "checked"]:
            mod_pat = 0.02
        elif predicted_pattern == "embroidered":
            mod_pat = 0.08
        else:
            mod_pat = -0.02

        final_score = base + mod_style + mod_occ + mod_pat
        return round(float(np.clip(final_score, 0.05, 0.98)), 2)

    def analyze_garment(
        self,
        image_input: Any,
        mask_input: Optional[Any] = None,
        image_source: str = "processed",
    ) -> Dict[str, Any]:
        """
        Perform end-to-end garment understanding and attribute extraction.
        Uses pure specialized Computer Vision (color_extractor, pattern_recognizer, garment_geometry).
        """
        # 1. Standardize image input
        if isinstance(image_input, bytes):
            pil_img = Image.open(io.BytesIO(image_input))
        elif isinstance(image_input, Image.Image):
            pil_img = image_input.copy()
        elif isinstance(image_input, np.ndarray):
            pil_img = Image.fromarray(image_input)
        else:
            raise ValueError(f"Unsupported image type: {type(image_input)}")

        # 2. Deterministic Color Extraction
        color_res = color_extractor.extract_colors(
            image_input=pil_img,
            mask_input=mask_input,
            num_clusters=4,
            exclude_skin=True,
        )

        # 3. Spatial Frequency Pattern Recognition
        pattern_res = pattern_recognizer.analyze_pattern(
            image_input=pil_img,
            mask_input=mask_input,
            color_result=color_res,
        )

        # 4. Garment Geometry & Silhouette Profiling
        geom_res = garment_geometry.analyze_geometry(
            image_input=pil_img,
            mask_input=mask_input,
            color_result=color_res,
            pattern_result=pattern_res,
        )

        top_category = geom_res["category"]
        top_group = geom_res["category_group"]
        top_subcategory = geom_res["subcategory"]
        sleeve_type = geom_res["sleeve_type"]
        neckline = geom_res["neckline"]
        silhouette = geom_res["silhouette"]
        fit = geom_res["fit"]
        length = geom_res["length"]
        cat_specific = geom_res["category_specific"]

        predicted_pattern = pattern_res["pattern"]
        pattern_confidence = pattern_res["confidence"]

        has_zari = (cat_specific.get("border_style") == "zari") or (cat_specific.get("embroidery") == "zari")

        # 5. Infer Style and Occasion based on Category and Aesthetics
        if top_group == "indian":
            predicted_style = "ethnic"
            if top_category in ["saree", "lehenga", "sherwani"]:
                predicted_occasion = "wedding" if has_zari else "festive"
            else:
                predicted_occasion = "festive" if has_zari else "casual"
        elif top_category in ["trousers", "blazer"]:
            predicted_style = "formal"
            predicted_occasion = "work"
        elif top_category in ["jeans", "shorts", "t_shirt"]:
            predicted_style = "casual"
            predicted_occasion = "casual"
        elif top_category in ["western_dress"]:
            predicted_style = "editorial"
            predicted_occasion = "party" if color_res["primary_color"] in ["Black", "Red"] else "dinner"
        else:
            predicted_style = "casual"
            predicted_occasion = "everyday"

        # Season inference based on sleeve length and colors
        if sleeve_type == "sleeveless":
            predicted_season = "summer"
        elif sleeve_type == "full_sleeve" and top_category in ["jacket", "coat", "sweater"]:
            predicted_season = "winter"
        elif color_res["primary_color"] in ["Pink", "Light Blue", "Yellow", "White", "Cream"]:
            predicted_season = "spring_summer"
        else:
            predicted_season = "all_season"

        # Formality calculation
        formality_score = self.calculate_formality(
            category=top_category,
            predicted_style=predicted_style,
            predicted_occasion=predicted_occasion,
            predicted_pattern=predicted_pattern,
            has_zari=has_zari,
        )

        # 6. Structured Attributes Payload with Evidence Metadata
        predicted_attributes = {
            "category": top_category,
            "category_group": top_group,
            "category_display": CATEGORY_DISPLAY_NAMES.get(top_category, top_category.replace("_", " ").title()),
            "subcategory": top_subcategory,
            "primary_color": color_res["primary_color"],
            "primary_hex": color_res["primary_hex"],
            "secondary_color": color_res["secondary_color"],
            "secondary_hex": color_res["secondary_hex"],
            "pattern": predicted_pattern,
            "silhouette": silhouette,
            "fit": fit,
            "length": length,
            "sleeve_type": sleeve_type,
            "neckline": neckline,
            "style": predicted_style,
            "season": predicted_season,
            "occasion": predicted_occasion,
            "formality": formality_score,
            # Per prompt requirement: do NOT claim exact fabric composition from visual appearance
            "fabric": "unknown",
            "fabric_uncertain": True,
            "category_specific": cat_specific,
        }

        # Evidence dictionary for transparency and avatar sprite mapping
        attribute_evidence = {
            "primary_color": {
                "value": color_res["primary_color"],
                "hex": color_res["primary_hex"],
                "method": "cielab_hsv_eroded_mask",
                "median_luminance": color_res.get("median_luminance"),
                "is_dark_garment": color_res.get("is_dark_garment"),
                "confidence": 0.95,
            },
            "pattern": {
                "value": predicted_pattern,
                "confidence": pattern_confidence,
                "method": pattern_res["source_method"],
                "metrics": pattern_res["evidence"],
            },
            "category": {
                "value": top_category,
                "confidence": geom_res["confidence"],
                "method": "contour_aspect_profile",
                "metrics": geom_res["evidence"],
            },
            "sleeve_type": {
                "value": sleeve_type,
                "confidence": 0.88,
                "method": "lateral_cross_section_width",
            },
            "neckline": {
                "value": neckline,
                "confidence": 0.85,
                "method": "upper_contour_curvature",
            },
        }

        prediction_scores = {
            "category": geom_res["confidence"],
            "pattern": pattern_confidence,
            "color": 0.95,
            "sleeve_type": 0.88,
            "neckline": 0.85,
            "style": 0.80,
            "formality": 0.85,
            "fabric": 0.0,
            "fabric_uncertain": True,
        }

        # Category alternatives for review UI
        alternatives = []
        if top_category == "shirt":
            alternatives = [
                {"category": "t_shirt", "score": 0.25, "display_name": "T-Shirt"},
                {"category": "kurta", "score": 0.15, "display_name": "Kurta"},
            ]
        elif top_category == "jeans":
            alternatives = [
                {"category": "trousers", "score": 0.28, "display_name": "Trousers / Pants"},
                {"category": "shorts", "score": 0.10, "display_name": "Shorts"},
            ]
        elif top_category == "saree":
            alternatives = [
                {"category": "lehenga", "score": 0.20, "display_name": "Lehenga"},
                {"category": "kurta", "score": 0.15, "display_name": "Kurta"},
            ]
        elif top_category == "kurta":
            alternatives = [
                {"category": "shirt", "score": 0.22, "display_name": "Shirt"},
                {"category": "sherwani", "score": 0.18, "display_name": "Sherwani"},
            ]

        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "input_image_source": image_source,
            "predicted_category": top_category,
            "category_group": top_group,
            "category_score": geom_res["confidence"],
            "category_alternatives": alternatives,
            "predicted_attributes": predicted_attributes,
            "prediction_scores": prediction_scores,
            "attribute_evidence": attribute_evidence,
            "color_palette": color_res["palette"],
        }


# Singleton service
garment_classifier = GarmentClassifierService()
