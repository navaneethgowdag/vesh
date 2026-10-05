from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.wardrobe import ClothingCreate, ClothingUpdate, ClothingResponse
from app.services.wardrobe_service import WardrobeService
from app.models.user import User

router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])


@router.get("", response_model=List[ClothingResponse])
def get_wardrobe(
    category: Optional[str] = Query(None),
    style: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WardrobeService(db)
    return service.get_wardrobe(
        user_id=current_user.id,
        category=category,
        style=style,
        color=color,
        season=season,
        is_favorite=is_favorite,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ClothingResponse, status_code=status.HTTP_201_CREATED)
def add_clothing_item(
    item_in: ClothingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WardrobeService(db)
    data = item_in.model_dump()
    return service.add_item(user_id=current_user.id, **data)


@router.get("/search", response_model=List[ClothingResponse])
def search_wardrobe(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WardrobeService(db)
    return service.search_items(user_id=current_user.id, query=q)


@router.get("/{item_id}", response_model=ClothingResponse)
def get_clothing_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WardrobeService(db)
    return service.get_item(item_id=item_id, user_id=current_user.id)


@router.patch("/{item_id}", response_model=ClothingResponse)
def update_clothing_item(
    item_id: UUID,
    update_in: ClothingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WardrobeService(db)
    data = update_in.model_dump(exclude_unset=True)
    return service.update_item(item_id=item_id, user_id=current_user.id, **data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clothing_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WardrobeService(db)
    service.delete_item(item_id=item_id, user_id=current_user.id)
    return None

