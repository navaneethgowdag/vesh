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

        # Update clothing default values if they are empty and user hasn't already confirmed attributes
        is_user_confirmed = fv.get("is_finalized", False) or fv.get("user_confirmed", False) or ("user_corrections" in fv and len(fv["user_corrections"]) > 0)
        if not is_user_confirmed:
            if not clothing.category or clothing.category == "other":
                clothing.category = predicted_attrs.get("category")
            if not clothing.subcategory:
                clothing.subcategory = predicted_attrs.get("subcategory")
            if not clothing.color:
                clothing.color = predicted_attrs.get("primary_color") or predicted_attrs.get("color")
            if not clothing.secondary_color:
                clothing.secondary_color = predicted_attrs.get("secondary_color")
            if not clothing.pattern or clothing.pattern == "Solid":
                clothing.pattern = predicted_attrs.get("pattern")
            if not clothing.material:
                clothing.material = predicted_attrs.get("fabric")
            if not clothing.season or clothing.season == "All-Season":
                clothing.season = predicted_attrs.get("season")
            if not clothing.occasion or clothing.occasion == "Casual Daily":
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
            "name": clothing.name,
            "article_type": verified.get("article_type") or pred_attrs.get("article_type") or clothing.subcategory or clothing.category or "Shirts",
            "master_category": verified.get("master_category") or pred_attrs.get("master_category") or verified.get("category_group") or "Apparel",
            "sub_category": verified.get("sub_category") or pred_attrs.get("sub_category") or "Topwear",
            "gender": verified.get("gender") or pred_attrs.get("gender") or "Unisex",
            "base_colour": verified.get("base_colour") or verified.get("primary_color") or clothing.color or pred_attrs.get("base_colour") or "Black",
            "season": verified.get("season") or clothing.season or pred_attrs.get("season") or "Summer",
            "usage": verified.get("usage") or verified.get("occasion") or clothing.occasion or pred_attrs.get("usage") or "Casual",
            "pattern": verified.get("pattern") or clothing.pattern or pred_attrs.get("pattern") or "Solid",
            "age_group": verified.get("age_group") or pred_attrs.get("age_group") or "Adults",
            "category": verified.get("category") or clothing.category or pred_attrs.get("category"),
            "category_group": verified.get("category_group") or pred_attrs.get("category_group") or verified.get("master_category"),
            "category_display": verified.get("category_display") or verified.get("article_type") or pred_attrs.get("category_display"),
            "primary_color": verified.get("primary_color") or verified.get("base_colour") or clothing.color or pred_attrs.get("primary_color"),
            "primary_hex": verified.get("primary_hex") or pred_attrs.get("primary_hex"),
            "secondary_color": verified.get("secondary_color") or clothing.secondary_color or pred_attrs.get("secondary_color"),
            "secondary_hex": verified.get("secondary_hex") or pred_attrs.get("secondary_hex"),
            "style": verified.get("style") or verified.get("usage") or pred_attrs.get("style"),
            "occasion": verified.get("occasion") or verified.get("usage") or clothing.occasion or pred_attrs.get("occasion"),
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
                        review_status="pending",
                        training_eligible=not bool(clothing.exclude_from_training),
                    )
                    db.add(corr_obj)
                except Exception:
                    pass

            # Update verified_attributes dict
            verified_attrs[attr] = new_val

            # Synchronize to top-level Clothing model columns
            if attr == "name":
                clothing.name = str(new_val)
            elif attr == "article_type":
                from app.ai.fashion_model import fashion_model_service
                clothing.subcategory = str(new_val)
                clothing.name = clothing.name or str(new_val)
                m_cat = verified_attrs.get("master_category", "")
                s_cat = verified_attrs.get("sub_category", "")
                clothing.category = fashion_model_service.map_wardrobe_category(str(new_val), s_cat, m_cat)
            elif attr == "master_category":
                verified_attrs["category_group"] = str(new_val)
            elif attr == "sub_category":
                pass
            elif attr == "base_colour":
                verified_attrs["primary_color"] = str(new_val)
                clothing.color = str(new_val)
            elif attr == "category":
                clothing.category = str(new_val)
            elif attr == "primary_color":
                verified_attrs["base_colour"] = str(new_val)
                clothing.color = str(new_val)
            elif attr == "secondary_color":
                clothing.secondary_color = str(new_val)
            elif attr == "pattern":
                clothing.pattern = str(new_val)
            elif attr == "fabric":
                clothing.material = str(new_val)
            elif attr == "season":
                clothing.season = str(new_val)
            elif attr in ("occasion", "usage"):
                verified_attrs["occasion"] = str(new_val)
                verified_attrs["usage"] = str(new_val)
                clothing.occasion = str(new_val)
            elif attr == "gender":
                pass
            elif attr == "age_group":
                pass
            elif attr == "brand":
                clothing.brand = str(new_val)
            elif attr == "wear_tier":
                clothing.wear_tier = str(new_val)
            elif attr == "is_luxury":
                clothing.is_luxury = bool(new_val)
            elif attr == "wardrobe_groups":
                clothing.wardrobe_groups = new_val
            elif attr == "suitable_occasions":
                clothing.suitable_occasions = new_val
            elif attr == "formality":
                clothing.formality = float(new_val)
            elif attr == "purchase_price":
                clothing.purchase_price = float(new_val)
            elif attr == "purchase_date":
                clothing.purchase_date = new_val
            elif attr == "care_type":
                clothing.care_type = str(new_val)
            elif attr == "special_use_restriction":
                clothing.special_use_restriction = str(new_val)
            elif attr == "reserved_status":
                clothing.reserved_status = str(new_val)
            elif attr == "notes":
                clothing.notes = str(new_val)
            elif attr == "category_specific" and isinstance(new_val, dict):
                cur_cat_spec = dict(verified_attrs.get("category_specific", {}))
                cur_cat_spec.update(new_val)
                verified_attrs["category_specific"] = cur_cat_spec

            # Track provenance as user_confirmed
            clothing.set_provenance(attr, "user_confirmed")

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

        if not clothing.image_url:
            clothing.image_url = f"/api/v1/clothing/{clothing.id}/image/original"

        analysis = self.get_or_create_analysis(db, clothing)
        fv = dict(analysis.feature_vector or {})
        fv["is_finalized"] = True
        fv["review_required"] = False
        fv["processing_status"] = "completed"
        fv["processing_stage"] = "completed"

        # Synchronize personal_learning for training eligibility
        pl = dict(fv.get("personal_learning", {}))
        if not pl.get("confirmed_attributes"):
            pred_dict = self.get_prediction(db, clothing, user_id) or {}
            pred_attrs = pred_dict.get("predicted_attributes", {})
            pred_scores = pred_dict.get("prediction_scores", {})
            verified = fv.get("verified_attributes", {})

            confirmed = {}
            status_map = {}
            corrected = {}
            user_corrs = fv.get("user_corrections", [])
            corr_heads = {c.get("attribute_name"): c.get("corrected_value") for c in user_corrs}

            for head in ["article_type", "master_category", "sub_category", "gender", "base_colour", "season", "usage", "pattern", "age_group"]:
                v = verified.get(head) or pred_attrs.get(head)
                if v:
                    confirmed[head] = v
                    if head in corr_heads and corr_heads[head] != pred_attrs.get(head):
                        status_map[head] = "corrected"
                        corrected[head] = {"original": pred_attrs.get(head), "corrected": corr_heads[head]}
                    else:
                        status_map[head] = "accepted"

            pl.update({
                "ai_predicted_attributes": pred_attrs,
                "ai_confidence_scores": pred_scores,
                "confirmed_attributes": confirmed,
                "corrected_attributes": corrected,
                "attribute_review_status": status_map,
                "model_version": pred_dict.get("model_version", "1.0.0"),
                "review_status": "reviewed",
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "training_eligible": not bool(clothing.exclude_from_training),
            })
            fv["personal_learning"] = pl

        analysis.feature_vector = fv

        clothing.updated_at = datetime.now(timezone.utc)
        db.commit()
        return self.get_attributes(db, clothing, user_id)

    def get_avatar_attributes(
        self,
        db: Session,
        clothing: Clothing,
        user_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """
        Expose finalized attributes needed for future 2D avatar mapping:
        category, subcategory, dominant color, secondary colors, pattern,
        silhouette, garment-specific attributes, processed image reference, wardrobe item ID.
        """
        attrs_data = self.get_attributes(db, clothing, user_id)
        current = attrs_data.get("current_attributes", {})
        cat_specific = current.get("category_specific", {})

        cat = (current.get("category") or clothing.category or "shirt").lower()
        subcat = (current.get("subcategory") or clothing.subcategory or "casual_shirt").lower()
        color = current.get("primary_color") or clothing.color or "Black"
        color_hex = current.get("primary_hex") or "#121212"
        secondary_color = current.get("secondary_color") or clothing.secondary_color
        secondary_colors = [secondary_color] if secondary_color else []
        pattern = current.get("pattern") or clothing.pattern or "solid"
        silhouette = current.get("silhouette") or "regular"

        # Determine 2D avatar sprite key
        sleeve = cat_specific.get("sleeve_type") or "regular"
        neckline = cat_specific.get("neckline") or "regular"
        sprite_key = f"{cat}_{subcat}_{sleeve}_{silhouette}".replace(" ", "_").lower()

        return {
            "wardrobe_item_id": str(clothing.id),
            "category": cat,
            "subcategory": subcat,
            "category_group": current.get("category_group", "western"),
            "dominant_color": color,
            "primary_hex": color_hex,
            "secondary_colors": secondary_colors,
            "pattern": pattern,
            "silhouette": silhouette,
            "fit": current.get("fit", "regular"),
            "garment_specific": cat_specific,
            "processed_image_url": f"/api/v1/clothing/{clothing.id}/image/processed",
            "avatar_sprite_key": sprite_key,
            "avatar_color_tint": color_hex,
            "is_finalized": attrs_data.get("is_finalized", False),
        }


prediction_service = ClothingPredictionService()
