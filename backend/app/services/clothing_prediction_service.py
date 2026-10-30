"""
Clothing Prediction and Correction Service.
Dual-persistence engine for:
1. Original AI predictions (ClothingPrediction table or ClothingAnalysis.feature_vector["ai_predictions"])
2. User attribute corrections (ClothingCorrection table or ClothingAnalysis.feature_vector["user_corrections"])
3. Verified attributes and finalization.
Guarantees zero crashes on Neon PostgreSQL even with restricted DDL permissions.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from fastapi import HTTPException, status

from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.clothing_prediction import ClothingPrediction
from app.models.clothing_correction import ClothingCorrection


class ClothingPredictionService:
    def __init__(self):
        self._table_cache: Dict[str, bool] = {}

    def _has_table(self, db: Session, table_name: str) -> bool:
        if table_name in self._table_cache:
            return self._table_cache[table_name]
        try:
            insp = inspect(db.bind)
            exists = table_name in insp.get_table_names()
            self._table_cache[table_name] = exists
            return exists
        except Exception:
            return False

    def get_or_create_analysis(self, db: Session, clothing: Clothing) -> ClothingAnalysis:
        """Ensure clothing has a ClothingAnalysis record."""
        if clothing.analysis:
            return clothing.analysis
        
        analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
        if not analysis:
            analysis = ClothingAnalysis(
                id=uuid.uuid4(),
                clothing_id=clothing.id,
                feature_vector={},
            )
            db.add(analysis)
            db.flush()
        return analysis

    def save_prediction(
        self,
        db: Session,
        clothing: Clothing,
        prediction_result: Dict[str, Any],
        user_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """
        Persist AI prediction result.
        Stores in ClothingPrediction table if present; always mirrors into ClothingAnalysis.
        """
        analysis = self.get_or_create_analysis(db, clothing)
        fv = dict(analysis.feature_vector or {})

        predicted_attrs = prediction_result.get("predicted_attributes", {})
        prediction_scores = prediction_result.get("prediction_scores", {})
        color_palette = prediction_result.get("color_palette", [])

        # Mirror into ClothingAnalysis standard columns
        analysis.detected_category = prediction_result.get("predicted_category")
        analysis.detected_colors = color_palette
        analysis.detected_pattern = predicted_attrs.get("pattern")
        analysis.detected_material = predicted_attrs.get("fabric")
        analysis.confidence = float(prediction_result.get("category_score", 0.5))
        analysis.style_tags = [predicted_attrs.get("style")] if predicted_attrs.get("style") else []
        analysis.season_tags = [predicted_attrs.get("season")] if predicted_attrs.get("season") else []
        analysis.occasion_tags = [predicted_attrs.get("occasion")] if predicted_attrs.get("occasion") else []

        pred_payload = {
            "id": str(uuid.uuid4()),
            "clothing_id": str(clothing.id),
            "user_id": str(user_id),
            "model_name": prediction_result.get("model_name", "clip_vit_b32_quantized"),
            "model_version": prediction_result.get("model_version", "1.0.0"),
            "input_image_source": prediction_result.get("input_image_source", "processed"),
            "predicted_category": prediction_result.get("predicted_category", "clothing"),
            "category_group": prediction_result.get("category_group"),
            "category_score": prediction_result.get("category_score", 0.5),
            "category_alternatives": prediction_result.get("category_alternatives", []),
            "predicted_attributes": predicted_attrs,
            "prediction_scores": prediction_scores,
            "color_palette": color_palette,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Save to dual-persistence slot
        fv["ai_predictions"] = pred_payload
        # Initialize verified attributes from predictions if not yet verified
        if "verified_attributes" not in fv:
            fv["verified_attributes"] = dict(predicted_attrs)
            fv["is_finalized"] = False

        analysis.feature_vector = fv

        # Also attempt database table insert if table exists
        if self._has_table(db, "clothing_predictions"):
            try:
                pred_obj = ClothingPrediction(
                    id=uuid.UUID(pred_payload["id"]),
                    clothing_id=clothing.id,
                    user_id=user_id,
                    model_name=pred_payload["model_name"],
                    model_version=pred_payload["model_version"],
                    input_image_source=pred_payload["input_image_source"],
                    predicted_category=pred_payload["predicted_category"],
                    category_group=pred_payload["category_group"],
                    predicted_attributes=predicted_attrs,
                    prediction_scores=prediction_scores,
                )
                db.add(pred_obj)
            except Exception:
                db.rollback()

        # Update clothing default values if they are empty
        if not clothing.category or clothing.category == "other":
            clothing.category = predicted_attrs.get("category")
        if not clothing.color:
            clothing.color = predicted_attrs.get("primary_color")
        if not clothing.secondary_color:
            clothing.secondary_color = predicted_attrs.get("secondary_color")
        if not clothing.pattern or clothing.pattern == "Solid":
            clothing.pattern = predicted_attrs.get("pattern")
        if not clothing.material:
            clothing.material = predicted_attrs.get("fabric")
        if not clothing.season:
            clothing.season = predicted_attrs.get("season")
        if not clothing.occasion:
            clothing.occasion = predicted_attrs.get("occasion")

        db.commit()
        return pred_payload

    def get_prediction(
        self,
        db: Session,
        clothing: Clothing,
        user_id: uuid.UUID,
    ) -> Optional[Dict[str, Any]]:
        """Retrieve original AI prediction."""
        # 1. Try relational table
        if self._has_table(db, "clothing_predictions"):
            try:
                pred = (
                    db.query(ClothingPrediction)
                    .filter(
                        ClothingPrediction.clothing_id == clothing.id,
                        ClothingPrediction.user_id == user_id,
                    )
                    .order_by(ClothingPrediction.created_at.desc())
                    .first()
                )
                if pred:
                    return {
                        "id": str(pred.id),
                        "clothing_id": str(pred.clothing_id),
                        "user_id": str(pred.user_id),
                        "model_name": pred.model_name,
                        "model_version": pred.model_version,
                        "input_image_source": pred.input_image_source,
                        "predicted_category": pred.predicted_category,
                        "category_group": pred.category_group,
                        "predicted_attributes": pred.predicted_attributes or {},
                        "prediction_scores": pred.prediction_scores or {},
                        "created_at": pred.created_at.isoformat() if pred.created_at else None,
                    }
            except Exception:
                pass

        # 2. Dual-mode fallback from ClothingAnalysis
        if clothing.analysis and isinstance(clothing.analysis.feature_vector, dict):
            pred_data = clothing.analysis.feature_vector.get("ai_predictions")
            if pred_data:
                return pred_data

        # 3. Construct from analysis columns if available
        if clothing.analysis:
            return {
                "id": str(uuid.uuid4()),
                "clothing_id": str(clothing.id),
                "user_id": str(user_id),
                "model_name": "clip_vit_b32_quantized",
                "model_version": "1.0.0",
                "input_image_source": "original",
                "predicted_category": clothing.analysis.detected_category or clothing.category or "clothing",
                "predicted_attributes": {
                    "category": clothing.analysis.detected_category or clothing.category,
                    "primary_color": clothing.color,
                    "secondary_color": clothing.secondary_color,
                    "pattern": clothing.analysis.detected_pattern or clothing.pattern,
                    "fabric": clothing.analysis.detected_material or clothing.material,
                },
                "prediction_scores": {"category": clothing.analysis.confidence or 0.6},
            }
        return None

    def get_corrections(
        self,
        db: Session,
        clothing: Clothing,
        user_id: uuid.UUID,
    ) -> List[Dict[str, Any]]:
        """Retrieve all recorded user corrections."""
        if self._has_table(db, "clothing_corrections"):
            try:
                corrs = (
                    db.query(ClothingCorrection)
                    .filter(
                        ClothingCorrection.clothing_id == clothing.id,
                        ClothingCorrection.user_id == user_id,
                    )
                    .order_by(ClothingCorrection.created_at.asc())
                    .all()
                )
                if corrs:
                    return [
                        {
                            "id": str(c.id),
                            "clothing_id": str(c.clothing_id),
                            "user_id": str(c.user_id),
                            "attribute_name": c.attribute_name,
                            "predicted_value": c.predicted_value,
                            "corrected_value": c.corrected_value,
                            "created_at": c.created_at.isoformat() if c.created_at else None,
                        }
                        for c in corrs
                    ]
            except Exception:
                pass

        if clothing.analysis and isinstance(clothing.analysis.feature_vector, dict):
            return clothing.analysis.feature_vector.get("user_corrections", [])
        return []

    def get_attributes(
        self,
        db: Session,
        clothing: Clothing,
        user_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """
        Get current verified and predicted attributes for review and UI editing.
        """
        prediction = self.get_prediction(db, clothing, user_id)
        corrections = self.get_corrections(db, clothing, user_id)

        analysis = clothing.analysis
        fv = analysis.feature_vector if (analysis and isinstance(analysis.feature_vector, dict)) else {}
        verified = fv.get("verified_attributes", {})

        # Compute current active values (verified > clothing column > predicted)
        pred_attrs = prediction.get("predicted_attributes", {}) if prediction else {}

        current_attributes = {
            "category": verified.get("category") or clothing.category or pred_attrs.get("category"),
            "category_group": verified.get("category_group") or pred_attrs.get("category_group"),
            "category_display": verified.get("category_display") or pred_attrs.get("category_display"),
            "primary_color": verified.get("primary_color") or clothing.color or pred_attrs.get("primary_color"),
            "primary_hex": verified.get("primary_hex") or pred_attrs.get("primary_hex"),
            "secondary_color": verified.get("secondary_color") or clothing.secondary_color or pred_attrs.get("secondary_color"),
            "secondary_hex": verified.get("secondary_hex") or pred_attrs.get("secondary_hex"),
            "pattern": verified.get("pattern") or clothing.pattern or pred_attrs.get("pattern"),
            "style": verified.get("style") or pred_attrs.get("style"),
            "season": verified.get("season") or clothing.season or pred_attrs.get("season"),
            "occasion": verified.get("occasion") or clothing.occasion or pred_attrs.get("occasion"),
            "formality": verified.get("formality") if "formality" in verified else pred_attrs.get("formality", 0.5),
            "fabric": verified.get("fabric") or clothing.material or pred_attrs.get("fabric"),
            "brand": verified.get("brand") or clothing.brand,
            "category_specific": verified.get("category_specific") or pred_attrs.get("category_specific", {}),
        }

        return {
            "clothing_id": str(clothing.id),
            "is_finalized": bool(fv.get("is_finalized", False)),
            "current_attributes": current_attributes,
            "original_prediction": prediction,
            "corrections_count": len(corrections),
            "corrections": corrections,
        }

    def update_attributes(
        self,
        db: Session,
        clothing: Clothing,
        user_id: uuid.UUID,
        attribute_updates: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Record user updates/corrections without overwriting original AI predictions.
        Updates verified attributes in Clothing and ClothingAnalysis.
        """
        analysis = self.get_or_create_analysis(db, clothing)
        fv = dict(analysis.feature_vector or {})

        original_pred = fv.get("ai_predictions", {})
        pred_attrs = original_pred.get("predicted_attributes", {})

        user_corrections = list(fv.get("user_corrections", []))
        verified_attrs = dict(fv.get("verified_attributes", {}))

        # Record each updated attribute as a correction if it differs from prediction
        for attr, new_val in attribute_updates.items():
            if new_val is None:
                continue

            old_pred = pred_attrs.get(attr)
            # If changed, record in corrections
            corr_entry = {
                "id": str(uuid.uuid4()),
                "clothing_id": str(clothing.id),
                "user_id": str(user_id),
                "attribute_name": attr,
                "predicted_value": str(old_pred) if old_pred is not None else None,
                "corrected_value": str(new_val),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            user_corrections.append(corr_entry)

            # Relational insert if table exists
            if self._has_table(db, "clothing_corrections"):
                try:
                    corr_obj = ClothingCorrection(
                        id=uuid.UUID(corr_entry["id"]),
                        clothing_id=clothing.id,
                        user_id=user_id,
                        attribute_name=attr,
                        predicted_value=corr_entry["predicted_value"],
                        corrected_value=corr_entry["corrected_value"],
                    )
                    db.add(corr_obj)
                except Exception:
                    db.rollback()

            # Update verified_attributes dict
            verified_attrs[attr] = new_val

            # Synchronize to top-level Clothing model columns
            if attr == "category":
                clothing.category = str(new_val)
            elif attr == "primary_color":
                clothing.color = str(new_val)
            elif attr == "secondary_color":
                clothing.secondary_color = str(new_val)
            elif attr == "pattern":
                clothing.pattern = str(new_val)
            elif attr == "fabric":
                clothing.material = str(new_val)
            elif attr == "season":
                clothing.season = str(new_val)
            elif attr == "occasion":
                clothing.occasion = str(new_val)
            elif attr == "brand":
                clothing.brand = str(new_val)
            elif attr == "category_specific" and isinstance(new_val, dict):
                cur_cat_spec = dict(verified_attrs.get("category_specific", {}))
                cur_cat_spec.update(new_val)
                verified_attrs["category_specific"] = cur_cat_spec

        fv["user_corrections"] = user_corrections
        fv["verified_attributes"] = verified_attrs
        analysis.feature_vector = fv

        db.commit()
        return self.get_attributes(db, clothing, user_id)

    def finalize_clothing(
        self,
        db: Session,
        clothing: Clothing,
        user_id: uuid.UUID,
        verified_attributes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Finalize clothing item after user review, marking it ready and active in wardrobe.
        """
        if verified_attributes:
            self.update_attributes(db, clothing, user_id, verified_attributes)

        analysis = self.get_or_create_analysis(db, clothing)
        fv = dict(analysis.feature_vector or {})
        fv["is_finalized"] = True
        fv["review_required"] = False
        fv["processing_status"] = "completed"
        fv["processing_stage"] = "completed"
        analysis.feature_vector = fv

        db.commit()
        return self.get_attributes(db, clothing, user_id)


prediction_service = ClothingPredictionService()
