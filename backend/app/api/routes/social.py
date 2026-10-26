from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.social import UserSummary
from app.repositories.social_repository import SocialRepository
from app.services.cache_service import cache_service
from app.models.user import User

router = APIRouter(prefix="/social", tags=["social"])


@router.post("/follow/{user_id}")
def follow_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot follow yourself",
        )
    repo = SocialRepository(db)
    success = repo.follow_user(follower_id=current_user.id, following_id=user_id)
    cache_service.invalidate_stories(current_user.id)
    cache_service.invalidate_feed()
    return {"following": success}


@router.delete("/follow/{user_id}")
def unfollow_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SocialRepository(db)
    success = repo.unfollow_user(follower_id=current_user.id, following_id=user_id)
    cache_service.invalidate_stories(current_user.id)
    cache_service.invalidate_feed()
    return {"following": not success}


@router.get("/followers/{user_id}", response_model=List[UserSummary])
def get_followers(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SocialRepository(db)
    users = repo.list_followers(user_id=user_id)
    results = []
    for u in users:
        is_following = repo.is_following(current_user.id, u.id)
        results.append({
            "id": u.id,
            "username": u.username,
            "name": u.display_name or u.username,
            "avatar": u.profile_image_url,
            "is_verified": u.is_verified,
            "is_following": is_following,
        })
    return results


@router.get("/following/{user_id}", response_model=List[UserSummary])
def get_following(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SocialRepository(db)
    users = repo.list_following(user_id=user_id)
    results = []
    for u in users:
        is_following = repo.is_following(current_user.id, u.id)
        results.append({
            "id": u.id,
            "username": u.username,
            "name": u.display_name or u.username,
            "avatar": u.profile_image_url,
            "is_verified": u.is_verified,
            "is_following": is_following,
        })
    return results

