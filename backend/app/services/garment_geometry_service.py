"""
Garment Geometry and Silhouette Service.
Extracts garment category, silhouette, sleeve length, neckline, and Indian garment visual cues
using deterministic contour morphology, aspect ratio profiling, and cross-sectional width measurement.
Does NOT use any generative or vision-language models.
Commercially clean, CPU-optimized, deterministic computer vision.
"""

import io
import logging
from typing import Dict, Any, Optional, Tuple, List
import numpy as np
import cv2
from PIL import Image

logger = logging.getLogger(__name__)


class GarmentGeometryService:
    """
    Analyzes silhouette contours, width profiles at 10 vertical cross-sections,
    sleeve protrusions, and neckline curvature.
    """

    def analyze_geometry(
        self,
        image_input: Any,
        mask_input: Optional[Any] = None,
        color_result: Optional[Dict[str, Any]] = None,
        pattern_result: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze garment geometry and structural attributes.
        """
        if isinstance(image_input, bytes):
            pil_img = Image.open(io.BytesIO(image_input))
        elif isinstance(image_input, np.ndarray):
            pil_img = Image.fromarray(image_input)
        elif isinstance(image_input, Image.Image):
            pil_img = image_input.copy()
        else:
            raise ValueError(f"Unsupported image type: {type(image_input)}")

        rgb_img = pil_img.convert("RGB")
        target_size = (300, 300)
        rgb_resized = np.array(rgb_img.resize(target_size, Image.Resampling.BILINEAR))
        gray = cv2.cvtColor(rgb_resized, cv2.COLOR_RGB2GRAY)

        # 1. Resolve binary foreground mask
        if mask_input is not None:
            if isinstance(mask_input, bytes):
                m_pil = Image.open(io.BytesIO(mask_input)).convert("L")
            elif isinstance(mask_input, np.ndarray):
                m_pil = Image.fromarray(mask_input if mask_input.ndim == 2 else mask_input[:, :, 0])
            elif isinstance(mask_input, Image.Image):
                m_pil = mask_input.convert("L")
            else:
                m_pil = Image.new("L", target_size, 255)
            bin_mask = (np.array(m_pil.resize(target_size, Image.Resampling.NEAREST)) > 128).astype(np.uint8) * 255
        else:
            # Fallback foreground
            bin_mask = ((gray < 245) & (gray > 10)).astype(np.uint8) * 255

        # Clean mask
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed_mask = cv2.morphologyEx(bin_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        # Find largest external contour representing the garment
        contours, _ = cv2.findContours(closed_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return self._default_attributes()

        main_contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(main_contour)
        if w < 10 or h < 10:
            return self._default_attributes()

        aspect_ratio = float(w) / float(h)
        garment_crop_mask = closed_mask[y:y + h, x:x + w]

        # 2. Width cross-sectional profile (10 vertical slices from top to bottom)
        slice_h = max(1, h // 10)
        widths: List[float] = []
        for i in range(10):
            row_start = i * slice_h
            row_end = min((i + 1) * slice_h, h)
            slice_mask = garment_crop_mask[row_start:row_end, :]
            row_widths = np.sum(slice_mask > 0, axis=1)
            mean_slice_width = float(np.mean(row_widths)) if len(row_widths) > 0 else 0.0
            widths.append(mean_slice_width)

        top_width = widths[1] if len(widths) > 1 else w * 0.5  # Shoulder slice
        chest_width = widths[3] if len(widths) > 3 else w * 0.6
        waist_width = widths[5] if len(widths) > 5 else w * 0.5
        hip_width = widths[7] if len(widths) > 7 else w * 0.5
        hem_width = widths[9] if len(widths) > 9 else w * 0.5

        # Flare ratio: hemline width vs waist width
        flare_ratio = (hem_width + 1.0) / (waist_width + 1.0)

        # 3. Leg split detection in lower half (for Jeans / Pants / Trousers / Shorts)
        has_leg_split = False
        lower_half = garment_crop_mask[int(h * 0.6):, :]
        if lower_half.size > 0:
            # Check center column in lower half for void (split between legs)
            center_x = w // 2
            col_slice = lower_half[:, max(0, center_x - 3):min(w, center_x + 3)]
            void_ratio = float(np.mean(col_slice == 0))
            if void_ratio > 0.45:
                has_leg_split = True

        # 4. Sleeve length estimation
        # Compare garment width at arms level (slice 2-4) to torso (slice 5)
        # and look at lower arm presence
        max_upper_width = max(widths[1:4]) if len(widths) > 4 else chest_width
        sleeve_protrusion_ratio = (max_upper_width + 1.0) / (waist_width + 1.0)

        # Check lateral coverage in middle slices (slices 4-7)
        mid_arm_coverage = (widths[4] + widths[5]) / 2.0
        has_extended_sleeves = mid_arm_coverage > (chest_width * 1.05)

        if sleeve_protrusion_ratio < 1.15:
            sleeve_type = "sleeveless"
        elif has_extended_sleeves or widths[3] > chest_width * 1.35:
            sleeve_type = "full_sleeve"
        elif sleeve_protrusion_ratio > 1.35:
            sleeve_type = "short_sleeve"
        else:
            sleeve_type = "three_quarter"

        # 5. Neckline estimation from top contour
        # Extract upper boundary contour between left and right shoulders
        top_slice = garment_crop_mask[:int(h * 0.25), :]
        top_y_indices = []
        for col_idx in range(int(w * 0.25), int(w * 0.75)):
            col_fg = np.where(top_slice[:, col_idx] > 0)[0]
            if len(col_fg) > 0:
                top_y_indices.append(col_fg[0])

        neckline = "crew_neck"
        collar_type = "crew_neck"
        if len(top_y_indices) > 5:
            center_depth = np.max(top_y_indices) - np.min(top_y_indices)
            rel_depth = center_depth / max(h, 1)

            if rel_depth > 0.12:
                neckline = "v_neck"
            elif rel_depth > 0.06:
                neckline = "scoop_neck"
            elif rel_depth < 0.03:
                neckline = "boat_neck"
            else:
                neckline = "crew_neck"

        # 6. Indian Clothing Visual Cues
        has_zari_gold = False
        if color_result and "palette" in color_result:
            for p in color_result["palette"]:
                if p["name"] in ["Yellow", "Orange", "Maroon"] and p.get("percentage", 0) >= 0.025:
                    has_zari_gold = True

        is_embroidered = bool(pattern_result and pattern_result.get("pattern") == "embroidered")

        # 7. Category and Group Decision Logic
        category = "shirt"
        category_group = "western"
        subcategory = "casual_shirt"
        fit = "regular"
        silhouette = "straight"
        length = "regular"

        primary_color_name = color_result.get("primary_color", "") if color_result else ""

        # Rule A: Indian Lehenga (wide flared triangular skirt silhouette: hem wider than waist/top)
        if not has_leg_split and (flare_ratio >= 1.25 or hem_width > top_width * 1.4) and (has_zari_gold or is_embroidered):
            category = "lehenga"
            category_group = "indian"
            subcategory = "flared_lehenga"
            silhouette = "flared"
            length = "full_length"
            fit = "relaxed"

        # Rule B: Indian Saree (wide continuous rectangular/column drape, aspect_ratio >= 1.0, zari or contrast border)
        elif not has_leg_split and aspect_ratio >= 0.98 and (has_zari_gold or is_embroidered or aspect_ratio >= 1.25):
            category = "saree"
            category_group = "indian"
            subcategory = "traditional_saree"
            silhouette = "draped"
            length = "full_length"

        # Rule C & D: Indian Kurta / Sherwani (tunic/coat with zari border or ethnic embroidery without leg split)
        elif not has_leg_split and (has_zari_gold or is_embroidered) and aspect_ratio <= 0.95:
            category_group = "indian"
            neckline = "mandarin_collar"
            collar_type = "mandarin_collar"
            length = "knee_length"

            if primary_color_name in ["Cream", "Beige", "White"] and has_zari_gold:
                category = "sherwani"
                subcategory = "royal_sherwani"
                silhouette = "tailored"
            else:
                category = "kurta"
                subcategory = "straight_kurta"
                silhouette = "straight"

        # Rule E: Bottoms with leg split -> Jeans / Pants / Trousers / Shorts
        elif has_leg_split:
            category_group = "western"
            fit = "slim" if aspect_ratio < 0.45 else "regular"
            if aspect_ratio < 0.55:
                # Long trousers / jeans
                # Check color: denim blue/navy vs tailored
                primary_color = color_result.get("primary_color", "") if color_result else ""
                if primary_color in ["Blue", "Navy", "Light Blue", "Black"]:
                    category = "jeans"
                    subcategory = "denim_jeans"
                else:
                    category = "trousers"
                    subcategory = "tailored_trousers"
                length = "full_length"
                silhouette = "straight"
            else:
                category = "shorts"
                subcategory = "casual_shorts"
                length = "short"

        # Rule F: Flared bottom without leg split -> Skirt
        elif flare_ratio > 1.6 and aspect_ratio < 1.05 and not has_extended_sleeves:
            category = "skirt"
            category_group = "western"
            subcategory = "a_line_skirt"
            silhouette = "a_line"
            length = "midi" if aspect_ratio < 0.8 else "short"

        # Rule G: Western Dress (long vertical silhouette, no leg split)
        elif aspect_ratio < 0.58 and flare_ratio > 1.2:
            category = "western_dress"
            category_group = "western"
            subcategory = "midi_dress"
            silhouette = "a_line" if flare_ratio > 1.4 else "sheath"
            length = "midi"

        # Rule H: Tops (Shirt vs T-Shirt vs Hoodie vs Jacket)
        else:
            category_group = "western"
            if sleeve_type == "full_sleeve":
                category = "shirt"
                subcategory = "long_sleeve_shirt"
                collar_type = "classic_collar"
            elif sleeve_type == "short_sleeve":
                category = "t_shirt"
                subcategory = "crew_neck_tshirt"
                collar_type = "crew_neck"
            else:
                category = "shirt"
                subcategory = "sleeveless_top"
                collar_type = "mandarin_collar" if neckline == "mandarin_collar" else "crew_neck"

            length = "regular"
            silhouette = "regular"

        # Category-specific details
        category_specific: Dict[str, Any] = {
            "sleeve_type": sleeve_type,
            "neckline": neckline,
            "collar_type": collar_type,
            "fit_type": fit,
            "waist_type": "mid_rise" if category in ["jeans", "trousers", "skirt"] else "natural",
            "closure_type": "buttons" if category in ["shirt", "sherwani"] else ("zip_fly" if category == "jeans" else "pullover"),
            "pocket_type": "patch_pocket" if category == "shirt" else ("5_pocket" if category == "jeans" else "none"),
        }

        # Indian Clothing specific attributes
        if category == "saree":
            category_specific["border_style"] = "zari" if has_zari_gold else ("embroidered" if is_embroidered else "plain")
            category_specific["pallu_style"] = "heavy_zari" if has_zari_gold else "contrast"
            category_specific["blouse_style"] = "unstitched"
            category_specific["weave_appearance"] = "banarasi_silk" if has_zari_gold else "cotton_silk"
            category_specific["embroidery"] = "zari" if has_zari_gold else ("threadwork" if is_embroidered else "none")

        elif category == "kurta":
            category_specific["length"] = length
            category_specific["neckline"] = neckline
            category_specific["sleeve_type"] = sleeve_type
            category_specific["embroidery"] = "zari" if has_zari_gold else ("threadwork" if is_embroidered else "none")
            category_specific["silhouette"] = silhouette

        elif category == "lehenga":
            category_specific["skirt_silhouette"] = "flared"
            category_specific["blouse_style"] = "choli"
            category_specific["dupatta"] = "included"
            category_specific["embroidery"] = "zari" if has_zari_gold else ("threadwork" if is_embroidered else "none")

        elif category == "sherwani":
            category_specific["collar"] = "mandarin"
            category_specific["length"] = "knee_length"
            category_specific["embroidery"] = "zari" if has_zari_gold else "minimal"
            category_specific["buttons"] = "decorative_placket"

        return {
            "category": category,
            "category_group": category_group,
            "subcategory": subcategory,
            "silhouette": silhouette,
            "fit": fit,
            "length": length,
            "sleeve_type": sleeve_type,
            "neckline": neckline,
            "category_specific": category_specific,
            "confidence": 0.88,
            "model_identifier": "cv_geometry_profiler_v1",
            "model_version": "1.0.0",
            "evidence": {
                "aspect_ratio": round(aspect_ratio, 3),
                "flare_ratio": round(flare_ratio, 3),
                "has_leg_split": has_leg_split,
                "sleeve_protrusion_ratio": round(sleeve_protrusion_ratio, 3),
            },
        }

    def _default_attributes(self) -> Dict[str, Any]:
        return {
            "category": "shirt",
            "category_group": "western",
            "subcategory": "casual_shirt",
            "silhouette": "regular",
            "fit": "regular",
            "length": "regular",
            "sleeve_type": "short_sleeve",
            "neckline": "crew_neck",
            "category_specific": {
                "sleeve_type": "short_sleeve",
                "neckline": "crew_neck",
                "collar_type": "crew_neck",
                "fit_type": "regular",
            },
            "confidence": 0.50,
            "model_identifier": "cv_geometry_profiler_v1",
            "model_version": "1.0.0",
            "evidence": {},
        }


# Singleton instance
garment_geometry = GarmentGeometryService()
