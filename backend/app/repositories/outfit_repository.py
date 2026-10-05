from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.outfit import Outfit
from app.models.clothing import Clothing


class OutfitRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, outfit_id: UUID) -> Optional[Outfit]:
        return self.db.query(Outfit).filter(Outfit.id == outfit_id).first()

    def list_for_user(self, user_id: UUID, limit: int = 50, offset: int = 0) -> List[Outfit]:
        return (
            self.db.query(Outfit)
            .filter(Outfit.user_id == user_id)
            .order_by(Outfit.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def create(
        self,
        user_id: UUID,
        clothing_item_ids: List[UUID],
        name: str,
        description: Optional[str] = None,
        occasion: Optional[str] = "Casual Daily",
        season: Optional[str] = "All-Season",
        **extra,
    ) -> Outfit:
        items = self.db.query(Clothing).filter(Clothing.id.in_(clothing_item_ids)).all() if clothing_item_ids else []
        outfit = Outfit(
            user_id=user_id,
            name=name,
            description=description,
            occasion=occasion,
            season=season,
        )
        outfit.clothing_items = items
        self.db.add(outfit)
        self.db.commit()
        self.db.refresh(outfit)
        return outfit

    def update(self, outfit: Outfit, clothing_item_ids: Optional[List[UUID]] = None, **kwargs) -> Outfit:
        valid_fields = {"name", "description", "occasion", "season"}
        for key, value in kwargs.items():
            if value is not None and key in valid_fields:
                setattr(outfit, key, value)

        if clothing_item_ids is not None:
            items = self.db.query(Clothing).filter(Clothing.id.in_(clothing_item_ids)).all()
            outfit.clothing_items = items

        self.db.commit()
        self.db.refresh(outfit)
        return outfit

    def delete(self, outfit: Outfit) -> None:
        self.db.delete(outfit)
        self.db.commit()
