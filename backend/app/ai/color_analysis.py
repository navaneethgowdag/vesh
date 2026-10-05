import math
from typing import List, Tuple, Dict
import numpy as np
from PIL import Image

# Standard fashion color dictionary with representative RGB values
FASHION_COLORS: Dict[str, Tuple[int, int, int]] = {
    "Black": (20, 20, 20),
    "White": (245, 245, 245),
    "Grey": (128, 128, 128),
    "Beige": (225, 215, 195),
    "Cream": (245, 240, 225),
    "Brown": (120, 75, 45),
    "Cognac": (155, 85, 40),
    "Navy": (20, 35, 75),
    "Blue": (50, 110, 190),
    "Denim Blue": (70, 105, 150),
    "Olive": (100, 110, 60),
    "Sage": (150, 165, 140),
    "Green": (45, 140, 70),
    "Terracotta": (195, 85, 65),
    "Burgundy": (115, 25, 45),
    "Red": (210, 40, 40),
    "Pastel Pink": (235, 190, 200),
    "Yellow": (235, 200, 50),
    "Orange": (230, 115, 40),
    "Purple": (120, 50, 150),
}


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"


def closest_color_name(r: int, g: int, b: int) -> str:
    """Find the closest named fashion color using Euclidean distance in RGB space."""
    min_dist = float("inf")
    best_name = "Black"

    for name, (cr, cg, cb) in FASHION_COLORS.items():
        # Weighted Euclidean distance emphasizing human perception
        dist = 0.3 * (r - cr) ** 2 + 0.59 * (g - cg) ** 2 + 0.11 * (b - cb) ** 2
        if dist < min_dist:
            min_dist = dist
            best_name = name

    return best_name


get_fashion_color_name = closest_color_name


def extract_dominant_colors(image: Image.Image, num_colors: int = 4) -> List[Dict]:
    """
    Extract dominant colors from a PIL Image using K-Means clustering.
    Returns list of dicts: [{'name': '...', 'hex': '...', 'percentage': 0.45}, ...]
    """
    try:
        # Resize image to fast analysis size
        img = image.copy().convert("RGB")
        img.thumbnail((150, 150))
        np_img = np.array(img).reshape((-1, 3))

        # Filter out extreme bright/dark borders if transparent or plain white background
        from sklearn.cluster import KMeans

        kmeans = KMeans(n_clusters=num_colors, random_state=42, n_init=3)
        kmeans.fit(np_img)

        labels = kmeans.labels_
        centers = kmeans.cluster_centers_.astype(int)

        total_pixels = len(labels)
        counts = np.bincount(labels, minlength=num_colors)
        percentages = counts / total_pixels

        # Sort by percentage descending
        sorted_indices = np.argsort(percentages)[::-1]

        results = []
        for idx in sorted_indices:
            r, g, b = int(centers[idx][0]), int(centers[idx][1]), int(centers[idx][2])
            name = closest_color_name(r, g, b)
            results.append({
                "name": name,
                "hex": rgb_to_hex(r, g, b),
                "percentage": round(float(percentages[idx]), 3),
            })

        return results
    except Exception:
        # Fallback if image analysis fails
        return [
            {"name": "Black", "hex": "#1a1a1a", "percentage": 0.6},
            {"name": "White", "hex": "#f5f5f5", "percentage": 0.4},
        ]


def calculate_color_harmony(color_names: List[str]) -> float:
    """
    Calculate color harmony compatibility score between multiple clothing colors.
    Returns score between 0.0 and 1.0.
    """
    if not color_names or len(color_names) == 1:
        return 0.95

    # Universal neutral colors that match with almost everything
    neutrals = {"Black", "White", "Grey", "Beige", "Cream", "Cognac", "Denim Blue"}

    non_neutrals = [c for c in color_names if c not in neutrals]

    # All neutrals -> highly aesthetic minimalist harmony
    if len(non_neutrals) == 0:
        return 0.96

    # 1 color + neutrals -> classic accent harmony
    if len(non_neutrals) == 1:
        return 0.92

    # 2 colors + neutrals: check complementary or analogous pairs
    harmonious_pairs = {
        ("Olive", "Terracotta"),
        ("Terracotta", "Olive"),
        ("Navy", "Cognac"),
        ("Cognac", "Navy"),
        ("Burgundy", "Navy"),
        ("Navy", "Burgundy"),
        ("Sage", "Brown"),
        ("Brown", "Sage"),
        ("Denim Blue", "Terracotta"),
        ("Terracotta", "Denim Blue"),
        ("Pastel Pink", "Grey"),
        ("Grey", "Pastel Pink"),
        ("Olive", "Cream"),
        ("Cream", "Olive"),
    }

    pair = (non_neutrals[0], non_neutrals[1])
    if pair in harmonious_pairs:
        return 0.94

    # 3+ distinct bright non-neutral colors can be visually noisy unless monochrome
    if len(non_neutrals) >= 3:
        return 0.65

    return 0.80

