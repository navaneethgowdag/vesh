import logging
from typing import Tuple, Optional
import numpy as np
import cv2
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


class ImageCleanupService:
    """
    Garment edge refinement, skin suppression, and catalog-style composition service.
    Produces high-fidelity, centered catalog images on neutral backgrounds
    while preserving authentic fabrics, textures, prints, zari, and details without generative distortion.
    """

    @staticmethod
    def refine_mask(
        image: Image.Image,
        raw_mask: np.ndarray,
        suppress_skin: bool = True,
    ) -> np.ndarray:
        """
        Refine raw segmentation mask:
        1. Morphological closing to seal internal fabric holes and fine textures.
        2. Contour-aware internal void filling: fill small interior dropouts (e.g., buttons, embroidery holes)
           while preserving true garment silhouette and open cuts (necklines, armholes).
        3. Color-guarded skin suppression: removes peripheral face/hands without trimming warm-colored garments,
           collars, or gold/zari embroidery.
        4. Antialiased edge feathering using Gaussian blurring for photorealistic integration.
        """
        orig_w, orig_h = image.size
        # Threshold raw mask to binary
        _, bin_mask = cv2.threshold(raw_mask, 128, 255, cv2.THRESH_BINARY)

        # 1. Morphological closing to fill small gaps along garment edges and seams
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed_mask = cv2.morphologyEx(bin_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)

        # 2. Contour-aware interior hole filling (preserve buttons, labels, embroidery from becoming transparent holes)
        try:
            contours, hierarchy = cv2.findContours(closed_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            if hierarchy is not None and len(contours) > 0:
                hierarchy = hierarchy[0]
                total_garment_area = max([cv2.contourArea(c) for c in contours]) if contours else 1
                for idx, hier in enumerate(hierarchy):
                    # hier[3] >= 0 indicates an internal hole contour (child)
                    if hier[3] >= 0:
                        hole_area = cv2.contourArea(contours[idx])
                        # If hole is small-to-medium (< 15% of garment area), seal it (buttons, embroidery, fabric texture)
                        if hole_area < total_garment_area * 0.15:
                            cv2.drawContours(closed_mask, [contours[idx]], -1, 255, thickness=-1)
        except Exception as contour_err:
            logger.debug(f"Hole filling optimization fallback: {contour_err}")

        # 3. Color-guarded skin suppression (suppress skin near periphery only if garment is not peach/gold/beige)
        if suppress_skin:
            try:
                cv_img = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
                hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)
                ycrcb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2YCrCb)

                # Standard human skin color range in HSV & YCrCb
                hsv_mask = cv2.inRange(hsv, np.array([0, 25, 60]), np.array([25, 255, 255]))
                ycrcb_mask = cv2.inRange(ycrcb, np.array([0, 135, 80]), np.array([255, 170, 125]))
                skin_candidate = cv2.bitwise_and(hsv_mask, ycrcb_mask)

                # Check central garment color to avoid suppressing warm-colored garments (beige, orange, gold zari)
                center_y1, center_y2 = int(orig_h * 0.35), int(orig_h * 0.65)
                center_x1, center_x2 = int(orig_w * 0.35), int(orig_w * 0.65)
                center_crop_hsv = hsv[center_y1:center_y2, center_x1:center_x2]
                mean_hue = np.mean(center_crop_hsv[:, :, 0]) if center_crop_hsv.size > 0 else 50

                # Only apply skin suppression if the garment central hue is NOT in the skin range (0-25)
                # or only apply strictly outside the garment core
                is_warm_garment = (mean_hue < 28)

                # Restrict skin removal strictly to extreme periphery (top 35% face/neck, side 12% hands)
                top_bound = int(orig_h * 0.35) if not is_warm_garment else int(orig_h * 0.12)
                left_bound = int(orig_w * 0.12)
                right_bound = int(orig_w * 0.88)

                periphery_skin = np.zeros_like(skin_candidate)
                periphery_skin[:top_bound, :] = skin_candidate[:top_bound, :]
                periphery_skin[:, :left_bound] = skin_candidate[:, :left_bound]
                periphery_skin[:, right_bound:] = skin_candidate[:, right_bound:]

                # Erode skin mask to strictly protect collar lines and sleeves
                skin_eroded = cv2.erode(periphery_skin, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
                closed_mask = cv2.bitwise_and(closed_mask, cv2.bitwise_not(skin_eroded))
            except Exception as skin_err:
                logger.debug(f"Skin suppression non-critical warning: {skin_err}")

        # 4. Soft feathered edges for smooth anti-aliased integration
        feathered = cv2.GaussianBlur(closed_mask, (5, 5), sigmaX=1.0)
        return feathered

    @classmethod
    def compose_catalog_image(
        cls,
        image: Image.Image,
        mask: np.ndarray,
        output_size: int = 1024,
        bg_color: Tuple[int, int, int] = (255, 255, 255),
    ) -> Tuple[Image.Image, Image.Image]:
        """
        Create standard catalog-style presentation:
        - Garment isolated and centered with 12% padding (usable area ~76%).
        - Clean white (#FFFFFF) or neutral light-gray (#F8F8F8) background.
        - Preserves authentic colors, textures, patterns, and details.
        Returns: (catalog_image_rgb, transparent_image_rgba)
        """
        rgb_img = image.convert("RGB")
        w, h = rgb_img.size

        # Find foreground bounding box
        coords = np.where(mask > 50)
        if len(coords[0]) == 0 or len(coords[1]) == 0:
            # Empty mask fallback: return padded original
            centered_rgb = ImageOps.pad(rgb_img, (output_size, output_size), color=bg_color)
            transparent = centered_rgb.convert("RGBA")
            return centered_rgb, transparent

        y_min, y_max = int(np.min(coords[0])), int(np.max(coords[0]))
        x_min, x_max = int(np.min(coords[1])), int(np.max(coords[1]))

        # Add 4% margin around garment edges to prevent tight bounding box clipping
        pad_x = max(8, int((x_max - x_min) * 0.04))
        pad_y = max(8, int((y_max - y_min) * 0.04))

        crop_x1 = max(0, x_min - pad_x)
        crop_y1 = max(0, y_min - pad_y)
        crop_x2 = min(w, x_max + pad_x)
        crop_y2 = min(h, y_max + pad_y)

        # 1. Generate full RGBA image with refined alpha channel
        alpha_channel = Image.fromarray(mask, mode="L")
        rgba_img = rgb_img.copy()
        rgba_img.putalpha(alpha_channel)

        # Crop to garment bounding box
        cropped_rgba = rgba_img.crop((crop_x1, crop_y1, crop_x2, crop_y2))
        cw, ch = cropped_rgba.size

        # 2. Scale cropped garment to fit inside target box with 12% outer margin (usable_size = 76%)
        usable_size = int(output_size * 0.76)
        scale = min(usable_size / max(cw, 1), usable_size / max(ch, 1))
        new_w = max(10, int(cw * scale))
        new_h = max(10, int(ch * scale))
        scaled_garment = cropped_rgba.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # 3. Center garment on target canvas
        catalog_canvas = Image.new("RGB", (output_size, output_size), color=bg_color)
        transparent_canvas = Image.new("RGBA", (output_size, output_size), color=(0, 0, 0, 0))

        offset_x = (output_size - new_w) // 2
        offset_y = (output_size - new_h) // 2

        # Paste using garment alpha channel
        catalog_canvas.paste(scaled_garment, (offset_x, offset_y), mask=scaled_garment)
        transparent_canvas.paste(scaled_garment, (offset_x, offset_y), mask=scaled_garment)

        return catalog_canvas, transparent_canvas


image_cleanup_service = ImageCleanupService()
