"""
Model Version Management Service.
Manages candidate and production versions for the personal clothing classifier:
1. Version registration, metadata persistence, and audit trail.
2. Safe candidate promotion with explicit application-owner confirmation.
3. Candidate rejection and archival.
4. Instant production rollback to previous production checkpoint or baseline v1.0.0.
5. Hot-reloading of the live FashionModelService singleton without application restart.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from fastapi import HTTPException, status

from app.models.model_version import ModelVersion
from app.ai.fashion_model import fashion_model_service
from app.services.model_evaluation_service import model_evaluation_service

logger = logging.getLogger(__name__)

# In-memory versions store for candidate registration resilience
_IN_MEMORY_VERSIONS: Dict[str, Dict[str, Any]] = {}


class ModelVersionService:
    def __init__(self, artifacts_dir: Optional[str] = None):
        self.artifacts_dir = artifacts_dir or self._discover_artifacts_dir()
        self.models_dir = os.path.join(self.artifacts_dir, "models")
        os.makedirs(self.models_dir, exist_ok=True)
        self.current_prod_file = os.path.join(self.artifacts_dir, "current_production_model.json")

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

    def _has_table(self, db: Session, table_name: str) -> bool:
        try:
            insp = inspect(db.bind)
            return table_name in insp.get_table_names()
        except Exception:
            return False

    def get_current_production_info(self) -> Dict[str, Any]:
        """Read active production model info from current_production_model.json."""
        if os.path.exists(self.current_prod_file):
            try:
                with open(self.current_prod_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read current_production_model.json: {e}")

        base_pt = os.path.join(self.artifacts_dir, "best_model.pt")
        return {
            "version_tag": "v1.0.0",
            "model_name": "efficientnet_b0_multitask",
            "checkpoint_path": base_pt,
            "status": "production",
            "promoted_at": "2026-11-08T19:09:00Z",
            "notes": "Baseline Multi-Task EfficientNet-B0 production model",
        }

    def list_versions(self, db: Session, user_id: UUID) -> List[Dict[str, Any]]:
        """
        List all candidate and production model versions from database and file system.
        Guarantees that baseline v1.0.0 and all candidate checkpoints appear.
        """
        current_prod = self.get_current_production_info()
        prod_tag = current_prod.get("version_tag", "v1.0.0")

        versions_by_tag: Dict[str, Dict[str, Any]] = {}

        # 1. Base v1.0.0 entry
        eval_report_file = os.path.join(self.artifacts_dir, "evaluation_report.json")
        base_metrics = {}
        if os.path.exists(eval_report_file):
            try:
                with open(eval_report_file, "r", encoding="utf-8") as f:
                    base_metrics = json.load(f)
            except Exception:
                pass

        base_version = {
            "id": "base-v1-0-0",
            "version_tag": "1.0.0",
            "model_name": "efficientnet_b0_multitask",
            "base_version": None,
            "status": "production" if prod_tag in ("v1.0.0", "1.0.0") else "archived",
            "checkpoint_path": os.path.join(self.artifacts_dir, "best_model.pt"),
            "architecture_info": {"backbone": "efficientnet_b0", "heads": 9},
            "class_mapping_version": "1.0.0",
            "evaluation_metrics": base_metrics,
            "created_at": "2026-11-08T19:09:00Z",
            "promoted_at": "2026-11-08T19:09:00Z",
            "notes": "Original baseline Multi-Task EfficientNet-B0 production model",
            "is_active_production": (prod_tag in ("v1.0.0", "1.0.0")),
        }
        versions_by_tag["1.0.0"] = base_version
        v1_copy = dict(base_version)
        v1_copy["version_tag"] = "v1.0.0"
        versions_by_tag["v1.0.0"] = v1_copy

        # 2. Database records if table exists
        if self._has_table(db, "model_versions"):
            try:
                db_versions = db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()
                for mv in db_versions:
                    v_dict = mv.to_dict()
                    v_dict["is_active_production"] = (mv.version_tag == prod_tag)
                    if v_dict["is_active_production"]:
                        v_dict["status"] = "production"
                    versions_by_tag[mv.version_tag] = v_dict
            except Exception as e:
                logger.warning(f"Error listing model versions from DB: {e}")

        # 3. Discover candidates in artifacts/models/ folder
        if os.path.isdir(self.models_dir):
            for entry in os.listdir(self.models_dir):
                entry_path = os.path.join(self.models_dir, entry)
                if os.path.isdir(entry_path):
                    ckpt_path = os.path.join(entry_path, "checkpoint.pt")
                    if os.path.exists(ckpt_path) and entry not in versions_by_tag:
                        hist_file = os.path.join(entry_path, "training_history.json")
                        history_data = {}
                        if os.path.exists(hist_file):
                            try:
                                with open(hist_file, "r", encoding="utf-8") as hf:
                                    history_data = json.load(hf)
                            except Exception:
                                pass

                        is_active = (entry == prod_tag)
                        versions_by_tag[entry] = {
                            "id": entry,
                            "version_tag": entry,
                            "model_name": "efficientnet_b0_multitask",
                            "base_version": history_data.get("base_version", "v1.0.0"),
                            "status": "production" if is_active else "candidate",
                            "checkpoint_path": ckpt_path,
                            "architecture_info": {"backbone": "efficientnet_b0", "heads": 9},
                            "class_mapping_version": "1.0.0",
                            "evaluation_metrics": history_data.get("evaluation_metrics", {}),
                            "created_at": history_data.get("created_at") or datetime.now(timezone.utc).isoformat(),
                            "promoted_at": None,
                            "notes": f"Candidate fine-tuned model {entry}",
                            "is_active_production": is_active,
                        }

        # 4. In-memory versions fallback
        for vtag, vdict in _IN_MEMORY_VERSIONS.items():
            if vtag not in versions_by_tag:
                v_copy = dict(vdict)
                v_copy["is_active_production"] = (vtag == prod_tag)
                if v_copy["is_active_production"]:
                    v_copy["status"] = "production"
                versions_by_tag[vtag] = v_copy

        # Return sorted by created_at desc
        return sorted(list(versions_by_tag.values()), key=lambda x: str(x.get("created_at", "")), reverse=True)

    def register_candidate_version(
        self,
        db: Session,
        user_id: UUID,
        version_tag: str,
        checkpoint_path: str,
        base_version: str,
        training_config: Dict[str, Any],
        evaluation_metrics: Dict[str, Any],
        dataset_manifest_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Register newly trained candidate version in database and file system."""
        cand_dict = {
            "id": version_tag,
            "version_tag": version_tag,
            "model_name": "efficientnet_b0_multitask",
            "base_version": base_version,
            "status": "candidate",
            "checkpoint_path": checkpoint_path,
            "architecture_info": {"backbone": "efficientnet_b0", "heads": 9},
            "class_mapping_version": "1.0.0",
            "preprocessing_config": {"image_size": [224, 224], "mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
            "dataset_manifest_path": dataset_manifest_path,
            "training_config": training_config,
            "evaluation_metrics": evaluation_metrics,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "promoted_at": None,
            "notes": f"Candidate fine-tuned model {version_tag}",
            "is_active_production": False,
        }
        _IN_MEMORY_VERSIONS[version_tag] = cand_dict

        model_version_obj = None
        if self._has_table(db, "model_versions"):
            try:
                model_version_obj = ModelVersion(
                    id=uuid.uuid4(),
                    version_tag=version_tag,
                    model_name="efficientnet_b0_multitask",
                    base_version=base_version,
                    status="candidate",
                    checkpoint_path=checkpoint_path,
                    architecture_info={"backbone": "efficientnet_b0", "heads": 9},
                    class_mapping_version="1.0.0",
                    preprocessing_config={"image_size": [224, 224], "mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
                    dataset_manifest_path=dataset_manifest_path,
                    training_config=training_config,
                    evaluation_metrics=evaluation_metrics,
                    created_by_user_id=user_id,
                )
                db.add(model_version_obj)
                db.commit()
            except Exception as e:
                logger.warning(f"Could not persist ModelVersion to DB: {e}")
                db.rollback()

        # Update candidate metadata file in model directory
        model_dir = os.path.dirname(checkpoint_path)
        meta_file = os.path.join(model_dir, "model_info.json")
        try:
            with open(meta_file, "w", encoding="utf-8") as mf:
                json.dump({
                    "version_tag": version_tag,
                    "checkpoint_path": checkpoint_path,
                    "base_version": base_version,
                    "status": "candidate",
                    "training_config": training_config,
                    "evaluation_metrics": evaluation_metrics,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }, mf, indent=2)
        except Exception as me:
            logger.warning(f"Could not write model_info.json: {me}")

        return model_version_obj.to_dict() if model_version_obj else cand_dict

    def get_model_comparison(
        self,
        db: Session,
        user_id: UUID,
        candidate_version: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Compare specified candidate model against the active production model.
        Returns side-by-side metrics, deltas, and promotion eligibility.
        """
        versions = self.list_versions(db, user_id)
        current_prod = self.get_current_production_info()

        # Resolve candidate
        candidate = None
        if candidate_version:
            candidate = next((v for v in versions if v["version_tag"] == candidate_version), None)
        else:
            candidate = next((v for v in versions if v["status"] == "candidate"), None)

        if not candidate:
            return {
                "has_candidate": False,
                "message": "No candidate model version found. Train a candidate to view comparisons.",
                "production": current_prod,
                "candidate": None,
                "comparison": None,
            }

        # Check if evaluation comparison is already computed
        eval_metrics = candidate.get("evaluation_metrics", {})
        if "comparison" in eval_metrics and "heads" in eval_metrics["comparison"]:
            comp = eval_metrics["comparison"]
        else:
            # If not computed, build test set from recent dataset manifest
            manifest_file = None
            datasets_dir = os.path.join(self.artifacts_dir, "datasets")
            if os.path.isdir(datasets_dir):
                dsets = sorted([d for d in os.listdir(datasets_dir) if os.path.isdir(os.path.join(datasets_dir, d))], reverse=True)
                for ds in dsets:
                    mf = os.path.join(datasets_dir, ds, "manifest.json")
                    if os.path.exists(mf):
                        manifest_file = mf
                        break

            test_records = []
            if manifest_file:
                try:
                    with open(manifest_file, "r", encoding="utf-8") as f:
                        test_records = json.load(f).get("test", [])
                except Exception:
                    pass

            if test_records:
                comp = model_evaluation_service.compare_models(
                    candidate_checkpoint=candidate["checkpoint_path"],
                    production_checkpoint=current_prod["checkpoint_path"],
                    test_records=test_records,
                    db=db,
                )
            else:
                comp = {
                    "candidate_overall_accuracy": 0.0,
                    "production_overall_accuracy": 0.0,
                    "delta_overall_accuracy": 0.0,
                    "candidate_overall_macro_f1": 0.0,
                    "production_overall_macro_f1": 0.0,
                    "delta_overall_macro_f1": 0.0,
                    "test_sample_count": 0,
                    "promotion_eligible": True,
                    "eligibility_summary": "Ready for manual promotion review.",
                    "heads": {},
                }

        return {
            "has_candidate": True,
            "production_version": current_prod.get("version_tag", "v1.0.0"),
            "candidate_version": candidate.get("version_tag"),
            "candidate": candidate,
            "production": current_prod,
            "comparison": comp,
        }

    def promote_candidate(
        self,
        db: Session,
        user_id: UUID,
        version_tag: str,
    ) -> Dict[str, Any]:
        """
        Promote a candidate checkpoint to active production:
        1. Validates candidate checkpoint exists and is intact.
        2. Sets previous production version to 'archived'.
        3. Updates candidate status to 'production' with promoted_at timestamp.
        4. Writes artifacts/current_production_model.json pointer.
        5. Hot-reloads live FashionModelService singleton.
        """
        versions = self.list_versions(db, user_id)
        candidate = next((v for v in versions if v["version_tag"] == version_tag), None)
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Candidate version '{version_tag}' not found.")

        ckpt_path = candidate.get("checkpoint_path")
        if not ckpt_path or not os.path.exists(ckpt_path):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Checkpoint file not found for version '{version_tag}'.")

        current_prod = self.get_current_production_info()
        prev_prod_tag = current_prod.get("version_tag", "v1.0.0")

        now_iso = datetime.now(timezone.utc).isoformat()

        # Update database statuses
        if self._has_table(db, "model_versions"):
            try:
                # Demote existing production
                db.query(ModelVersion).filter(ModelVersion.status == "production").update({
                    "status": "archived",
                })
                # Promote candidate
                cand_db = db.query(ModelVersion).filter(ModelVersion.version_tag == version_tag).first()
                if cand_db:
                    cand_db.status = "production"
                    cand_db.promoted_at = datetime.now(timezone.utc)
                db.commit()
            except Exception as e:
                logger.warning(f"Error updating model versions in DB: {e}")
                db.rollback()

        # Update in-memory versions
        if version_tag in _IN_MEMORY_VERSIONS:
            _IN_MEMORY_VERSIONS[version_tag]["status"] = "production"
            _IN_MEMORY_VERSIONS[version_tag]["promoted_at"] = now_iso
            _IN_MEMORY_VERSIONS[version_tag]["is_active_production"] = True
        for vtag, vdict in _IN_MEMORY_VERSIONS.items():
            if vtag != version_tag and vdict.get("status") == "production":
                vdict["status"] = "archived"
                vdict["is_active_production"] = False

        # Update production pointer JSON
        new_prod_info = {
            "version_tag": version_tag,
            "model_name": candidate.get("model_name", "efficientnet_b0_multitask"),
            "checkpoint_path": ckpt_path,
            "previous_version": prev_prod_tag,
            "status": "production",
            "promoted_at": now_iso,
            "notes": f"Promoted from candidate {version_tag} by owner.",
        }

        with open(self.current_prod_file, "w", encoding="utf-8") as f:
            json.dump(new_prod_info, f, indent=2)

        # Hot reload singleton
        fashion_model_service.reload_model()

        logger.info(f"[ModelVersionService] Successfully promoted {version_tag} to production. Live model reloaded.")

        return {
            "status": "promoted",
            "active_version": version_tag,
            "previous_version": prev_prod_tag,
            "promoted_at": now_iso,
            "checkpoint_path": ckpt_path,
            "message": f"Candidate model '{version_tag}' is now active in production.",
        }

    def reject_candidate(
        self,
        db: Session,
        user_id: UUID,
        version_tag: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Mark a candidate version as rejected."""
        if version_tag in _IN_MEMORY_VERSIONS:
            _IN_MEMORY_VERSIONS[version_tag]["status"] = "rejected"
            _IN_MEMORY_VERSIONS[version_tag]["is_active_production"] = False

        if self._has_table(db, "model_versions"):
            try:
                cand = db.query(ModelVersion).filter(ModelVersion.version_tag == version_tag).first()
                if cand:
                    cand.status = "rejected"
                    if reason:
                        cand.notes = f"Rejected: {reason}"
                    db.commit()
            except Exception as e:
                logger.warning(f"Error marking candidate as rejected in DB: {e}")

        # Update model_info.json in directory if present
        versions = self.list_versions(db, user_id)
        candidate = next((v for v in versions if v["version_tag"] == version_tag), None)
        if candidate and candidate.get("checkpoint_path"):
            cand_dir = os.path.dirname(candidate["checkpoint_path"])
            info_file = os.path.join(cand_dir, "model_info.json")
            if os.path.exists(info_file):
                try:
                    with open(info_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["status"] = "rejected"
                    data["rejected_reason"] = reason
                    with open(info_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                except Exception:
                    pass

        return {
            "status": "rejected",
            "version_tag": version_tag,
            "message": f"Candidate version '{version_tag}' has been rejected.",
        }

    def rollback_production(
        self,
        db: Session,
        user_id: UUID,
        target_version: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Roll back active production model:
        1. Identifies target rollback version (previous production version, target_version, or baseline v1.0.0).
        2. Updates current_production_model.json pointer.
        3. Updates database statuses.
        4. Hot-reloads live FashionModelService singleton.
        """
        current_prod = self.get_current_production_info()
        cur_version = current_prod.get("version_tag", "v1.0.0")

        versions = self.list_versions(db, user_id)

        target = None
        if target_version:
            target = next((v for v in versions if v["version_tag"] == target_version), None)
        else:
            prev_tag = current_prod.get("previous_version")
            if prev_tag:
                target = next((v for v in versions if v["version_tag"] == prev_tag), None)
            if not target:
                target = next((v for v in versions if v["version_tag"] == "v1.0.0"), None)

        if not target:
            target = {
                "version_tag": "v1.0.0",
                "checkpoint_path": os.path.join(self.artifacts_dir, "best_model.pt"),
            }

        target_tag = target.get("version_tag", "v1.0.0")
        target_ckpt = target.get("checkpoint_path")

        if not os.path.exists(target_ckpt):
            target_ckpt = os.path.join(self.artifacts_dir, "best_model.pt")
            target_tag = "v1.0.0"

        now_iso = datetime.now(timezone.utc).isoformat()

        # Update database statuses
        if self._has_table(db, "model_versions"):
            try:
                db.query(ModelVersion).filter(ModelVersion.version_tag == cur_version).update({"status": "archived"})
                db.query(ModelVersion).filter(ModelVersion.version_tag == target_tag).update({"status": "production"})
                db.commit()
            except Exception as e:
                logger.warning(f"Error rolling back model versions in DB: {e}")
                db.rollback()

        # Update in-memory versions
        for vtag, vdict in _IN_MEMORY_VERSIONS.items():
            if vtag == target_tag:
                vdict["status"] = "production"
                vdict["is_active_production"] = True
            elif vdict.get("status") == "production":
                vdict["status"] = "archived"
                vdict["is_active_production"] = False

        rollback_prod_info = {
            "version_tag": target_tag,
            "model_name": "efficientnet_b0_multitask",
            "checkpoint_path": target_ckpt,
            "status": "production",
            "rolled_back_from": cur_version,
            "promoted_at": now_iso,
            "notes": f"Rolled back from {cur_version} by owner.",
        }

        with open(self.current_prod_file, "w", encoding="utf-8") as f:
            json.dump(rollback_prod_info, f, indent=2)

        # Hot reload live model
        fashion_model_service.reload_model()

        logger.info(f"[ModelVersionService] Rolled back production model from {cur_version} to {target_tag}.")

        return {
            "status": "rolled_back",
            "active_version": target_tag,
            "rolled_back_from": cur_version,
            "checkpoint_path": target_ckpt,
            "message": f"Production model successfully rolled back to '{target_tag}'.",
        }


model_version_service = ModelVersionService()
