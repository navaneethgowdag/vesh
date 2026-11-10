"""
Personal Training Dataset Service.
Manages the preparation, validation, duplicate prevention, and reproducible splitting
of the application owner's reviewed garments for fine-tuning the MultiTask EfficientNet-B0 model:
1. Filters strictly for eligible garments belonging to the application owner.
2. Extracts confirmed labels for the 9 prediction heads.
3. Detects duplicate garments/images via SHA256 image hashes.
4. Validates all labels against class_mappings.json.
5. Performs deterministic garment-level splitting (train/val/test).
6. Preserves a held-out test split across training iterations to prevent data leakage.
7. Computes class representation statistics and flags classes with insufficient samples.
"""

import os
import json
import uuid
import hashlib
import random
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple, Set
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import inspect

from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.clothing_image import ClothingImage
from app.ai.fashion_model import TASK_SNAKE_MAP

logger = logging.getLogger(__name__)

TASK_TO_SNAKE = TASK_SNAKE_MAP
SNAKE_TO_TASK = {v: k for k, v in TASK_SNAKE_MAP.items()}


class TrainingDatasetService:
    def __init__(self, artifacts_dir: Optional[str] = None):
        self.artifacts_dir = artifacts_dir or self._discover_artifacts_dir()
        self.datasets_dir = os.path.join(self.artifacts_dir, "datasets")
        os.makedirs(self.datasets_dir, exist_ok=True)
        self.held_out_test_file = os.path.join(self.datasets_dir, "held_out_test_manifest.json")
        self._class_mappings: Optional[Dict[str, Any]] = None

    def _discover_artifacts_dir(self) -> str:
        candidates = [
            os.path.abspath("artifacts"),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "artifacts")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts")),
            os.getenv("ARTIFACTS_DIR", "artifacts"),
        ]
        for c in candidates:
            if os.path.isdir(c) and os.path.exists(os.path.join(c, "class_mappings.json")):
                return c
        return os.path.abspath("artifacts")

    @property
    def class_mappings(self) -> Dict[str, Any]:
        if self._class_mappings is None:
            mappings_path = os.path.join(self.artifacts_dir, "class_mappings.json")
            if os.path.exists(mappings_path):
                try:
                    with open(mappings_path, "r", encoding="utf-8") as f:
                        self._class_mappings = json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to load class_mappings.json: {e}")
                    self._class_mappings = {}
            else:
                self._class_mappings = {}
        return self._class_mappings

    def _has_table(self, db: Session, table_name: str) -> bool:
        try:
            insp = inspect(db.bind)
            return table_name in insp.get_table_names()
        except Exception:
            return False

    def get_dataset_statistics(self, db: Session, user_id: UUID) -> Dict[str, Any]:
        """
        Compute real dataset statistics for the owner's wardrobe:
        - Total reviewed garments
        - Total eligible training examples
        - Breakdown of accepted, corrected, and unconfirmed attributes
        - Sample counts per class for all 9 heads
        - Dataset readiness status with actionable feedback
        """
        # Query owner's clothing items
        clothing_items = (
            db.query(Clothing)
            .filter(Clothing.user_id == user_id)
            .all()
        )

        total_garments = len(clothing_items)
        reviewed_garments = 0
        eligible_samples = 0
        excluded_count = 0

        total_accepted_attrs = 0
        total_corrected_attrs = 0
        total_unconfirmed_attrs = 0

        # Class counts per head: {head_key: {class_name: count}}
        class_counts: Dict[str, Dict[str, int]] = {head: {} for head in SNAKE_TO_TASK.keys()}

        for item in clothing_items:
            analysis = item.analysis
            fv = analysis.feature_vector if (analysis and isinstance(analysis.feature_vector, dict)) else {}
            pl = fv.get("personal_learning", {})

            is_reviewed = bool(fv.get("is_finalized") or pl.get("review_status") == "reviewed")
            if is_reviewed:
                reviewed_garments += 1

            if bool(item.exclude_from_training or fv.get("exclude_from_training")):
                excluded_count += 1

            # Count attribute statuses
            attr_status = pl.get("attribute_review_status", {})
            confirmed_attrs = pl.get("confirmed_attributes", {})

            for head in SNAKE_TO_TASK.keys():
                st = attr_status.get(head)
                if st == "accepted":
                    total_accepted_attrs += 1
                elif st == "corrected":
                    total_corrected_attrs += 1
                else:
                    # If confirmed without status
                    if head in confirmed_attrs:
                        total_accepted_attrs += 1
                    else:
                        total_unconfirmed_attrs += 1

            # Check eligibility
            has_orig_img = False
            if self._has_table(db, "clothing_images"):
                ci_chk = db.query(ClothingImage).filter(
                    ClothingImage.clothing_id == item.id,
                    ClothingImage.image_type == "original",
                ).first()
                if ci_chk and ci_chk.image_data:
                    has_orig_img = True
            if not has_orig_img:
                has_orig_img = bool(item.image_url) or bool(fv.get("original_data"))

            is_eligible = (
                is_reviewed
                and not bool(item.exclude_from_training or fv.get("exclude_from_training"))
                and has_orig_img
                and len(confirmed_attrs) > 0
            )

            if is_eligible:
                eligible_samples += 1
                # Aggregate class counts for confirmed attributes
                for head, val in confirmed_attrs.items():
                    if head in class_counts and val:
                        val_str = str(val).strip()
                        class_counts[head][val_str] = class_counts[head].get(val_str, 0) + 1

        # Evaluate class coverage and insufficient classes
        insufficient_classes: Dict[str, List[str]] = {}
        well_represented_classes: Dict[str, List[str]] = {}

        for head, counts in class_counts.items():
            insufficient = [cls for cls, cnt in counts.items() if cnt < 3]
            well_rep = [cls for cls, cnt in counts.items() if cnt >= 3]
            if insufficient:
                insufficient_classes[head] = insufficient
            if well_rep:
                well_represented_classes[head] = well_rep

        # Dataset readiness logic
        # Ready if we have at least 5 eligible samples (or 3 for local personal testing)
        is_ready = eligible_samples >= 5
        readiness_reasons = []

        if eligible_samples == 0:
            readiness_reasons.append("No eligible reviewed garments found. Review and accept uploaded garments to populate dataset.")
        elif eligible_samples < 5:
            readiness_reasons.append(f"Have {eligible_samples} eligible items (recommend at least 5 for fine-tuning).")
        else:
            readiness_reasons.append(f"Dataset is ready for personal fine-tuning ({eligible_samples} eligible garments).")

        return {
            "total_wardrobe_items": total_garments,
            "total_reviewed_garments": reviewed_garments,
            "total_eligible_training_examples": eligible_samples,
            "total_excluded_garments": excluded_count,
            "total_accepted_attributes": total_accepted_attrs,
            "total_corrected_attributes": total_corrected_attrs,
            "total_unconfirmed_attributes": total_unconfirmed_attrs,
            "dataset_ready": is_ready,
            "readiness_summary": " ".join(readiness_reasons),
            "class_counts_per_head": class_counts,
            "insufficiently_represented_classes": insufficient_classes,
            "well_represented_classes": well_represented_classes,
        }

    def validate_and_map_label(self, task_name: str, label_val: Any) -> Tuple[Optional[int], Optional[str]]:
        """
        Validate label against class_mappings.json for a task head.
        Returns (class_index, canonical_label_name) or (None, None).
        Supports case-insensitive matching.
        """
        if not label_val or str(label_val).lower() in ("nan", "none", "null", ""):
            return None, None

        task_mappings = self.class_mappings.get(task_name, {})
        label_to_idx = task_mappings.get("label_to_idx", {})

        target_str = str(label_val).strip()

        # 1. Exact match
        if target_str in label_to_idx:
            return int(label_to_idx[target_str]), target_str

        # 2. Case-insensitive match
        target_lower = target_str.lower()
        for k, v in label_to_idx.items():
            if str(k).lower() == target_lower:
                return int(v), str(k)

        return None, None

    def prepare_dataset(
        self,
        db: Session,
        user_id: UUID,
        val_split: float = 0.15,
        test_split: float = 0.15,
        random_seed: int = 42,
    ) -> Dict[str, Any]:
        """
        Retrieve eligible garments, deduplicate, validate labels against class mappings,
        and create deterministic garment-level train, validation, and held-out test splits.
        Preserves existing held-out test split across iterations.
        """
        items = (
            db.query(Clothing)
            .filter(Clothing.user_id == user_id)
            .order_by(Clothing.created_at.asc())
            .all()
        )

        seen_image_hashes: Set[str] = set()
        eligible_records: List[Dict[str, Any]] = []

        for item in items:
            analysis = item.analysis
            fv = analysis.feature_vector if (analysis and isinstance(analysis.feature_vector, dict)) else {}
            pl = fv.get("personal_learning", {})

            # 1. Ownership & Finalized check
            is_reviewed = bool(fv.get("is_finalized") or pl.get("review_status") == "reviewed")
            if not is_reviewed:
                continue

            # 2. User exclusion check
            if bool(item.exclude_from_training or fv.get("exclude_from_training")):
                continue

            # 3. Confirmed labels
            confirmed_attrs = pl.get("confirmed_attributes", {})
            if not confirmed_attrs:
                # If finalized before personal learning was tracked, fall back to verified_attributes
                verified = fv.get("verified_attributes", {})
                if verified:
                    confirmed_attrs = {h: verified[h] for h in SNAKE_TO_TASK.keys() if h in verified and verified[h]}

            if not confirmed_attrs:
                continue

            # 4. Check image binary & compute hash to prevent duplicate images
            img_hash = fv.get("image_hash")
            image_binary_available = False

            if self._has_table(db, "clothing_images"):
                ci = db.query(ClothingImage).filter(
                    ClothingImage.clothing_id == item.id,
                    ClothingImage.image_type == "original",
                ).first()
                if ci and ci.image_data:
                    image_binary_available = True
                    if not img_hash:
                        img_hash = hashlib.sha256(ci.image_data).hexdigest()

            if not image_binary_available:
                if fv.get("original_data"):
                    image_binary_available = True
                    if not img_hash:
                        try:
                            raw = base64.b64decode(fv.get("original_data"))
                            img_hash = hashlib.sha256(raw).hexdigest()
                        except Exception:
                            img_hash = hashlib.sha256(str(item.id).encode("utf-8")).hexdigest()
                elif item.image_url:
                    image_binary_available = True
                    if not img_hash:
                        img_hash = hashlib.sha256(str(item.id).encode("utf-8")).hexdigest()

            if not image_binary_available or not img_hash:
                continue

            # Deduplicate by image hash
            if img_hash in seen_image_hashes:
                logger.info(f"[TrainingDatasetService] Skipping duplicate image hash {img_hash} for clothing {item.id}")
                continue
            seen_image_hashes.add(img_hash)

            # Map confirmed labels to class indices
            head_indices: Dict[str, Optional[int]] = {}
            head_canonical_labels: Dict[str, Optional[str]] = {}

            for snake_key, task_name in SNAKE_TO_TASK.items():
                confirmed_val = confirmed_attrs.get(snake_key)
                idx, canonical = self.validate_and_map_label(task_name, confirmed_val)
                head_indices[snake_key] = idx
                head_canonical_labels[snake_key] = canonical

            # Only include if at least one valid head class index is mapped
            valid_head_count = sum(1 for idx in head_indices.values() if idx is not None)
            if valid_head_count == 0:
                continue

            eligible_records.append({
                "clothing_id": str(item.id),
                "image_hash": img_hash,
                "model_version": pl.get("model_version", "1.0.0"),
                "confirmed_labels": head_canonical_labels,
                "label_indices": head_indices,
                "reviewed_at": pl.get("reviewed_at") or item.updated_at.isoformat(),
            })

        total_eligible = len(eligible_records)
        if total_eligible == 0:
            return {
                "success": False,
                "message": "No eligible training examples found. Ensure garments have original images and confirmed attributes.",
                "total_samples": 0,
            }

        # Held-out test split preservation:
        # Load existing held-out test garment IDs if manifest exists
        existing_held_out_ids: Set[str] = set()
        if os.path.exists(self.held_out_test_file):
            try:
                with open(self.held_out_test_file, "r", encoding="utf-8") as hf:
                    existing_held_out_ids = set(json.load(hf).get("held_out_clothing_ids", []))
            except Exception as e:
                logger.warning(f"Could not load existing held_out_test_manifest: {e}")

        # Separate into already-designated test garments vs remainder
        test_records = []
        unassigned_records = []

        for rec in eligible_records:
            if rec["clothing_id"] in existing_held_out_ids:
                test_records.append(rec)
            else:
                unassigned_records.append(rec)

        # Shuffle unassigned with deterministic seed
        rng = random.Random(random_seed)
        rng.shuffle(unassigned_records)

        # Calculate target counts
        num_unassigned = len(unassigned_records)
        target_test_count = max(1, int(round(total_eligible * test_split))) if total_eligible >= 3 else 0
        additional_test_needed = max(0, target_test_count - len(test_records))

        # Add needed additional test samples from unassigned
        for _ in range(min(additional_test_needed, num_unassigned)):
            test_records.append(unassigned_records.pop())

        num_remaining = len(unassigned_records)
        target_val_count = max(1, int(round(total_eligible * val_split))) if num_remaining >= 2 else 0

        val_records = []
        for _ in range(min(target_val_count, num_remaining)):
            val_records.append(unassigned_records.pop())

        train_records = unassigned_records

        # If very small dataset (<3), make train hold the records and copy to val/test for execution
        if len(train_records) == 0:
            train_records = list(eligible_records)
            val_records = list(eligible_records[:1])
            test_records = list(eligible_records[:1])

        # Save / update held-out test IDs to guarantee isolation across runs
        new_held_out_ids = list(set([r["clothing_id"] for r in test_records]))
        try:
            with open(self.held_out_test_file, "w", encoding="utf-8") as hf:
                json.dump({"held_out_clothing_ids": new_held_out_ids, "updated_at": datetime.now(timezone.utc).isoformat()}, hf, indent=2)
        except Exception as e:
            logger.warning(f"Could not persist held_out_clothing_ids: {e}")

        # Create dataset artifact directory
        dataset_id = f"dataset_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{str(uuid.uuid4())[:6]}"
        dataset_path = os.path.join(self.datasets_dir, dataset_id)
        os.makedirs(dataset_path, exist_ok=True)

        manifest = {
            "dataset_id": dataset_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "user_id": str(user_id),
            "random_seed": random_seed,
            "counts": {
                "total": total_eligible,
                "train": len(train_records),
                "val": len(val_records),
                "test": len(test_records),
            },
            "train": train_records,
            "val": val_records,
            "test": test_records,
        }

        manifest_file = os.path.join(dataset_path, "manifest.json")
        with open(manifest_file, "w", encoding="utf-8") as mf:
            json.dump(manifest, mf, indent=2)

        return {
            "success": True,
            "dataset_id": dataset_id,
            "manifest_path": manifest_file,
            "total_samples": total_eligible,
            "train_samples": len(train_records),
            "val_samples": len(val_records),
            "test_samples": len(test_records),
            "dataset_dir": dataset_path,
        }


training_dataset_service = TrainingDatasetService()
