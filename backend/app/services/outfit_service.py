from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.outfit import Outfit
from app.repositories.outfit_repository import OutfitRepository
from app.repositories.wardrobe_repository import WardrobeRepository
from app.ai.outfit_compatibility import compatibility_engine


class OutfitService:
    def __init__(self, db: Session):
        self.db = db
        self.outfit_repo = OutfitRepository(db)
        self.wardrobe_repo = WardrobeRepository(db)

    def list_outfits(self, user_id: UUID, limit: int = 50, offset: int = 0) -> List[Outfit]:
        return self.outfit_repo.list_for_user(user_id, limit=limit, offset=offset)

    def get_outfit(self, outfit_id: UUID, user_id: UUID) -> Outfit:
        """Fetch one outfit enforcing per-user ownership (403 on other users' outfits)."""
        outfit = self.outfit_repo.get_by_id(outfit_id)
        if not outfit:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found")
        if outfit.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this outfit")
        return outfit

    def create_outfit(
        self,
        user_id: UUID,
        clothing_item_ids: List[UUID],
        name: str,
        description: Optional[str] = None,
        occasion: str = "Casual Daily",
        season: str = "All-Season",
        style: str = "Minimal",
        image_url: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Outfit:
        items = [self.wardrobe_repo.get_by_id(cid) for cid in clothing_item_ids]
        items = [i for i in items if i is not None]

        # Outfits may only reference the creator's own wardrobe items.
        foreign = [i for i in items if i.user_id != user_id]
        if foreign:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Outfits can only include your own wardrobe items",
            )

        # Calculate compatibility score
        eval_res = compatibility_engine.evaluate_compatibility(
            items=items,
            target_occasion=occasion,
            target_season=season,
        )

        return self.outfit_repo.create(
            user_id=user_id,
            clothing_item_ids=[i.id for i in items],
            name=name,
            description=description,
            occasion=occasion,
            season=season,
            style=style,
            compatibility_score=eval_res["overall_score"],
            image_url=image_url or (items[0].image_url if items else None),
            tags=tags or [],
        )

    def update_outfit(self, outfit_id: UUID, user_id: UUID, **kwargs) -> Outfit:
        outfit = self.get_outfit(outfit_id)
        if outfit.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return self.outfit_repo.update(outfit, **kwargs)

    def delete_outfit(self, outfit_id: UUID, user_id: UUID) -> None:
        outfit = self.get_outfit(outfit_id)
        if outfit.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        self.outfit_repo.delete(outfit)

