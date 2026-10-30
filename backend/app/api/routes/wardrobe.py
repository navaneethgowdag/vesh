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
    pattern: Optional[str] = Query(None),
    fabric: Optional[str] = Query(None),
    occasion: Optional[str] = Query(None),
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
        pattern=pattern,
        fabric=fabric,
        occasion=occasion,
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


# Mount wardrobe aliases for garment image endpoints
from app.api.routes.clothing import (
    upload_clothing_image,
    get_processing_status,
    get_original_image,
    get_processed_image,
    accept_processed_image,
    reject_processed_image,
    retry_processed_image,
)

router.add_api_route("/upload", upload_clothing_image, methods=["POST"], status_code=status.HTTP_202_ACCEPTED)
router.add_api_route("/{item_id}/processing-status", get_processing_status, methods=["GET"])
router.add_api_route("/{item_id}/image/original", get_original_image, methods=["GET"])
router.add_api_route("/{item_id}/image/processed", get_processed_image, methods=["GET"])
router.add_api_route("/{item_id}/image/accept", accept_processed_image, methods=["POST"])
router.add_api_route("/{item_id}/image/reject", reject_processed_image, methods=["POST"])
router.add_api_route("/{item_id}/image/retry", retry_processed_image, methods=["POST"])


