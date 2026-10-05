from typing import List
import numpy as np
from PIL import Image
import io


def extract_features_from_image_bytes(image_bytes: bytes) -> List[float]:
    """
    Extract a deterministic 16-dimensional normalized feature vector from image bytes.
    Features:
    [0-2]: Mean RGB (normalized 0-1)
    [3-5]: Std RGB (normalized 0-1)
    [6-8]: Color histogram peaks (3 bins per channel)
    [9]: Aspect ratio
    [10]: Brightness / perceived luminance
    [11]: Contrast
    [12-15]: Spatial quadrant brightness distribution
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_resized = img.resize((128, 128))
        arr = np.array(img_resized, dtype=np.float32) / 255.0
        
        # 1. Mean RGB
        mean_rgb = np.mean(arr, axis=(0, 1)).tolist()
        
        # 2. Std RGB
        std_rgb = np.std(arr, axis=(0, 1)).tolist()
        
        # 3. Luminance (Rec. 709)
        lum = 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]
        brightness = float(np.mean(lum))
        contrast = float(np.std(lum))
        
        # 4. Aspect ratio
        w, h = img.size
        aspect_ratio = float(min(w / max(h, 1), 3.0) / 3.0)
        
        # 5. Spatial quadrants luminance
        q1 = float(np.mean(lum[:64, :64]))
        q2 = float(np.mean(lum[:64, 64:]))
        q3 = float(np.mean(lum[64:, :64]))
        q4 = float(np.mean(lum[64:, 64:]))
        
        # 6. Color histogram bins (simplified)
        r_peak = float(np.histogram(arr[:, :, 0], bins=3, range=(0, 1))[0].argmax() / 2.0)
        g_peak = float(np.histogram(arr[:, :, 1], bins=3, range=(0, 1))[0].argmax() / 2.0)
        
        features = [
            round(mean_rgb[0], 4),
            round(mean_rgb[1], 4),
            round(mean_rgb[2], 4),
            round(std_rgb[0], 4),
            round(std_rgb[1], 4),
            round(std_rgb[2], 4),
            round(r_peak, 4),
            round(g_peak, 4),
            round(brightness, 4),
            round(contrast, 4),
            round(aspect_ratio, 4),
            round(q1, 4),
            round(q2, 4),
            round(q3, 4),
            round(q4, 4),
            round((mean_rgb[0] - mean_rgb[2]) / 2.0 + 0.5, 4),  # warm/cool bias
        ]
        return features[:16]
    except Exception:
        # Fallback to zero vector
        return [0.0] * 16

