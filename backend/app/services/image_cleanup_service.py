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
    while preserving original fabrics, textures, and details without generative distortion.
    """

    @staticmethod
    def refine_mask(
        image: Image.Image,
        raw_mask: np.ndarray,
        suppress_skin: bool = True,
    ) -> np.ndarray:
        """
        Refine the raw segmentation mask:
        1. Morphological closing to seal internal fabric holes and fine textures.
        2. Detect and suppress skin pixels near the borders (face, hands, neck in worn photos).
        3. Antialiased edge feathering using Gaussian blurring.
        """
        orig_w, orig_h = image.size
        # Threshold raw mask to binary
        _, bin_mask = cv2.threshold(raw_mask, 128, 255, cv2.THRESH_BINARY)

        # 1. Morphological closing to fill small voids inside garment
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed_mask = cv2.morphologyEx(bin_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)

        # 2. Skin suppression (if requested and person may be present)
        if suppress_skin:
            cv_img = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
            hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)
            ycrcb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2YCrCb)

            # Standard human skin color range in HSV & YCrCb
            hsv_mask = cv2.inRange(hsv, np.array([0, 20, 50]), np.array([25, 255, 255]))
            ycrcb_mask = cv2.inRange(ycrcb, np.array([0, 133, 77]), np.array([255, 173, 127]))
            skin_candidate = cv2.bitwise_and(hsv_mask, ycrcb_mask)

            # Only remove skin from periphery / top 20% (face/neck) and side extremes (hands)
            top_bound = int(orig_h * 0.25)
            left_bound = int(orig_w * 0.15)
            right_bound = int(orig_w * 0.85)

            periphery_skin = np.zeros_like(skin_candidate)
            periphery_skin[:top_bound, :] = skin_candidate[:top_bound, :]
            periphery_skin[:, :left_bound] = skin_candidate[:, :left_bound]
            periphery_skin[:, right_bound:] = skin_candidate[:, right_bound:]

            # Erode skin mask to avoid eating into garment collar
            skin_eroded = cv2.erode(periphery_skin, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
            closed_mask = cv2.bitwise_and(closed_mask, cv2.bitwise_not(skin_eroded))

        # 3. Soft feathered edges for photorealistic integration
        feathered = cv2.GaussianBlur(closed_mask, (5, 5), sigmaX=1.2)
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
        Create standard catalog-style representation:
        - Garment isolated and centered with 12% padding.
        - Preserves authentic colors, textures, and details.
        Returns: (catalog_image_rgb, transparent_image_rgba)
        """
        rgb_img = image.convert("RGB")
        w, h = rgb_img.size

        # Find foreground bounding box
        coords = np.where(mask > 50)
        if len(coords[0]) == 0 or len(coords[1]) == 0:
            # Empty mask fallback: return resized original
            centered_rgb = ImageOps.pad(rgb_img, (output_size, output_size), color=bg_color)
            transparent = centered_rgb.convert("RGBA")
            return centered_rgb, transparent

        y_min, y_max = int(np.min(coords[0])), int(np.max(coords[0]))
        x_min, x_max = int(np.min(coords[1])), int(np.max(coords[1]))

        # Add 5% bbox margin around garment edges
        pad_x = max(10, int((x_max - x_min) * 0.05))
        pad_y = max(10, int((y_max - y_min) * 0.05))

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

        # 2. Scale cropped garment to fit inside target box with 15% inner margin
        usable_size = int(output_size * 0.82)
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
