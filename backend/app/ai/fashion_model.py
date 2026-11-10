"""
Specialized Fashion AI Multi-Task Classification Model.
Architecture: EfficientNet-B0 Backbone with 9 Multi-Task Classification Heads:
1. articleType (142 classes)
2. masterCategory (7 classes)
3. subCategory (45 classes)
4. gender (5 classes)
5. baseColour (47 classes)
6. season (5 classes)
7. usage (9 classes)
8. pattern (16 classes)
9. ageGroup (6 classes)

Evaluation mode inference with torch.inference_mode().
Supports CPU and GPU execution.
Zero dependencies on external generative AI, FashionCLIP, or vision-language models.
"""

import os
import io
import json
import logging
from typing import Dict, Any, List, Optional, Union
from PIL import Image
import numpy as np
import torch
import torch.nn as nn
from torchvision.models import efficientnet_b0
import torchvision.transforms as T
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

TASK_SNAKE_MAP: Dict[str, str] = {
    "articleType": "article_type",
    "masterCategory": "master_category",
    "subCategory": "sub_category",
    "gender": "gender",
    "baseColour": "base_colour",
    "season": "season",
    "usage": "usage",
    "pattern": "pattern",
    "ageGroup": "age_group",
}

CATEGORY_MAP_HINTS = {
    # Topwear
    "topwear": "top",
    "shirts": "top",
    "tshirts": "top",
    "tops": "top",
    "sweaters": "top",
    "sweatshirts": "top",
    "hoodies": "top",
    "kurtas": "top",
    "kurtis": "top",
    "tunics": "top",
    "jackets": "outerwear",
    "blazers": "outerwear",
    "coats": "outerwear",
    "waistcoat": "outerwear",
    "shrug": "outerwear",
    # Bottomwear
    "bottomwear": "bottom",
    "jeans": "bottom",
    "trousers": "bottom",
    "pants": "bottom",
    "track pants": "bottom",
    "shorts": "bottom",
    "skirts": "bottom",
    "salwar": "bottom",
    "churidar": "bottom",
    "leggings": "bottom",
    "capris": "bottom",
    # Dress & Sets
    "dress": "dress",
    "dresses": "dress",
    "jumpsuit": "dress",
    "sarees": "dress",
    "lehenga choli": "dress",
    "kurta sets": "top",
    # Footwear
    "footwear": "shoes",
    "shoes": "shoes",
    "casual shoes": "shoes",
    "formal shoes": "shoes",
    "sports shoes": "shoes",
    "flats": "shoes",
    "heels": "shoes",
    "sandals": "shoes",
    "flip flops": "shoes",
    # Accessories
    "accessories": "accessory",
    "bags": "accessory",
    "handbags": "accessory",
    "backpacks": "accessory",
    "clutches": "accessory",
    "wallets": "accessory",
    "belts": "accessory",
    "watches": "accessory",
}


class MultiTaskEfficientNetB0(nn.Module):
    """
    Multi-task classification model matching the exact training implementation:
    - Backbone: torchvision.models.efficientnet_b0.features (1280 channels)
    - Pooling: AdaptiveAvgPool2d(1) -> Flatten
    - Heads: nn.ModuleDict with an nn.Linear(1280, num_classes) for each task
    """

    def __init__(self, tasks: List[str], num_classes: Dict[str, int]):
        super().__init__()
        base_model = efficientnet_b0(weights=None)
        self.features = base_model.features
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.heads = nn.ModuleDict({
            task: nn.Linear(1280, num_classes[task])
            for task in tasks
        })

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        feat = self.features(x)
        feat = self.pool(feat)
        feat = torch.flatten(feat, 1)
        return {task: head(feat) for task, head in self.heads.items()}


class FashionModelService:
    """
    Production-grade singleton service for fashion garment attribute prediction.
    - Loads trained model artifacts once on startup.
    - Sets model to eval mode and uses torch.inference_mode() for predictions.
    - Automatically uses CUDA when available, falling back to CPU.
    - Preprocessing matches training: RGBA solid-white compositing, 224x224 resize, ImageNet normalization.
    - Gracefully handles missing artifacts without crashing FastAPI startup.
    """

    def __init__(self, artifacts_dir: Optional[str] = None):
        self.artifacts_dir = artifacts_dir or self._discover_artifacts_dir()
        self._device: Optional[torch.device] = None
        self.model: Optional[MultiTaskEfficientNetB0] = None
        self.model_config: Dict[str, Any] = {}
        self.preprocessing_config: Dict[str, Any] = {}
        self.class_mappings: Dict[str, Any] = {}
        self.model_version: str = "1.0.0"
        self.model_name: str = "efficientnet_b0_multitask"
        self.is_loaded: bool = False
        self.is_loading: bool = False
        self.load_error: Optional[str] = None
        self.transform: Optional[T.Compose] = None
        self.confidence_threshold: float = 0.40

    @property
    def device(self) -> torch.device:
        if self._device is None:
            # Enforce CPU execution on Render and CPU-only cloud instances to prevent CUDA init stalls
            if os.getenv("RENDER") == "true" or bool(os.getenv("RENDER_SERVICE_ID")) or os.getenv("FORCE_CPU", "false").lower() == "true":
                self._device = torch.device("cpu")
            else:
                self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        return self._device

    def _discover_artifacts_dir(self) -> str:
        """Find the artifacts directory reliably across different working directories."""
        candidates = [
            os.path.abspath("artifacts"),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "artifacts")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts")),
            os.getenv("ARTIFACTS_DIR", "artifacts"),
        ]
        for c in candidates:
            if os.path.isdir(c) and os.path.exists(os.path.join(c, "best_model.pt")):
                return c
        return os.path.abspath("artifacts")

    def load_model(self, checkpoint_override: Optional[str] = None) -> bool:
        """
        Load the trained fashion AI model checkpoint and configuration files.
        Prioritizes the designated production model from current_production_model.json.
        Fails safely back to baseline best_model.pt if candidate or custom checkpoint fails.
        """
        prod_meta_path = os.path.join(self.artifacts_dir, "current_production_model.json")
        active_checkpoint = os.path.join(self.artifacts_dir, "best_model.pt")
        active_version = "1.0.0"

        if checkpoint_override and os.path.exists(checkpoint_override):
            active_checkpoint = checkpoint_override
            active_version = "candidate"
        elif os.path.exists(prod_meta_path):
            try:
                with open(prod_meta_path, "r", encoding="utf-8") as pf:
                    prod_info = json.load(pf)
                    cand_path = prod_info.get("checkpoint_path", "")
                    # Resolve relative to artifacts_dir or repo root
                    if not os.path.isabs(cand_path):
                        cand_path = os.path.abspath(cand_path)
                    if os.path.exists(cand_path):
                        active_checkpoint = cand_path
                        raw_tag = prod_info.get("version_tag", "1.0.0")
                        active_version = "1.0.0" if raw_tag in ("v1.0.0", "1.0.0") else raw_tag
            except Exception as pe:
                logger.warning(f"[FashionModelService] Error reading current_production_model.json: {pe}")

        model_path = active_checkpoint
        config_path = os.path.join(self.artifacts_dir, "model_config.json")
        prep_path = os.path.join(self.artifacts_dir, "preprocessing.json")
        mappings_path = os.path.join(self.artifacts_dir, "class_mappings.json")

        for p, name in [
            (model_path, f"Checkpoint {model_path}"),
            (config_path, "model_config.json"),
            (prep_path, "preprocessing.json"),
            (mappings_path, "class_mappings.json"),
        ]:
            if not os.path.exists(p):
                logger.warning(f"[FashionModelService] Required artifact file not found: {p} ({name})")
                self.is_loaded = False
                return False

        self.is_loading = True
        self.load_error = None
        try:
            logger.info(f"[FashionModelService] Loading model artifacts from: {self.artifacts_dir} (Checkpoint: {model_path}, Version: {active_version})")
            with open(config_path, "r", encoding="utf-8") as f:
                self.model_config = json.load(f)
            with open(prep_path, "r", encoding="utf-8") as f:
                self.preprocessing_config = json.load(f)
            with open(mappings_path, "r", encoding="utf-8") as f:
                self.class_mappings = json.load(f)

            tasks = self.model_config.get("tasks", [])
            num_classes = self.model_config.get("num_classes", {})
            self.model_version = active_version

            # Initialize architecture
            self.model = MultiTaskEfficientNetB0(tasks=tasks, num_classes=num_classes)

            # Load checkpoint state dict
            checkpoint = torch.load(model_path, map_location=self.device)
            state_dict = checkpoint.get("model_state_dict", checkpoint)
            self.model.load_state_dict(state_dict, strict=True)

            self.model.to(self.device)
            self.model.eval()

            # Build inference transform matching preprocessing.json
            mean = self.preprocessing_config.get("mean", [0.485, 0.456, 0.406])
            std = self.preprocessing_config.get("std", [0.229, 0.224, 0.225])
            image_size = self.preprocessing_config.get("image_size", [224, 224])
            if isinstance(image_size, (list, tuple)):
                target_h, target_w = image_size[0], image_size[1]
            else:
                target_h = target_w = int(image_size)

            self.transform = T.Compose([
                T.Resize((target_h, target_w)),
                T.ToTensor(),
                T.Normalize(mean=mean, std=std),
            ])

            self.is_loaded = True
            logger.info(
                f"[FashionModelService] MultiTaskEfficientNetB0 successfully loaded. "
                f"Device: {self.device}, Tasks: {len(tasks)}, Version: {self.model_version}"
            )
            return True

        except Exception as e:
            self.load_error = str(e)
            logger.warning(f"[FashionModelService] Failed to load fashion model: {e}")
            self.is_loaded = False
            return False
        finally:
            self.is_loading = False

    def load_model_in_background(self) -> None:
        """
        Load model asynchronously in a background thread during application startup.
        Prevents model initialization from delaying Uvicorn port binding on Render.
        """
        if self.is_loaded or self.is_loading:
            return
        import threading

        def _bg_worker():
            try:
                self.load_model()
            except Exception as exc:
                logger.warning(f"[FashionModelService] Background initialization error: {exc}")

        bg_thread = threading.Thread(target=_bg_worker, name="fashion-model-init", daemon=True)
        bg_thread.start()
        logger.info("[FashionModelService] Dispatched non-blocking model load thread.")

    def reload_model(self) -> bool:
        """Hot reload active model without restarting process."""
        self.is_loaded = False
        self.model = None
        return self.load_model()

    def _prepare_image(self, image_input: Union[Image.Image, bytes, np.ndarray]) -> Image.Image:
        """
        Normalize incoming image to RGB PIL image:
        - Handles mobile phone EXIF orientation tags (e.g. portrait/landscape rotation).
        - Decodes bytes or converts numpy array.
        - Composites RGBA images on a solid white background to avoid transparent artifacts.
        """
        from PIL import ImageOps

        if isinstance(image_input, bytes):
            img = Image.open(io.BytesIO(image_input))
        elif isinstance(image_input, np.ndarray):
            img = Image.fromarray(image_input)
        elif isinstance(image_input, Image.Image):
            img = image_input.copy()
        else:
            raise ValueError(f"Unsupported image input type: {type(image_input)}")

        # Correct EXIF rotation metadata (phone camera orientation)
        try:
            transposed = ImageOps.exif_transpose(img)
            if transposed is not None:
                img = transposed
        except Exception as exif_err:
            logger.debug(f"[FashionModelService] EXIF transpose notice: {exif_err}")

        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            rgba = img.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[3])
            return bg
        else:
            return img.convert("RGB")

    def predict(self, image_input: Union[Image.Image, bytes, np.ndarray]) -> Dict[str, Any]:
        """
        Execute multi-task fashion attribute classification.
        Returns snake_case response following API conventions with predictions,
        confidence scores, top alternatives, and review indicators.
        """
        import time

        if self.is_loading:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Fashion AI model is initializing in background. Please retry shortly.",
            )

        if not self.is_loaded or self.model is None or self.transform is None:
            # Attempt lazy loading if not yet initialized
            if not self.load_model():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Fashion AI model is unavailable ({self.load_error or 'artifacts missing'}).",
                )

        t_start = time.perf_counter()
        pil_img = self._prepare_image(image_input)
        orig_w, orig_h = pil_img.size
        tensor = self.transform(pil_img).unsqueeze(0).to(self.device)

        with torch.inference_mode():
            outputs = self.model(tensor)

        task_results: Dict[str, Any] = {}
        confidences: List[float] = []
        any_review_required = False

        for task, logits in outputs.items():
            snake_key = TASK_SNAKE_MAP.get(task, task.lower())
            probs = torch.softmax(logits, dim=1)[0]
            k_val = min(5, probs.shape[0])
            top_probs, top_indices = torch.topk(probs, k=k_val)

            mapping = self.class_mappings.get(task, {})
            idx_to_label = mapping.get("idx_to_label", {})

            # Filter out NaN/None/Null labels
            valid_candidates = []
            for p, idx in zip(top_probs, top_indices):
                lbl = idx_to_label.get(str(idx.item()), "Unknown")
                if lbl.lower() not in ("nan", "none", "null", ""):
                    valid_candidates.append((lbl, round(float(p.item()), 4)))

            if valid_candidates:
                best_label, best_conf = valid_candidates[0]
                alt_candidates = valid_candidates[1:4]
            else:
                default_fallback = "All-Season" if snake_key == "season" else ("Casual" if snake_key == "usage" else "Standard")
                best_label = default_fallback
                best_conf = round(float(top_probs[0].item()), 4)
                alt_candidates = []

            confidences.append(best_conf)
            is_low_conf = best_conf < self.confidence_threshold
            if is_low_conf:
                any_review_required = True

            alternatives = [
                {"label": alt_lbl, "confidence": alt_c}
                for alt_lbl, alt_c in alt_candidates
            ]

            task_results[snake_key] = {
                "prediction": best_label,
                "confidence": best_conf,
                "review_required": is_low_conf,
                "alternatives": alternatives,
            }

        avg_confidence = round(float(np.mean(confidences)), 4) if confidences else 0.0
        elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)

        # Diagnostic logging of inference performance and top attributes
        logger.info(
            f"[FashionModel:Inference] InputSize={orig_w}x{orig_h}, Device={self.device}, "
            f"Latency={elapsed_ms}ms, AvgConfidence={avg_confidence}, "
            f"ArticleType='{task_results.get('article_type', {}).get('prediction')}' ({task_results.get('article_type', {}).get('confidence')}), "
            f"Color='{task_results.get('base_colour', {}).get('prediction')}', "
            f"Season='{task_results.get('season', {}).get('prediction')}', "
            f"Usage='{task_results.get('usage', {}).get('prediction')}'"
        )

        response = {
            **task_results,
            "model_version": self.model_version,
            "model_name": self.model_name,
            "overall_confidence": avg_confidence,
            "review_required": any_review_required,
        }
        return response

    def map_wardrobe_category(self, article_type: str, sub_category: str, master_category: str) -> str:
        """
        Map model predictions into standard wardrobe categories for outfit slot classification.
        """
        a_lower = (article_type or "").lower().strip()
        s_lower = (sub_category or "").lower().strip()
        m_lower = (master_category or "").lower().strip()

        if a_lower in CATEGORY_MAP_HINTS:
            return CATEGORY_MAP_HINTS[a_lower]
        if s_lower in CATEGORY_MAP_HINTS:
            return CATEGORY_MAP_HINTS[s_lower]

        if "footwear" in m_lower or "shoes" in s_lower:
            return "shoes"
        if "accessories" in m_lower or "bags" in s_lower:
            return "accessory"
        if "bottomwear" in s_lower:
            return "bottom"
        if "topwear" in s_lower:
            return "top"
        if "dress" in s_lower:
            return "dress"

        return a_lower or "top"

    def format_wardrobe_payload(
        self,
        prediction_res: Dict[str, Any],
        image_source: str = "original",
    ) -> Dict[str, Any]:
        """
        Format prediction result into standard schema payload for ClothingPrediction
        and ClothingPredictionService.save_prediction.
        """
        article_type = prediction_res.get("article_type", {}).get("prediction", "Clothing")
        article_conf = prediction_res.get("article_type", {}).get("confidence", 0.5)
        raw_alts = prediction_res.get("article_type", {}).get("alternatives", [])

        master_cat = prediction_res.get("master_category", {}).get("prediction", "Apparel")
        sub_cat = prediction_res.get("sub_category", {}).get("prediction", "Topwear")
        gender = prediction_res.get("gender", {}).get("prediction", "Unisex")
        base_colour = prediction_res.get("base_colour", {}).get("prediction", "Black")
        season = prediction_res.get("season", {}).get("prediction", "All-Season")
        usage = prediction_res.get("usage", {}).get("prediction", "Casual")
        pattern = prediction_res.get("pattern", {}).get("prediction", "Solid")
        age_group = prediction_res.get("age_group", {}).get("prediction", "Adults")

        mapped_category = self.map_wardrobe_category(article_type, sub_cat, master_cat)

        category_alternatives = []
        for alt in raw_alts:
            alt_lbl = alt.get("label", "")
            mapped_alt = self.map_wardrobe_category(alt_lbl, sub_cat, master_cat)
            category_alternatives.append({
                "category": mapped_alt,
                "display_name": alt_lbl,
                "score": alt.get("confidence", 0.0),
            })

        predicted_attributes = {
            "category": mapped_category,
            "category_display": article_type,
            "subcategory": article_type,
            "article_type": article_type,
            "master_category": master_cat,
            "sub_category": sub_cat,
            "gender": gender,
            "base_colour": base_colour,
            "primary_color": base_colour,
            "color": base_colour,
            "season": season,
            "occasion": usage,
            "usage": usage,
            "pattern": pattern,
            "age_group": age_group,
            "style": usage,
            "fit": "Regular",
            "fabric": "unknown",
            "fabric_uncertain": True,
        }

        color_palette = [
            {"name": base_colour, "hex": "#000000" if base_colour == "Black" else "#FFFFFF", "percentage": 85.0}
        ]

        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "input_image_source": image_source,
            "predicted_category": article_type,
            "category_group": master_cat,
            "category_score": article_conf,
            "category_alternatives": category_alternatives,
            "predicted_attributes": predicted_attributes,
            "prediction_scores": prediction_res,
            "color_palette": color_palette,
            "review_required": prediction_res.get("review_required", False),
        }

    def get_attribute_options(self) -> Dict[str, List[str]]:
        """
        Return clean lists of all possible classes for all 9 heads,
        excluding 'nan' and empty values.
        Keys are snake_case (e.g. article_type, base_colour).
        """
        if not self.class_mappings:
            mappings_path = os.path.join(self.artifacts_dir, "class_mappings.json")
            if os.path.exists(mappings_path):
                try:
                    with open(mappings_path, "r", encoding="utf-8") as f:
                        self.class_mappings = json.load(f)
                except Exception as e:
                    logger.warning(f"Could not read class_mappings.json: {e}")
            else:
                self.load_model()

        options: Dict[str, List[str]] = {}
        for task, snake_key in TASK_SNAKE_MAP.items():
            mapping = self.class_mappings.get(task, {})
            classes = mapping.get("classes", [])
            valid_classes = [
                c for c in classes
                if str(c).lower() not in ("nan", "none", "null", "")
            ]
            options[snake_key] = valid_classes
        return options


# Global singleton instance
fashion_model_service = FashionModelService()
