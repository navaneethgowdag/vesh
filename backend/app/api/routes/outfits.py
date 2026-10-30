from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.outfit import OutfitCreate, OutfitUpdate, OutfitResponse
from app.schemas.recommendation import OutfitWearResponse
from app.services.outfit_service import OutfitService
from app.services.recommendation_service import RecommendationService
from app.models.user import User

router = APIRouter(prefix="/outfits", tags=["outfits"])


@router.get("", response_model=List[OutfitResponse])
def list_outfits(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = OutfitService(db)
    return service.list_outfits(user_id=current_user.id, limit=limit, offset=offset)


@router.post("", response_model=OutfitResponse, status_code=status.HTTP_201_CREATED)
def create_outfit(
    outfit_in: OutfitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = OutfitService(db)
    return service.create_outfit(
        user_id=current_user.id,
        clothing_item_ids=outfit_in.clothing_item_ids,
        name=outfit_in.name,
        description=outfit_in.description,
        occasion=outfit_in.occasion,
        season=outfit_in.season,
        style=outfit_in.style,
        image_url=outfit_in.image_url,
        tags=outfit_in.tags,
    )


@router.get("/{outfit_id}", response_model=OutfitResponse)
def get_outfit(
    outfit_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = OutfitService(db)
    return service.get_outfit(outfit_id=outfit_id, user_id=current_user.id)


@router.patch("/{outfit_id}", response_model=OutfitResponse)
def update_outfit(
    outfit_id: UUID,
    update_in: OutfitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = OutfitService(db)
    data = update_in.model_dump(exclude_unset=True)
    return service.update_outfit(outfit_id=outfit_id, user_id=current_user.id, **data)


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outfit(
    outfit_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = OutfitService(db)
    service.delete_outfit(outfit_id=outfit_id, user_id=current_user.id)
    return None


@router.post("/{outfit_id}/wear", response_model=OutfitWearResponse)
def mark_outfit_as_worn(
    outfit_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Phase 4: Mark an outfit as worn.
    Idempotently records wear in wear_history, increments clothing wear counts,
    and updates continuous learning preferences.
    """
    service = RecommendationService(db)
    return service.mark_outfit_as_worn(user_id=current_user.id, outfit_id=outfit_id)

