"""
Clothing Review Service.
Handles the pending AI clothing review workflow for personal model learning:
1. Explicitly tracks accepted, corrected, and unconfirmed attributes for all 9 prediction heads.
2. Preserves original AI predictions and confidence scores without overwriting.
3. Tracks confirmed attributes and user corrections separately for training dataset eligibility.
4. Evaluates training eligibility (reviewed, original image exists, not excluded, has confirmed attributes).
5. Supports individual and batch reviews, and per-garment training exclusion toggles.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from fastapi import HTTPException, status

from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.clothing_prediction import ClothingPrediction
from app.models.clothing_correction import ClothingCorrection
from app.models.clothing_image import ClothingImage
from app.services.clothing_prediction_service import prediction_service

HEAD_KEYS = [
    "article_type",
    "master_category",
    "sub_category",
    "gender",
    "base_colour",
    "season",
    "usage",
    "pattern",
    "age_group",
]

HEAD_DISPLAY_NAMES = {
    "article_type": "Article Type",
    "master_category": "Master Category",
    "sub_category": "Subcategory",
    "gender": "Gender",
    "base_colour": "Base Colour",
    "season": "Season",
    "usage": "Occasion / Usage",
    "pattern": "Pattern",
    "age_group": "Age Group",
}


class ClothingReviewService:
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

    def get_review_details(self, db: Session, clothing: Clothing, user_id: UUID) -> Dict[str, Any]:
        """
        Retrieve structured review data including original image reference,
        predicted attributes, confidence scores, current review status, and confirmed attributes.
        """
        analysis = self.get_or_create_analysis(db, clothing)
        fv = analysis.feature_vector or {}

        # 1. Fetch original prediction
        pred_dict = prediction_service.get_prediction(db, clothing, user_id) or {}
        pred_attrs = pred_dict.get("predicted_attributes", {})
        pred_scores = pred_dict.get("prediction_scores", {})
        model_version = pred_dict.get("model_version", "1.0.0")

        # 2. Fetch personal learning data
        pl = fv.get("personal_learning", {})
        confirmed_attrs = pl.get("confirmed_attributes", {})
        attribute_status = pl.get("attribute_review_status", {})
        corrected_attrs = pl.get("corrected_attributes", {})
        review_status = pl.get("review_status", "pending" if clothing.review_required else "reviewed")

        verified_attrs = fv.get("verified_attributes", {})

        # Build per-head detail
        heads_detail = {}
        for head in HEAD_KEYS:
            orig_val = pred_attrs.get(head)
            score_obj = pred_scores.get(head, {})
            score = score_obj.get("confidence") if isinstance(score_obj, dict) else (score_obj if isinstance(score_obj, (int, float)) else 0.5)
            alts = score_obj.get("alternatives", []) if isinstance(score_obj, dict) else []

            current_val = confirmed_attrs.get(head) or verified_attrs.get(head) or orig_val
            head_status = attribute_status.get(head, "accepted" if clothing.is_finalized and not corrected_attrs.get(head) else ("unconfirmed" if clothing.review_required else "accepted"))
            corr_val = corrected_attrs.get(head, {}).get("corrected") if head in corrected_attrs else None

            heads_detail[head] = {
                "key": head,
                "display_name": HEAD_DISPLAY_NAMES.get(head, head.title()),
                "original_prediction": orig_val,
                "confidence": score,
                "review_status": head_status,
                "current_value": current_val,
                "corrected_value": corr_val,
                "alternatives": alts,
            }

        # Check training eligibility
        has_orig_img = False
        if self._has_table(db, "clothing_images"):
            ci = db.query(ClothingImage).filter(
                ClothingImage.clothing_id == clothing.id,
                ClothingImage.image_type == "original",
            ).first()
            if ci and ci.image_data:
                has_orig_img = True
        if not has_orig_img:
            has_orig_img = bool(clothing.image_url) or bool(fv.get("original_data"))

        is_excluded = bool(clothing.exclude_from_training)
        is_final = bool(clothing.is_finalized)
        has_confirmed = bool(confirmed_attrs)

        training_eligible = not is_excluded and is_final and has_orig_img and has_confirmed
        exclusion_reason = None
        if is_excluded:
            exclusion_reason = "Excluded by user from model training"
        elif not is_final:
            exclusion_reason = "Garment has not been accepted or finalized"
        elif not has_orig_img:
            exclusion_reason = "Original image not available in storage"
        elif not has_confirmed:
            exclusion_reason = "No attributes confirmed by reviewer"

        return {
            "clothing_id": str(clothing.id),
            "name": clothing.name,
            "brand": clothing.brand,
            "is_finalized": is_final,
            "review_required": bool(clothing.review_required),
            "review_status": review_status,
            "reviewed_at": pl.get("reviewed_at"),
            "model_version": model_version,
            "exclude_from_training": is_excluded,
            "training_eligible": training_eligible,
            "exclusion_reason": exclusion_reason,
            "original_image_url": f"/api/v1/clothing/{clothing.id}/image/original",
            "preferred_image_url": clothing.preferred_image_url,
            "heads": heads_detail,
            "confirmed_attributes": confirmed_attrs,
            "corrected_attributes": corrected_attrs,
            "vault_attributes": {
                "wear_tier": clothing.wear_tier,
                "is_luxury": clothing.is_luxury,
                "care_type": clothing.care_type,
                "purchase_price": clothing.purchase_price,
                "purchase_date": str(clothing.purchase_date) if clothing.purchase_date else None,
                "wardrobe_groups": clothing.wardrobe_groups,
                "formality": clothing.formality,
            },
        }

    def submit_attribute_review(
        self,
        db: Session,
        clothing: Clothing,
        user_id: UUID,
        attribute_decisions: Dict[str, Any],
        exclude_from_training: Optional[bool] = None,
        finalize: bool = True,
        vault_updates: Optional[Dict[str, Any]] = None,
        garment_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record attribute review decisions for all 9 heads:
        - status: 'accepted' | 'corrected' | 'unconfirmed'
        - value: confirmed value (for corrected) or fallback
        Never overwrites original AI predictions or confidence scores.
        """
        analysis = self.get_or_create_analysis(db, clothing)
        fv = dict(analysis.feature_vector or {})

        # Fetch original predictions
        pred_dict = prediction_service.get_prediction(db, clothing, user_id) or {}
        orig_predicted_attrs = pred_dict.get("predicted_attributes", {})
        orig_confidence_scores = pred_dict.get("prediction_scores", {})
        model_version = pred_dict.get("model_version", "1.0.0")

        # Load existing personal learning state
        pl = dict(fv.get("personal_learning", {}))
        confirmed_attrs = dict(pl.get("confirmed_attributes", {}))
        corrected_attrs = dict(pl.get("corrected_attributes", {}))
        attribute_review_status = dict(pl.get("attribute_review_status", {}))
        verified_attrs = dict(fv.get("verified_attributes", {}))
        user_corrections = list(fv.get("user_corrections", []))

        # Process decisions for each head
        for head, decision in attribute_decisions.items():
            if isinstance(decision, str):
                decision_status = "corrected" if decision != orig_predicted_attrs.get(head) else "accepted"
                decision_val = decision
            elif isinstance(decision, dict):
                decision_status = decision.get("status", "accepted")
                decision_val = decision.get("value")
            else:
                continue

            orig_val = orig_predicted_attrs.get(head)

            if decision_status == "accepted":
                val = orig_val if orig_val is not None else decision_val
                confirmed_attrs[head] = val
                attribute_review_status[head] = "accepted"
                verified_attrs[head] = val

            elif decision_status == "corrected":
                val = decision_val if decision_val is not None else orig_val
                confirmed_attrs[head] = val
                attribute_review_status[head] = "corrected"
                corrected_attrs[head] = {
                    "original": str(orig_val) if orig_val is not None else None,
                    "corrected": str(val),
                }
                verified_attrs[head] = val

                # Record correction in dual-mode tables
                corr_entry = {
                    "id": str(uuid.uuid4()),
                    "clothing_id": str(clothing.id),
                    "user_id": str(user_id),
                    "attribute_name": head,
                    "predicted_value": str(orig_val) if orig_val is not None else None,
                    "corrected_value": str(val),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                user_corrections.append(corr_entry)

                if self._has_table(db, "clothing_corrections"):
                    try:
                        corr_obj = ClothingCorrection(
                            id=uuid.UUID(corr_entry["id"]),
                            clothing_id=clothing.id,
                            user_id=user_id,
                            attribute_name=head,
                            predicted_value=corr_entry["predicted_value"],
                            corrected_value=corr_entry["corrected_value"],
                        )
                        db.add(corr_obj)
                    except Exception:
                        db.rollback()

            elif decision_status == "unconfirmed":
                attribute_review_status[head] = "unconfirmed"
                confirmed_attrs.pop(head, None)
                # Keep verified_attrs or set to None
                if head in verified_attrs and head not in confirmed_attrs:
                    pass

        # Update exclude_from_training if passed
        if exclude_from_training is not None:
            clothing.exclude_from_training = bool(exclude_from_training)
            fv["exclude_from_training"] = bool(exclude_from_training)

        # Update garment name if passed
        if garment_name:
            clothing.name = garment_name.strip()

        # Update Vault attributes if provided
        if vault_updates:
            for vk, vv in vault_updates.items():
                if hasattr(clothing, vk) and vv is not None:
                    setattr(clothing, vk, vv)
                verified_attrs[vk] = vv

        # Synchronize core clothing model columns from confirmed/verified attributes
        if "article_type" in confirmed_attrs:
            from app.ai.fashion_model import fashion_model_service
            at_val = str(confirmed_attrs["article_type"])
            clothing.subcategory = at_val
            m_cat = verified_attrs.get("master_category", "")
            s_cat = verified_attrs.get("sub_category", "")
            clothing.category = fashion_model_service.map_wardrobe_category(at_val, s_cat, m_cat)
        if "base_colour" in confirmed_attrs:
            clothing.color = str(confirmed_attrs["base_colour"])
        if "pattern" in confirmed_attrs:
            clothing.pattern = str(confirmed_attrs["pattern"])
        if "season" in confirmed_attrs:
            clothing.season = str(confirmed_attrs["season"])
        if "usage" in confirmed_attrs:
            clothing.occasion = str(confirmed_attrs["usage"])

        # Check training eligibility
        has_orig_img = False
        if self._has_table(db, "clothing_images"):
            ci = db.query(ClothingImage).filter(
                ClothingImage.clothing_id == clothing.id,
                ClothingImage.image_type == "original",
            ).first()
            if ci and ci.image_data:
                has_orig_img = True
        if not has_orig_img:
            has_orig_img = bool(clothing.image_url) or bool(fv.get("original_data"))

        is_excluded = bool(clothing.exclude_from_training)
        is_final = bool(finalize or clothing.is_finalized)
        has_confirmed = len(confirmed_attrs) > 0

        training_eligible = not is_excluded and is_final and has_orig_img and has_confirmed
        exclusion_reason = None
        if is_excluded:
            exclusion_reason = "Excluded by user from model training"
        elif not is_final:
            exclusion_reason = "Garment has not been accepted or finalized"
        elif not has_orig_img:
            exclusion_reason = "Original image not available in storage"
        elif not has_confirmed:
            exclusion_reason = "No attributes confirmed by reviewer"

        # Update personal_learning payload
        pl.update({
            "ai_predicted_attributes": orig_predicted_attrs,
            "ai_confidence_scores": orig_confidence_scores,
            "confirmed_attributes": confirmed_attrs,
            "corrected_attributes": corrected_attrs,
            "attribute_review_status": attribute_review_status,
            "model_version": model_version,
            "review_status": "reviewed" if is_final else "pending",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "training_eligible": training_eligible,
            "exclusion_reason": exclusion_reason,
        })

        fv["personal_learning"] = pl
        fv["user_corrections"] = user_corrections
        fv["verified_attributes"] = verified_attrs

        if finalize:
            fv["is_finalized"] = True
            fv["review_required"] = False
            fv["processing_status"] = "completed"
            fv["processing_stage"] = "completed"

        analysis.feature_vector = fv
        clothing.updated_at = datetime.now(timezone.utc)
        db.commit()

        return self.get_review_details(db, clothing, user_id)

    def batch_submit_reviews(
        self,
        db: Session,
        user_id: UUID,
        reviews: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Process review submissions for multiple garments.
        Enforces user ownership and validates that each item is processed safely.
        """
        results = []
        for rev in reviews:
            cid_str = rev.get("clothing_id")
            if not cid_str:
                continue
            clothing = db.query(Clothing).filter(Clothing.id == UUID(str(cid_str))).first()
            if not clothing or clothing.user_id != user_id:
                continue

            decisions = rev.get("attribute_decisions", {})
            exclude = rev.get("exclude_from_training")
            finalize = rev.get("finalize", True)
            vault_updates = rev.get("vault_updates")
            name = rev.get("name")

            res = self.submit_attribute_review(
                db=db,
                clothing=clothing,
                user_id=user_id,
                attribute_decisions=decisions,
                exclude_from_training=exclude,
                finalize=finalize,
                vault_updates=vault_updates,
                garment_name=name,
            )
            results.append(res)
        return results

    def toggle_training_eligibility(
        self,
        db: Session,
        clothing: Clothing,
        user_id: UUID,
        exclude_from_training: bool,
    ) -> Dict[str, Any]:
        """Toggle exclude_from_training and re-evaluate eligibility."""
        clothing.exclude_from_training = exclude_from_training
        analysis = self.get_or_create_analysis(db, clothing)
        fv = dict(analysis.feature_vector or {})
        fv["exclude_from_training"] = exclude_from_training

        pl = dict(fv.get("personal_learning", {}))
        pl["exclude_from_training"] = exclude_from_training

        # Re-check training eligibility
        has_orig_img = False
        if self._has_table(db, "clothing_images"):
            has_orig_img = db.query(ClothingImage).filter(
                ClothingImage.clothing_id == clothing.id,
                ClothingImage.image_type == "original",
            ).first() is not None
        else:
            has_orig_img = bool(clothing.image_url)

        is_excluded = exclude_from_training
        is_final = bool(clothing.is_finalized)
        has_confirmed = bool(pl.get("confirmed_attributes"))

        training_eligible = not is_excluded and is_final and has_orig_img and has_confirmed
        exclusion_reason = None
        if is_excluded:
            exclusion_reason = "Excluded by user from model training"
        elif not is_final:
            exclusion_reason = "Garment has not been accepted or finalized"
        elif not has_orig_img:
            exclusion_reason = "Original image not available in storage"
        elif not has_confirmed:
            exclusion_reason = "No attributes confirmed by reviewer"

        pl["training_eligible"] = training_eligible
        pl["exclusion_reason"] = exclusion_reason
        fv["personal_learning"] = pl
        analysis.feature_vector = fv

        clothing.updated_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "clothing_id": str(clothing.id),
            "exclude_from_training": is_excluded,
            "training_eligible": training_eligible,
            "exclusion_reason": exclusion_reason,
        }


clothing_review_service = ClothingReviewService()
