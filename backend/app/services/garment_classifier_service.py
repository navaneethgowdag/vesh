"""
Garment Classifier Service.
Runs quantized CLIP ViT-B/32 vision encoder on CPU and matches embeddings against precomputed
fashion taxonomy embeddings (Western, Indian, Footwear, Accessories).
Extracts colors via CIELAB, detects pattern, style, season, occasion, fabric (with uncertainty),
and category-specific attributes.
"""

import io
import os
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from PIL import Image
import cv2

try:
    import onnxruntime as ort
except ImportError:
    ort = None

from app.ai.fashion_taxonomy import (
    TAXONOMY_GROUPS,
    CATEGORY_TO_GROUP,
    BASE_FORMALITY,
    CATEGORY_SPECIFIC_SCHEMAS,
    CATEGORY_DISPLAY_NAMES,
)
from app.services.color_extraction_service import color_extractor

MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "ai_models",
)
VISION_MODEL_PATH = os.path.join(MODELS_DIR, "clip_vision_quantized.onnx")
TAXONOMY_NPZ_PATH = os.path.join(MODELS_DIR, "fashion_taxonomy_embeddings.npz")


class GarmentClassifierService:
    def __init__(self):
        self.session: Optional[Any] = None
        self.embeddings_data: Optional[Dict[str, np.ndarray]] = None
        self.is_loaded = False
        self._load_models()

    def _load_models(self):
        """Load ONNX vision model and precomputed taxonomy embeddings."""
        if not ort or not os.path.exists(VISION_MODEL_PATH):
            return

        try:
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self.session = ort.InferenceSession(VISION_MODEL_PATH, opts)

            if os.path.exists(TAXONOMY_NPZ_PATH):
                self.embeddings_data = dict(np.load(TAXONOMY_NPZ_PATH))
                self.is_loaded = True
        except Exception as e:
            print(f"[GarmentClassifierService] Warning: Failed to load ONNX CLIP models: {e}")
            self.is_loaded = False

    def _preprocess_image(self, image: Image.Image) -> np.ndarray:
        """
        Preprocess PIL image for CLIP ViT-B/32:
        Resize to 224x224, normalize with standard CLIP mean/std, convert to float32 tensor (1, 3, 224, 224).
        """
        # Convert RGBA to RGB on white background if transparent
        if image.mode == "RGBA":
            bg = Image.new("RGB", image.size, (255, 255, 255))
            bg.paste(image, mask=image.split()[-1])
            rgb = bg
        else:
            rgb = image.convert("RGB")

        # Resize with BICUBIC to 224x224
        resized = rgb.resize((224, 224), Image.Resampling.BICUBIC)
        np_img = np.array(resized).astype(np.float32) / 255.0

        # CLIP normalization
        mean = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
        std = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
        norm_img = (np_img - mean) / std

        # Transpose HWC -> CHW and add batch dimension -> NCHW
        tensor = np.transpose(norm_img, (2, 0, 1))
        return np.expand_dims(tensor, axis=0).astype(np.float32)

    def _get_image_embedding(self, image: Image.Image) -> np.ndarray:
        """Compute 512-dim normalized vision embedding."""
        if not self.is_loaded or self.session is None:
            # Fallback deterministic pseudo-embedding
            rng = np.random.RandomState(42)
            vec = rng.randn(1, 512).astype(np.float32)
            return vec / np.linalg.norm(vec)

        tensor = self._preprocess_image(image)
        out = self.session.run(None, {"pixel_values": tensor})[0]
        norm = np.linalg.norm(out, axis=-1, keepdims=True)
        norm[norm == 0] = 1e-12
        return (out / norm).astype(np.float32)

    @staticmethod
    def _softmax(x: np.ndarray, temperature: float = 0.05) -> np.ndarray:
        scaled = x / temperature
        e_x = np.exp(scaled - np.max(scaled))
        return e_x / np.sum(e_x)

    def _classify_against_embeddings(
        self,
        img_emb: np.ndarray,
        key_name: str,
        emb_name: str,
        temperature: float = 0.05,
    ) -> List[Tuple[str, float]]:
        """Compute cosine similarity and calibrated softmax probabilities against taxonomy embeddings."""
        if not self.is_loaded or self.embeddings_data is None:
            return []

        keys = [str(k) for k in self.embeddings_data[key_name]]
        embs = self.embeddings_data[emb_name]  # (N, 512)

        # Dot product
        similarities = np.dot(img_emb, embs.T)[0]  # (N,)
        probs = self._softmax(similarities, temperature=temperature)

        ranked = sorted(zip(keys, probs), key=lambda x: x[1], reverse=True)
        return [(k, float(round(p, 4))) for k, p in ranked]

    def _detect_texture_pattern(
        self,
        image: Image.Image,
        mask: Optional[np.ndarray] = None,
    ) -> Optional[str]:
        """
        Analyze spatial gradients and Laplacian variance across foreground pixels.
        Helps differentiate solid vs striped vs complex printed patterns.
        """
        rgb = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

        if mask is not None:
            fg_mask = mask > 128
        else:
            fg_mask = (gray < 248) & (gray > 8)

        if np.sum(fg_mask) < 200:
            return None

        # Compute Laplacian variance on foreground
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        fg_lap = lap[fg_mask]
        variance = float(np.var(fg_lap))

        # Very low variance -> solid plain fabric
        if variance < 80.0:
            return "solid"

        # Check directional gradients for stripes
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)[fg_mask]
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)[fg_mask]
        var_x = float(np.var(sobel_x))
        var_y = float(np.var(sobel_y))

        ratio = (var_x + 1e-5) / (var_y + 1e-5)
        if ratio > 2.2 or ratio < 0.45:
            return "striped"

        return None

    def infer_category_specific_attributes(
        self,
        category: str,
        color_result: Dict[str, Any],
        predicted_pattern: str,
        predicted_fabric: str,
    ) -> Dict[str, Any]:
        """Infer default category-specific attributes based on detected taxonomy group and features."""
        schema = CATEGORY_SPECIFIC_SCHEMAS.get(category, {})
        has_gold = any(p["name"] == "Gold" or p["name"] == "Silver" for p in color_result.get("palette", []))
        is_silk = predicted_fabric in ["silk", "satin"]

        attrs: Dict[str, Any] = {}

        if category == "saree":
            attrs["border_type"] = "zari" if has_gold else ("embroidered" if predicted_pattern == "embroidered" else "contrast")
            attrs["pallu_design"] = "heavy_zari" if (has_gold and is_silk) else "simple"
            attrs["weave_type"] = "banarasi" if (has_gold and is_silk) else ("cotton" if predicted_fabric == "cotton" else "silk_blend")
            attrs["embroidery_work"] = "zari" if has_gold else ("threadwork" if predicted_pattern == "embroidered" else "none")

        elif category == "lehenga":
            attrs["skirt_silhouette"] = "flared"
            attrs["border_style"] = "broad_zari" if has_gold else "embroidered"
            attrs["embroidery_work"] = "zari" if has_gold else ("threadwork" if predicted_pattern == "embroidered" else "printed")

        elif category == "kurta":
            attrs["length"] = "knee_length"
            attrs["neckline"] = "mandarin_collar"
            attrs["sleeve_length"] = "full"
            attrs["fit_type"] = "straight"

        elif category == "kurti":
            attrs["length"] = "short"
            attrs["neckline"] = "round_neck"
            attrs["sleeve_length"] = "three_quarter"
            attrs["fit_type"] = "straight"

        elif category == "shirt":
            attrs["collar_style"] = "classic_collar"
            attrs["sleeve_length"] = "long"
            attrs["fit_type"] = "regular"
            attrs["length"] = "regular"

        elif category == "t_shirt":
            attrs["collar_style"] = "crew_neck"
            attrs["sleeve_length"] = "short"
            attrs["fit_type"] = "regular"
            attrs["length"] = "regular"

        elif category in ["jeans", "pants"]:
            attrs["fit_type"] = "slim" if category == "jeans" else "regular"
            attrs["length"] = "full_length"
            attrs["waist_style"] = "mid_rise"

        elif category == "skirt":
            attrs["silhouette"] = "a_line"
            attrs["length"] = "midi"
            attrs["waist_style"] = "high_rise"

        elif category == "western_dress":
            attrs["silhouette"] = "a_line"
            attrs["neckline"] = "v_neck"
            attrs["length"] = "midi"
            attrs["sleeve_length"] = "sleeveless"

        else:
            # Fallback for categories without specific schemas
            for k, options in schema.items():
                attrs[k] = options[0] if options else "standard"

        return attrs

    def calculate_formality(
        self,
        category: str,
        predicted_style: str,
        predicted_occasion: str,
        predicted_fabric: str,
    ) -> float:
        """
        Calculate calibrated formality score between 0.0 and 1.0.
        Combines base category formality with style, occasion, and fabric modifiers.
        """
        base = BASE_FORMALITY.get(category, 0.50)

        # Style modifier
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

        # Occasion modifier
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

        # Fabric modifier
        fab_mods = {
            "silk": 0.08,
            "velvet": 0.08,
            "satin": 0.06,
            "denim": -0.08,
            "cotton": -0.02,
        }
        mod_fab = fab_mods.get(predicted_fabric, 0.0)

        final_score = base + mod_style + mod_occ + mod_fab
        return round(float(np.clip(final_score, 0.05, 0.98)), 2)

    def analyze_garment(
        self,
        image_input: Any,
        mask_input: Optional[Any] = None,
        image_source: str = "processed",
    ) -> Dict[str, Any]:
        """
        Perform end-to-end garment understanding and attribute extraction.
        """
        # Load PIL image
        if isinstance(image_input, bytes):
            pil_img = Image.open(io.BytesIO(image_input))
        elif isinstance(image_input, Image.Image):
            pil_img = image_input.copy()
        elif isinstance(image_input, np.ndarray):
            pil_img = Image.fromarray(image_input)
        else:
            raise ValueError(f"Unsupported image type: {type(image_input)}")

        # 1. CIELAB Color Extraction
        color_res = color_extractor.extract_colors(
            image_input=pil_img,
            mask_input=mask_input,
            num_clusters=4,
            exclude_skin=True,
        )

        # 2. Vision Embedding
        img_emb = self._get_image_embedding(pil_img)

        # 3. Category Classification
        cat_ranked = self._classify_against_embeddings(
            img_emb,
            "category_keys",
            "category_embeddings",
            temperature=0.06,
        )
        if cat_ranked:
            top_category = cat_ranked[0][0]
            category_score = cat_ranked[0][1]
            alternatives = [
                {"category": c, "score": s, "display_name": CATEGORY_DISPLAY_NAMES.get(c, c.title())}
                for c, s in cat_ranked[1:4]
            ]
        else:
            top_category = "shirt"
            category_score = 0.50
            alternatives = []

        top_group = CATEGORY_TO_GROUP.get(top_category, "western")

        # 4. Pattern Detection (Texture + Zero-Shot CLIP)
        tex_pattern = self._detect_texture_pattern(pil_img)
        pat_ranked = self._classify_against_embeddings(
            img_emb,
            "pattern_keys",
            "pattern_embeddings",
            temperature=0.07,
        )
        if tex_pattern == "solid":
            predicted_pattern = "solid"
            pattern_confidence = 0.90
        elif tex_pattern == "striped" and any(p[0] == "striped" and p[1] > 0.15 for p in pat_ranked):
            predicted_pattern = "striped"
            pattern_confidence = 0.85
        elif pat_ranked:
            predicted_pattern = pat_ranked[0][0]
            pattern_confidence = pat_ranked[0][1]
        else:
            predicted_pattern = "solid"
            pattern_confidence = 0.50

        # 5. Style Detection
        style_ranked = self._classify_against_embeddings(
            img_emb,
            "style_keys",
            "style_embeddings",
            temperature=0.06,
        )
        predicted_style = style_ranked[0][0] if style_ranked else "casual"
        # If Indian category detected, bias style towards ethnic if reasonable
        if top_group == "indian" and any(s[0] == "ethnic" and s[1] > 0.15 for s in style_ranked):
            predicted_style = "ethnic"

        # 6. Season Detection
        season_ranked = self._classify_against_embeddings(
            img_emb,
            "season_keys",
            "season_embeddings",
            temperature=0.06,
        )
        predicted_season = season_ranked[0][0] if season_ranked else "all_season"

        # 7. Occasion Detection
        occ_ranked = self._classify_against_embeddings(
            img_emb,
            "occasion_keys",
            "occasion_embeddings",
            temperature=0.06,
        )
        predicted_occasion = occ_ranked[0][0] if occ_ranked else "casual"
        if top_category in ["saree", "lehenga", "sherwani"] and predicted_occasion in ["casual", "sports"]:
            predicted_occasion = "festive"

        # 8. Fabric Detection with Explicit Uncertainty Handling
        fabric_ranked = self._classify_against_embeddings(
            img_emb,
            "fabric_keys",
            "fabric_embeddings",
            temperature=0.07,
        )
        top_fabric_score = fabric_ranked[0][1] if fabric_ranked else 0.0
        second_fabric_score = fabric_ranked[1][1] if len(fabric_ranked) > 1 else 0.0

        # If confidence is below threshold or ambiguous between fabrics, mark as 'unknown'
        if top_fabric_score < 0.28 or (top_fabric_score - second_fabric_score) < 0.035:
            predicted_fabric = "unknown"
            fabric_confidence = round(top_fabric_score, 2)
            fabric_uncertain = True
        else:
            predicted_fabric = fabric_ranked[0][0]
            fabric_confidence = round(top_fabric_score, 2)
            fabric_uncertain = False

        # 9. Formality Score Calculation
        formality_score = self.calculate_formality(
            category=top_category,
            predicted_style=predicted_style,
            predicted_occasion=predicted_occasion,
            predicted_fabric=predicted_fabric,
        )

        # 10. Category-specific Attributes
        cat_specific = self.infer_category_specific_attributes(
            category=top_category,
            color_result=color_res,
            predicted_pattern=predicted_pattern,
            predicted_fabric=predicted_fabric,
        )

        # 11. Compile Complete Prediction Payload
        prediction_scores = {
            "category": category_score,
            "pattern": round(pattern_confidence, 2),
            "style": round(style_ranked[0][1], 2) if style_ranked else 0.5,
            "season": round(season_ranked[0][1], 2) if season_ranked else 0.5,
            "occasion": round(occ_ranked[0][1], 2) if occ_ranked else 0.5,
            "fabric": fabric_confidence,
            "fabric_uncertain": fabric_uncertain,
        }

        predicted_attributes = {
            "category": top_category,
            "category_group": top_group,
            "category_display": CATEGORY_DISPLAY_NAMES.get(top_category, top_category.title()),
            "primary_color": color_res["primary_color"],
            "primary_hex": color_res["primary_hex"],
            "secondary_color": color_res["secondary_color"],
            "secondary_hex": color_res["secondary_hex"],
            "pattern": predicted_pattern,
            "style": predicted_style,
            "season": predicted_season,
            "occasion": predicted_occasion,
            "formality": formality_score,
            "fabric": predicted_fabric,
            "fabric_uncertain": fabric_uncertain,
            "category_specific": cat_specific,
        }

        return {
            "model_name": "clip_vit_b32_quantized",
            "model_version": "1.0.0",
            "input_image_source": image_source,
            "predicted_category": top_category,
            "category_group": top_group,
            "category_score": category_score,
            "category_alternatives": alternatives,
            "predicted_attributes": predicted_attributes,
            "prediction_scores": prediction_scores,
            "color_palette": color_res["palette"],
        }


# Singleton service
garment_classifier = GarmentClassifierService()
