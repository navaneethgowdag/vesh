from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.clothing import Clothing
from app.repositories.wardrobe_repository import WardrobeRepository


class WardrobeService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = WardrobeRepository(db)

    def get_wardrobe(
        self,
        user_id: UUID,
        category: Optional[str] = None,
        style: Optional[str] = None,
        color: Optional[str] = None,
        season: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Clothing]:
        return self.repo.list_for_user(
            user_id=user_id,
            category=category,
            style=style,
            color=color,
            season=season,
            is_favorite=is_favorite,
            limit=limit,
            offset=offset,
        )

    def get_item(self, item_id: UUID, user_id: UUID) -> Clothing:
        item = self.repo.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
        if item.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this wardrobe item")
        return item

    def add_item(self, user_id: UUID, **data) -> Clothing:
        return self.repo.create(user_id=user_id, **data)

    def update_item(self, item_id: UUID, user_id: UUID, **data) -> Clothing:
        item = self.get_item(item_id, user_id)
        return self.repo.update(item, **data)

    def delete_item(self, item_id: UUID, user_id: UUID) -> None:
        item = self.get_item(item_id, user_id)
        self.repo.delete(item)

    def search_items(self, user_id: UUID, query: str) -> List[Clothing]:
        return self.repo.search(user_id=user_id, query=query)

