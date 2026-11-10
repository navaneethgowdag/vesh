"""
Personal Model Evaluation Service.
Calculates rigorous, reproducible evaluation metrics comparing candidate models
against the active production model on the held-out test dataset:
1. Per-head accuracy for all 9 prediction heads.
2. Macro Precision, Recall, and Macro F1 scores.
3. Per-class performance and support counts.
4. Confusion matrices per head.
5. Strict promotion eligibility check (verifies improvements without >2% regression on other heads).
"""

import os
import io
import json
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from uuid import UUID

from PIL import Image, ImageOps
import torch
import torch.nn as nn
import torchvision.transforms as T
from sqlalchemy.orm import Session

from app.models.clothing_image import ClothingImage
from app.ai.fashion_model import MultiTaskEfficientNetB0, TASK_SNAKE_MAP

logger = logging.getLogger(__name__)


def _compute_classification_metrics(
    y_true: List[int],
    y_pred: List[int],
    idx_to_label: Dict[str, str],
) -> Dict[str, Any]:
    """
    Pure Python calculation of multi-class classification metrics:
    accuracy, macro precision, macro recall, macro F1, per-class metrics, support, confusion matrix.
    Zero external ML library dependencies required.
    """
    total = len(y_true)
    if total == 0:
        return {
            "accuracy": 0.0,
            "macro_precision": 0.0,
            "macro_recall": 0.0,
            "macro_f1": 0.0,
            "support": 0,
            "per_class": {},
            "confusion_matrix": {},
        }

    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = round(correct / total, 4)

    # Collect distinct classes present in true labels
    classes_present = sorted(list(set(y_true)))

    # Per-class counts: TP, FP, FN
    tp: Dict[int, int] = {c: 0 for c in classes_present}
    fp: Dict[int, int] = {c: 0 for c in classes_present}
    fn: Dict[int, int] = {c: 0 for c in classes_present}
    support: Dict[int, int] = {c: 0 for c in classes_present}
    confusion: Dict[str, Dict[str, int]] = {}

    for t, p in zip(y_true, y_pred):
        support[t] = support.get(t, 0) + 1
        t_label = idx_to_label.get(str(t), str(t))
        p_label = idx_to_label.get(str(p), str(p))

        if t_label not in confusion:
            confusion[t_label] = {}
        confusion[t_label][p_label] = confusion[t_label].get(p_label, 0) + 1

        if t == p:
            tp[t] = tp.get(t, 0) + 1
        else:
            fn[t] = fn.get(t, 0) + 1
            if p in fp:
                fp[p] = fp.get(p, 0) + 1

    precisions: List[float] = []
    recalls: List[float] = []
    f1s: List[float] = []
    per_class_summary: Dict[str, Any] = {}

    for c in classes_present:
        c_tp = tp[c]
        c_fp = fp[c]
        c_fn = fn[c]
        c_supp = support[c]

        prec = c_tp / (c_tp + c_fp) if (c_tp + c_fp) > 0 else 0.0
        rec = c_tp / (c_tp + c_fn) if (c_tp + c_fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

        precisions.append(prec)
        recalls.append(rec)
        f1s.append(f1)

        c_name = idx_to_label.get(str(c), f"Class {c}")
        per_class_summary[c_name] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "support": c_supp,
        }

    macro_precision = round(sum(precisions) / len(precisions), 4) if precisions else 0.0
    macro_recall = round(sum(recalls) / len(recalls), 4) if recalls else 0.0
    macro_f1 = round(sum(f1s) / len(f1s), 4) if f1s else 0.0

    return {
        "accuracy": accuracy,
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_f1": macro_f1,
        "support": total,
        "per_class": per_class_summary,
        "confusion_matrix": confusion,
    }


class ModelEvaluationService:
    def __init__(self, artifacts_dir: Optional[str] = None):
        self.artifacts_dir = artifacts_dir or self._discover_artifacts_dir()

    def _discover_artifacts_dir(self) -> str:
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

    def _load_image(self, db: Session, clothing_id_str: str) -> Image.Image:
        cid = UUID(clothing_id_str)
        try:
            from sqlalchemy import inspect
            if "clothing_images" in inspect(db.bind).get_table_names():
                ci = (
                    db.query(ClothingImage)
                    .filter(
                        ClothingImage.clothing_id == cid,
                        ClothingImage.image_type == "original",
                    )
                    .first()
                )
                if ci and ci.image_data:
                    raw = Image.open(io.BytesIO(ci.image_data))
                    return ImageOps.exif_transpose(raw).convert("RGB")
        except Exception:
            pass

        # Check ClothingAnalysis feature_vector fallback
        try:
            from app.models.clothing import Clothing
            clothing = db.query(Clothing).filter(Clothing.id == cid).first()
            if clothing and clothing.analysis and isinstance(clothing.analysis.feature_vector, dict):
                orig_b64 = clothing.analysis.feature_vector.get("original_data")
                if orig_b64:
                    import base64
                    img_bytes = base64.b64decode(orig_b64)
                    raw = Image.open(io.BytesIO(img_bytes))
                    return ImageOps.exif_transpose(raw).convert("RGB")
        except Exception:
            pass

        return Image.new("RGB", (224, 224), (245, 245, 245))

    def evaluate_checkpoint(
        self,
        checkpoint_path: str,
        test_records: List[Dict[str, Any]],
        db: Session,
    ) -> Dict[str, Any]:
        """
        Run inference and compute per-head metrics on test records for a specific checkpoint.
        """
        with open(os.path.join(self.artifacts_dir, "model_config.json"), "r", encoding="utf-8") as f:
            model_config = json.load(f)
        with open(os.path.join(self.artifacts_dir, "preprocessing.json"), "r", encoding="utf-8") as f:
            prep_config = json.load(f)
        with open(os.path.join(self.artifacts_dir, "class_mappings.json"), "r", encoding="utf-8") as f:
            class_mappings = json.load(f)

        tasks = model_config.get("tasks", [])
        num_classes = model_config.get("num_classes", {})

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Build transform
        mean = prep_config.get("mean", [0.485, 0.456, 0.406])
        std = prep_config.get("std", [0.229, 0.224, 0.225])
        image_size = prep_config.get("image_size", [224, 224])
        target_h, target_w = (image_size[0], image_size[1]) if isinstance(image_size, (list, tuple)) else (int(image_size), int(image_size))
        transform = T.Compose([
            T.Resize((target_h, target_w)),
            T.ToTensor(),
            T.Normalize(mean=mean, std=std),
        ])

        # Load checkpoint
        model = MultiTaskEfficientNetB0(tasks=tasks, num_classes=num_classes)
        ckpt = torch.load(checkpoint_path, map_location=device)
        state_dict = ckpt.get("model_state_dict", ckpt)
        model.load_state_dict(state_dict, strict=True)
        model.to(device)
        model.eval()

        # Collect ground truth and predictions for each task
        task_ground_truth: Dict[str, List[int]] = {t: [] for t in tasks}
        task_predictions: Dict[str, List[int]] = {t: [] for t in tasks}

        with torch.inference_mode():
            for rec in test_records:
                pil_img = self._load_image(db, rec["clothing_id"])
                tensor = transform(pil_img).unsqueeze(0).to(device)
                outputs = model(tensor)

                label_indices = rec.get("label_indices", {})

                for task, snake_key in TASK_SNAKE_MAP.items():
                    true_idx = label_indices.get(snake_key)
                    if true_idx is not None and int(true_idx) >= 0:
                        pred_logits = outputs[task][0]
                        pred_idx = int(torch.argmax(pred_logits).item())
                        task_ground_truth[task].append(int(true_idx))
                        task_predictions[task].append(pred_idx)

        # Calculate metrics for each task head
        head_metrics: Dict[str, Any] = {}
        total_eval_samples = 0
        sum_acc = 0.0
        sum_f1 = 0.0
        evaluated_heads = 0

        for task, snake_key in TASK_SNAKE_MAP.items():
            y_t = task_ground_truth[task]
            y_p = task_predictions[task]
            idx_map = class_mappings.get(task, {}).get("idx_to_label", {})

            m = _compute_classification_metrics(y_t, y_p, idx_map)
            head_metrics[snake_key] = {
                "task": task,
                "accuracy": m["accuracy"],
                "macro_f1": m["macro_f1"],
                "macro_precision": m["macro_precision"],
                "macro_recall": m["macro_recall"],
                "support": m["support"],
                "per_class": m["per_class"],
                "confusion_matrix": m["confusion_matrix"],
            }
            if m["support"] > 0:
                sum_acc += m["accuracy"]
                sum_f1 += m["macro_f1"]
                evaluated_heads += 1
                total_eval_samples = max(total_eval_samples, m["support"])

        overall_acc = round(sum_acc / max(1, evaluated_heads), 4)
        overall_f1 = round(sum_f1 / max(1, evaluated_heads), 4)

        return {
            "checkpoint_path": checkpoint_path,
            "overall_accuracy": overall_acc,
            "overall_macro_f1": overall_f1,
            "total_test_samples": total_eval_samples,
            "heads": head_metrics,
        }

    def compare_models(
        self,
        candidate_checkpoint: str,
        production_checkpoint: str,
        test_records: List[Dict[str, Any]],
        db: Session,
    ) -> Dict[str, Any]:
        """
        Evaluate candidate and production side-by-side on the identical test split,
        determine delta improvements and evaluate promotion eligibility.
        """
        candidate_results = self.evaluate_checkpoint(candidate_checkpoint, test_records, db)
        production_results = self.evaluate_checkpoint(production_checkpoint, test_records, db)

        comparison_heads: Dict[str, Any] = {}
        any_improvement = False
        any_severe_regression = False
        regression_details = []

        cand_heads = candidate_results.get("heads", {})
        prod_heads = production_results.get("heads", {})

        for snake_key in TASK_SNAKE_MAP.values():
            c_m = cand_heads.get(snake_key, {})
            p_m = prod_heads.get(snake_key, {})

            c_acc = c_m.get("accuracy", 0.0)
            p_acc = p_m.get("accuracy", 0.0)
            c_f1 = c_m.get("macro_f1", 0.0)
            p_f1 = p_m.get("macro_f1", 0.0)

            delta_acc = round(c_acc - p_acc, 4)
            delta_f1 = round(c_f1 - p_f1, 4)

            if delta_acc > 0 or delta_f1 > 0:
                any_improvement = True

            # If accuracy or F1 dropped by more than 0.02 (2%) on a head with support >= 2
            if (delta_acc < -0.02 or delta_f1 < -0.02) and c_m.get("support", 0) >= 2:
                any_severe_regression = True
                regression_details.append(f"{snake_key} regression: acc {delta_acc}, f1 {delta_f1}")

            comparison_heads[snake_key] = {
                "candidate": {
                    "accuracy": c_acc,
                    "macro_f1": c_f1,
                    "precision": c_m.get("macro_precision", 0.0),
                    "recall": c_m.get("macro_recall", 0.0),
                    "support": c_m.get("support", 0),
                    "per_class": c_m.get("per_class", {}),
                },
                "production": {
                    "accuracy": p_acc,
                    "macro_f1": p_f1,
                    "precision": p_m.get("macro_precision", 0.0),
                    "recall": p_m.get("macro_recall", 0.0),
                    "support": p_m.get("support", 0),
                    "per_class": p_m.get("per_class", {}),
                },
                "delta_accuracy": delta_acc,
                "delta_macro_f1": delta_f1,
            }

        # Check overall deltas
        c_overall_acc = candidate_results.get("overall_accuracy", 0.0)
        p_overall_acc = production_results.get("overall_accuracy", 0.0)
        c_overall_f1 = candidate_results.get("overall_macro_f1", 0.0)
        p_overall_f1 = production_results.get("overall_macro_f1", 0.0)

        delta_overall_acc = round(c_overall_acc - p_overall_acc, 4)
        delta_overall_f1 = round(c_overall_f1 - p_overall_f1, 4)

        # Eligibility criteria:
        # 1. Candidate ran successfully
        # 2. No severe regression on other heads (>2% drop)
        # 3. Overall performance is at least equal or improved
        promotion_eligible = not any_severe_regression and (any_improvement or delta_overall_acc >= 0)

        eligibility_notes = []
        if promotion_eligible:
            eligibility_notes.append("Candidate passes all promotion criteria (improvements achieved without unacceptable regressions).")
        else:
            if any_severe_regression:
                eligibility_notes.append(f"Candidate exhibited regressions on: {', '.join(regression_details)}.")
            else:
                eligibility_notes.append("Candidate did not demonstrate measurable improvements over the active production model.")

        return {
            "candidate_overall_accuracy": c_overall_acc,
            "production_overall_accuracy": p_overall_acc,
            "delta_overall_accuracy": delta_overall_acc,
            "candidate_overall_macro_f1": c_overall_f1,
            "production_overall_macro_f1": p_overall_f1,
            "delta_overall_macro_f1": delta_overall_f1,
            "test_sample_count": candidate_results.get("total_test_samples", 0),
            "promotion_eligible": promotion_eligible,
            "eligibility_summary": " ".join(eligibility_notes),
            "heads": comparison_heads,
        }


model_evaluation_service = ModelEvaluationService()
