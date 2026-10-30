"""
CIELAB Perceptual Color Extraction Service for Garments.
Uses cv2.cvtColor(RGB2LAB) and Delta-E Euclidean distances against the standard 27-color fashion palette.
Integrates with Phase 1 foreground masks to exclude background and skin tones.
"""

import io
from typing import List, Dict, Tuple, Optional, Any
import numpy as np
import cv2
from PIL import Image

from app.ai.fashion_taxonomy import COLOR_PALETTE


class ColorExtractionService:
    def __init__(self):
        # Precompute LAB values for the standard fashion color palette
        self.color_names = list(COLOR_PALETTE.keys())
        rgb_list = [COLOR_PALETTE[name]["rgb"] for name in self.color_names]
        
        # Reshape to (1, N, 3) for cv2.cvtColor
        rgb_arr = np.array([rgb_list], dtype=np.uint8)
        lab_arr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2LAB)[0]  # Shape: (N, 3)
        self.palette_lab = lab_arr.astype(np.float32)

    def rgb_to_lab(self, r: int, g: int, b: int) -> np.ndarray:
        rgb = np.array([[[r, g, b]]], dtype=np.uint8)
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[0, 0]
        return lab.astype(np.float32)

    def nearest_color_cielab(self, r: int, g: int, b: int) -> Tuple[str, str, float]:
        """
        Find closest color name and hex from standard fashion palette using CIELAB Delta-E.
        Returns: (color_name, hex_code, delta_e_distance)
        """
        lab = self.rgb_to_lab(r, g, b)
        # Euclidean distance in CIELAB
        diffs = self.palette_lab - lab
        dists = np.sqrt(np.sum(diffs ** 2, axis=1))
        best_idx = int(np.argmin(dists))
        best_name = self.color_names[best_idx]
        best_hex = COLOR_PALETTE[best_name]["hex"]
        return best_name, best_hex, float(dists[best_idx])

    def is_skin_pixel(self, rgb_pixel: np.ndarray) -> bool:
        """
        Precise check for human skin tones in YCrCb space.
        Conservative to prevent false-positives on gold, tan, mustard, and orange fabrics.
        """
        r, g, b = int(rgb_pixel[0]), int(rgb_pixel[1]), int(rgb_pixel[2])
        # Standard YCrCb conversion
        y = 0.299 * r + 0.587 * g + 0.114 * b
        cr = (r - y) * 0.713 + 128
        cb = (b - y) * 0.564 + 128
        # Typical Asian/Caucasian/African skin in YCrCb: Cr in [135, 170], Cb in [85, 125]
        # And R > G > B with R - G > 20 and G - B > 20
        if 135 <= cr <= 170 and 85 <= cb <= 125:
            if r > g > b and (r - g) > 20 and (g - b) > 15:
                return True
        return False

    def extract_colors(
        self,
        image_input: Any,
        mask_input: Optional[Any] = None,
        num_clusters: int = 4,
        exclude_skin: bool = True,
    ) -> Dict[str, Any]:
        """
        Extract primary, secondary, and palette colors from image and optional mask.
        image_input: PIL.Image, bytes, or np.ndarray (RGB or RGBA)
        mask_input: Optional PIL.Image, bytes, or np.ndarray (grayscale mask)
        """
        # 1. Load image to PIL RGB or RGBA
        if isinstance(image_input, bytes):
            pil_img = Image.open(io.BytesIO(image_input))
        elif isinstance(image_input, np.ndarray):
            pil_img = Image.fromarray(image_input)
        elif isinstance(image_input, Image.Image):
            pil_img = image_input.copy()
        else:
            raise ValueError(f"Unsupported image_input type: {type(image_input)}")

        # Check for transparency in RGBA image
        alpha_mask = None
        if pil_img.mode == "RGBA":
            alpha_mask = np.array(pil_img.split()[-1])
            rgb_img = pil_img.convert("RGB")
        else:
            rgb_img = pil_img.convert("RGB")

        # 2. Process external mask if provided
        ext_mask = None
        if mask_input is not None:
            if isinstance(mask_input, bytes):
                ext_mask = np.array(Image.open(io.BytesIO(mask_input)).convert("L"))
            elif isinstance(mask_input, np.ndarray):
                ext_mask = mask_input if mask_input.ndim == 2 else mask_input[:, :, 0]
            elif isinstance(mask_input, Image.Image):
                ext_mask = np.array(mask_input.convert("L"))

        # Resize for fast processing
        analysis_size = (160, 160)
        rgb_resized = np.array(rgb_img.resize(analysis_size, Image.Resampling.BILINEAR))

        # Build combined foreground mask
        if ext_mask is not None:
            m_pil = Image.fromarray(ext_mask).resize(analysis_size, Image.Resampling.NEAREST)
            fg_mask = np.array(m_pil) > 128
        elif alpha_mask is not None:
            a_pil = Image.fromarray(alpha_mask).resize(analysis_size, Image.Resampling.NEAREST)
            fg_mask = np.array(a_pil) > 128
        else:
            # Automatic foreground extraction: exclude near-white and near-black studio background
            gray = cv2.cvtColor(rgb_resized, cv2.COLOR_RGB2GRAY)
            fg_mask = (gray < 248) & (gray > 8)

        # 3. Extract foreground pixels
        fg_pixels = rgb_resized[fg_mask]
        if len(fg_pixels) < 50:
            # Fallback to all pixels if mask is too restrictive
            fg_pixels = rgb_resized.reshape(-1, 3)

        # 4. Optional skin filter
        if exclude_skin and len(fg_pixels) > 200:
            non_skin = [p for p in fg_pixels[::4] if not self.is_skin_pixel(p)]
            if len(non_skin) > 50:
                fg_pixels = np.array(non_skin)

        # 5. K-Means clustering in RGB/LAB space
        # Sklearn KMeans for stable clusters
        from sklearn.cluster import KMeans

        k = min(num_clusters, max(1, len(fg_pixels) // 20))
        if k < 1:
            k = 1

        kmeans = KMeans(n_clusters=k, random_state=42, n_init=3)
        # Sample max 3000 pixels for fast execution (<10ms)
        if len(fg_pixels) > 3000:
            sample_indices = np.random.RandomState(42).choice(len(fg_pixels), 3000, replace=False)
            fg_sampled = fg_pixels[sample_indices]
        else:
            fg_sampled = fg_pixels

        kmeans.fit(fg_sampled)
        labels = kmeans.labels_
        centers = kmeans.cluster_centers_.astype(int)

        counts = np.bincount(labels, minlength=k)
        total = len(labels)
        percentages = counts / total

        # Sort by percentage descending
        sorted_indices = np.argsort(percentages)[::-1]

        palette: List[Dict[str, Any]] = []
        for idx in sorted_indices:
            r, g, b = int(centers[idx][0]), int(centers[idx][1]), int(centers[idx][2])
            name, hex_code, delta_e = self.nearest_color_cielab(r, g, b)
            palette.append({
                "name": name,
                "hex": hex_code,
                "percentage": round(float(percentages[idx]), 3),
                "rgb": [r, g, b],
                "delta_e": round(delta_e, 2),
            })

        # Consolidate duplicate named colors in palette
        consolidated: Dict[str, Dict[str, Any]] = {}
        for entry in palette:
            name = entry["name"]
            if name in consolidated:
                consolidated[name]["percentage"] += entry["percentage"]
            else:
                consolidated[name] = dict(entry)

        sorted_palette = sorted(consolidated.values(), key=lambda x: x["percentage"], reverse=True)
        for p in sorted_palette:
            p["percentage"] = round(p["percentage"], 3)

        primary_color = sorted_palette[0]["name"] if sorted_palette else "Black"
        primary_hex = sorted_palette[0]["hex"] if sorted_palette else "#111111"

        secondary_color = None
        secondary_hex = None
        if len(sorted_palette) > 1 and sorted_palette[1]["percentage"] >= 0.08:
            secondary_color = sorted_palette[1]["name"]
            secondary_hex = sorted_palette[1]["hex"]

        return {
            "primary_color": primary_color,
            "primary_hex": primary_hex,
            "secondary_color": secondary_color,
            "secondary_hex": secondary_hex,
            "palette": sorted_palette,
        }


# Singleton instance
color_extractor = ColorExtractionService()
