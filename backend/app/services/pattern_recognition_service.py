"""
Dedicated Pattern Recognition Service.
Uses OpenCV spatial frequency analysis, directional Sobel gradients,
contour morphology, and texture variance across isolated garment foreground pixels.
Does NOT use any generative or vision-language models.
Supports controlled taxonomy:
[solid, striped, checked, plaid, floral, geometric, printed, abstract, embroidered, textured, multicolor, unknown]
"""

import io
import logging
from typing import Dict, Any, Optional, Tuple, List
import numpy as np
import cv2
from PIL import Image

logger = logging.getLogger(__name__)

SUPPORTED_PATTERNS = [
    "solid",
    "striped",
    "checked",
    "plaid",
    "floral",
    "geometric",
    "printed",
    "abstract",
    "embroidered",
    "textured",
    "multicolor",
    "unknown",
]


class PatternRecognitionService:
    """
    Deterministic Computer Vision pattern classifier.
    Analyzes spatial gradient ratios, 2D periodic frequencies,
    texture variance, and contour geometries.
    """

    def analyze_pattern(
        self,
        image_input: Any,
        mask_input: Optional[Any] = None,
        color_result: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze garment image for visual patterns.
        Returns: {
            "pattern": str,
            "confidence": float,
            "evidence": Dict[str, Any],
            "method": "cv_spatial_frequency_analysis"
        }
        """
        # 1. Convert input to PIL RGB
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

        # 2. Build foreground mask
        if mask_input is not None:
            if isinstance(mask_input, bytes):
                m_pil = Image.open(io.BytesIO(mask_input)).convert("L")
            elif isinstance(mask_input, np.ndarray):
                m_pil = Image.fromarray(mask_input if mask_input.ndim == 2 else mask_input[:, :, 0])
            elif isinstance(mask_input, Image.Image):
                m_pil = mask_input.convert("L")
            else:
                m_pil = Image.new("L", target_size, 255)
            mask_arr = np.array(m_pil.resize(target_size, Image.Resampling.NEAREST))
            bin_mask = (mask_arr > 128).astype(np.uint8) * 255
        else:
            # Fallback foreground threshold
            bin_mask = ((gray < 245) & (gray > 10)).astype(np.uint8) * 255

        # Erode mask by 4 pixels so garment perimeter boundary does not generate artificial stripe edges
        kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        fg_mask = cv2.erode(bin_mask, kernel_erode, iterations=1) > 0

        fg_pixel_count = int(np.sum(fg_mask))
        if fg_pixel_count < 200:
            # Fallback to central interior rectangle (40% width, 50% height)
            h, w = target_size
            fg_mask = np.zeros((h, w), dtype=bool)
            fg_mask[int(h * 0.25):int(h * 0.75), int(w * 0.3):int(w * 0.7)] = True

        fg_gray = gray[fg_mask]
        fg_rgb = rgb_resized[fg_mask]

        # 3. Overall Laplacian texture variance
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        lap_fg = lap[fg_mask]
        lap_variance = float(np.var(lap_fg))

        # Color standard deviation
        color_std = float(np.mean(np.std(fg_rgb, axis=0)))

        # Check for multicolor trigger from color extractor
        is_multicolor_flag = bool(color_result.get("is_multicolor", False)) if color_result else False

        # 4. Directional gradients (Sobel X and Y)
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)[fg_mask]
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)[fg_mask]
        var_x = float(np.var(sobel_x))
        var_y = float(np.var(sobel_y))
        gradient_ratio = (var_x + 1e-4) / (var_y + 1e-4)

        # 5. Check for Embroidery
        # Embroidered garments typically exhibit localized high-frequency clusters
        # often paired with metallic / contrasting threads
        has_zari_gold = False
        if color_result and "palette" in color_result:
            for p in color_result["palette"]:
                if p["name"] in ["Yellow", "Orange"] and p.get("percentage", 0) > 0.05:
                    has_zari_gold = True

        # High variance in local patches
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        high_freq = cv2.absdiff(gray, blurred)[fg_mask]
        high_freq_ratio = float(np.mean(high_freq > 20))

        # 6. Blob & Contour analysis for Floral / Geometric / Printed
        # Threshold high frequency edges
        edges = cv2.Canny(gray, 50, 150)
        edges[~fg_mask] = 0
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        valid_contours = [c for c in contours if 20 < cv2.contourArea(c) < 3000]
        circularities: List[float] = []
        for c in valid_contours[:30]:
            area = cv2.contourArea(c)
            peri = cv2.arcLength(c, True)
            if peri > 0:
                circularities.append(4 * np.pi * area / (peri * peri))

        avg_circularity = float(np.mean(circularities)) if circularities else 0.0

        # -------------------------------------------------------------
        # Decision Logic: Prioritized Pattern Classification
        # -------------------------------------------------------------
        pattern = "solid"
        confidence = 0.85
        evidence = {
            "laplacian_variance": round(lap_variance, 2),
            "color_std": round(color_std, 2),
            "var_x": round(var_x, 2),
            "var_y": round(var_y, 2),
            "gradient_ratio": round(gradient_ratio, 3),
            "high_freq_ratio": round(high_freq_ratio, 3),
            "num_pattern_contours": len(valid_contours),
            "avg_circularity": round(avg_circularity, 3),
        }

        # Rule 1: Solid plain fabric
        if lap_variance < 55.0 and color_std < 16.0:
            pattern = "solid"
            confidence = 0.92

        # Rule 2: Floral (organic, curved circular petal contours - check before orthogonal grid)
        elif len(valid_contours) >= 6 and avg_circularity > 0.35 and color_std > 20.0:
            pattern = "floral"
            confidence = 0.85

        # Rule 3: Directional Stripes (Vertical or Horizontal)
        elif (gradient_ratio > 2.2 or gradient_ratio < 0.45) and max(var_x, var_y) > 120.0:
            pattern = "striped"
            confidence = 0.88
            evidence["stripe_direction"] = "vertical" if gradient_ratio > 2.2 else "horizontal"

        # Rule 4: Embroidered (localized intricate stitch clusters with zari/gold or high texture)
        elif has_zari_gold and lap_variance > 100.0:
            pattern = "embroidered"
            confidence = 0.85

        # Rule 5: Checked / Plaid (orthogonal cross-hatch periodic structure, low circularity grid)
        elif var_x > 120.0 and var_y > 120.0 and (0.60 < gradient_ratio < 1.60) and len(valid_contours) >= 8 and avg_circularity < 0.35:
            pattern = "checked"
            confidence = 0.85

        # Rule 6: Geometric (sharp angular polygonal repeating motifs)
        elif len(valid_contours) >= 8 and avg_circularity <= 0.35 and color_std > 20.0:
            pattern = "geometric"
            confidence = 0.78

        # Rule 7: General Printed / Abstract
        elif color_std > 30.0 and len(valid_contours) >= 5:
            pattern = "printed"
            confidence = 0.75

        # Rule 8: Textured (moderate weave variance with solid uniform color)
        elif 55.0 <= lap_variance <= 220.0 and color_std < 18.0:
            pattern = "textured"
            confidence = 0.82

        # Rule 9: Multicolor fallback if multiple colors without specific geometric motif
        elif is_multicolor_flag and color_std > 26.0:
            pattern = "multicolor"
            confidence = 0.75

        # Rule 10: Low confidence / ambiguous
        elif lap_variance > 250.0 and color_std > 35.0:
            pattern = "abstract"
            confidence = 0.65

        else:
            # Default to solid with moderate confidence
            pattern = "solid"
            confidence = 0.70

        return {
            "pattern": pattern,
            "confidence": round(confidence, 2),
            "evidence": evidence,
            "model_identifier": "cv_spatial_frequency_v1",
            "model_version": "1.0.0",
            "source_method": "deterministic_cv",
        }


# Singleton instance
pattern_recognizer = PatternRecognitionService()
