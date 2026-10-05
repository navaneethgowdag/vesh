from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.social import CollectionCreate, CollectionResponse, SavedItemResponse
from app.repositories.social_repository import SocialRepository
from app.models.user import User

router = APIRouter(prefix="/saved", tags=["saved"])


@router.get("", response_model=List[SavedItemResponse])
def get_saved_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SocialRepository(db)
    items = repo.list_saved_items(user_id=current_user.id)
    return items


@router.post("", response_model=SavedItemResponse, status_code=status.HTTP_201_CREATED)
def save_item(
    item_type: str = Query("post", description="post or outfit"),
    item_id: UUID = Query(...),
    collection_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SocialRepository(db)
    saved = repo.save_item(
        user_id=current_user.id,
        post_id=item_id,
    )
    return saved


@router.delete("/{saved_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_item(
    saved_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SocialRepository(db)
    repo.delete_saved_by_id(saved_id=saved_id, user_id=current_user.id)
    return None


@router.delete("/by-item/{item_type}/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_item_by_item(
    item_type: str,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unsave by the referenced post id."""
    repo = SocialRepository(db)
    repo.unsave_item(user_id=current_user.id, post_id=item_id)
    return None


@router.get("/collections", response_model=List[CollectionResponse])
def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SocialRepository(db)
    cols = repo.list_collections(user_id=current_user.id)
    results = []
    for c in cols:
        results.append({
            "id": c.id,
            "user_id": c.user_id,
            "name": c.name,
            "description": c.description,
            "cover_image": None,
            "is_private": False,
            "item_count": 0,
            "outfit_ids": [],
            "created_at": c.created_at,
        })
    return results


@router.post("/collections", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
def create_collection(
    collection_in: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SocialRepository(db)
    col = repo.create_collection(
        user_id=current_user.id,
        name=collection_in.name,
        description=collection_in.description,
    )
    return {
        "id": col.id,
        "user_id": col.user_id,
        "name": col.name,
        "description": col.description,
        "cover_image": None,
        "is_private": False,
        "item_count": 0,
        "outfit_ids": [],
        "created_at": col.created_at,
    }
