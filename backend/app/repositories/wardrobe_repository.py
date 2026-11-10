from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis


class WardrobeRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, item_id: UUID) -> Optional[Clothing]:
        return (
            self.db.query(Clothing)
            .options(joinedload(Clothing.analysis))
            .filter(Clothing.id == item_id)
            .first()
        )

    def list_for_user(
        self,
        user_id: UUID,
        category: Optional[str] = None,
        style: Optional[str] = None,
        color: Optional[str] = None,
        season: Optional[str] = None,
        pattern: Optional[str] = None,
        fabric: Optional[str] = None,
        occasion: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        review_status: Optional[str] = None,
        wardrobe_group: Optional[str] = None,
        wear_tier: Optional[str] = None,
        is_luxury: Optional[bool] = None,
        reserved_status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Clothing]:
        query = (
            self.db.query(Clothing)
            .options(joinedload(Clothing.analysis))
            .filter(Clothing.user_id == user_id)
        )

        if category:
            query = query.filter(or_(Clothing.category.ilike(category), Clothing.subcategory.ilike(category)))
        if style:
            query = query.filter(Clothing.occasion.ilike(f"%{style}%"))
        if color:
            query = query.filter(or_(Clothing.color.ilike(color), Clothing.secondary_color.ilike(color)))
        if season:
            query = query.filter(Clothing.season.ilike(season))
        if pattern:
            query = query.filter(Clothing.pattern.ilike(pattern))
        if fabric:
            query = query.filter(Clothing.material.ilike(fabric))
        if occasion:
            query = query.filter(Clothing.occasion.ilike(occasion))
        if is_favorite is not None:
            query = query.filter(Clothing.is_favorite == is_favorite)

        items = query.order_by(Clothing.created_at.desc()).all()

        if review_status == "pending":
            items = [
                i for i in items
                if not i.is_finalized or i.review_required or i.processing_status in ("predictions_ready", "ready_for_review", "queued", "processing", "failed")
            ]
        elif review_status == "accepted":
            items = [
                i for i in items
                if i.is_finalized and not i.review_required and i.processing_status not in ("predictions_ready", "ready_for_review", "queued", "processing", "failed")
            ]

        # Occasion Vault & Wardrobe Groups Filtering
        if wardrobe_group:
            wg = wardrobe_group.lower().strip()
            items = [i for i in items if wg in [g.lower() for g in getattr(i, "wardrobe_groups", [])]]
        if wear_tier:
            wt = wear_tier.lower().strip()
            items = [i for i in items if getattr(i, "wear_tier", "daily").lower() == wt]
        if is_luxury is not None:
            items = [i for i in items if getattr(i, "is_luxury", False) == is_luxury]
        if reserved_status:
            rs = reserved_status.lower().strip()
            items = [i for i in items if getattr(i, "reserved_status", "available").lower() == rs]

        return items[offset:offset + limit]

    def create(self, user_id: UUID, **kwargs) -> Clothing:
        valid_fields = {
            "name", "category", "subcategory", "color", "secondary_color",
            "pattern", "material", "fit", "brand", "size", "season", "occasion",
            "image_url", "description", "is_favorite", "wear_count"
        }
        vault_fields = {
            "wear_tier", "is_luxury", "purchase_price", "purchase_date",
            "care_type", "special_use_restriction", "reserved_status",
            "notes", "wardrobe_groups", "suitable_occasions", "formality"
        }
        filtered = {k: v for k, v in kwargs.items() if k in valid_fields and v is not None}
        item = Clothing(user_id=user_id, **filtered)
        for key, value in kwargs.items():
            if value is not None and key in vault_fields:
                setattr(item, key, value)
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update(self, item: Clothing, **kwargs) -> Clothing:
        valid_fields = {
            "name", "category", "subcategory", "color", "secondary_color",
            "pattern", "material", "fit", "brand", "size", "season", "occasion",
            "image_url", "description", "is_favorite", "wear_count"
        }
        vault_fields = {
            "wear_tier", "is_luxury", "purchase_price", "purchase_date",
            "care_type", "special_use_restriction", "reserved_status",
            "notes", "wardrobe_groups", "suitable_occasions", "formality"
        }
        for key, value in kwargs.items():
            if value is not None and (key in valid_fields or key in vault_fields):
                setattr(item, key, value)
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete(self, item: Clothing) -> None:
        self.db.delete(item)
        self.db.commit()

    def increment_wear_count(self, item_ids: List[UUID]) -> None:
        if not item_ids:
            return
        items = self.db.query(Clothing).filter(Clothing.id.in_(item_ids)).all()
        for item in items:
            item.wear_count = (item.wear_count or 0) + 1
        self.db.commit()

    def save_analysis(self, clothing_id: UUID, **analysis_data) -> ClothingAnalysis:
        analysis = self.db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing_id).first()
        valid_fields = {
            "detected_category", "detected_subcategory", "detected_colors",
            "detected_pattern", "detected_material", "detected_fit",
            "style_tags", "season_tags", "occasion_tags", "confidence", "feature_vector"
        }
        filtered = {k: v for k, v in analysis_data.items() if k in valid_fields and v is not None}
        if not analysis:
            analysis = ClothingAnalysis(clothing_id=clothing_id, **filtered)
            self.db.add(analysis)
        else:
            for key, value in filtered.items():
                setattr(analysis, key, value)
        self.db.commit()
        self.db.refresh(analysis)
        return analysis

    def search(self, user_id: UUID, query: str) -> List[Clothing]:
        pattern = f"%{query.strip()}%"
        return (
            self.db.query(Clothing)
            .filter(
                Clothing.user_id == user_id,
                or_(
                    Clothing.name.ilike(pattern),
                    Clothing.category.ilike(pattern),
                    Clothing.color.ilike(pattern),
                    Clothing.secondary_color.ilike(pattern),
                    Clothing.pattern.ilike(pattern),
                    Clothing.material.ilike(pattern),
                    Clothing.occasion.ilike(pattern),
                    Clothing.brand.ilike(pattern),
                ),
            )
            .all()
        )
