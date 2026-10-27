from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_user_optional
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

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    repo = SocialRepository(db)
    success = repo.follow_user(follower_id=current_user.id, following_id=user_id)
    cache_service.invalidate_stories(current_user.id)
    cache_service.invalidate_feed()
    cache_service.invalidate_moments(current_user.id)
    cache_service.invalidate_user_profile(current_user.username)
    cache_service.invalidate_user_profile(target_user.username)

    follower_count = repo.count_followers(user_id)
    following_count = repo.count_following(current_user.id)
    return {
        "following": success,
        "follower_count": follower_count,
        "following_count": following_count,
    }


@router.delete("/follow/{user_id}")
def unfollow_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    repo = SocialRepository(db)
    success = repo.unfollow_user(follower_id=current_user.id, following_id=user_id)
    cache_service.invalidate_stories(current_user.id)
    cache_service.invalidate_feed()
    cache_service.invalidate_moments(current_user.id)
    cache_service.invalidate_user_profile(current_user.username)
    cache_service.invalidate_user_profile(target_user.username)

    follower_count = repo.count_followers(user_id)
    following_count = repo.count_following(current_user.id)
    return {
        "following": not success,
        "follower_count": follower_count,
        "following_count": following_count,
    }


@router.get("/followers/{user_id}", response_model=List[UserSummary])
def get_followers(
    user_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    repo = SocialRepository(db)
    users = repo.list_followers(user_id=user_id, limit=limit, offset=offset)

    following_set = set()
    viewer_id = current_user.id if current_user else None
    if viewer_id:
        following_set = set(repo.get_following_user_ids(viewer_id))

    results = []
    for u in users:
        is_following = u.id in following_set
        is_me = (viewer_id == u.id) if viewer_id else False
        results.append({
            "id": u.id,
            "username": u.username,
            "name": u.display_name or u.username,
            "avatar": u.profile_image_url,
            "is_verified": u.is_verified,
            "is_following": is_following,
            "is_me": is_me,
        })
    return results


@router.get("/following/{user_id}", response_model=List[UserSummary])
def get_following(
    user_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    repo = SocialRepository(db)
    users = repo.list_following(user_id=user_id, limit=limit, offset=offset)

    following_set = set()
    viewer_id = current_user.id if current_user else None
    if viewer_id:
        following_set = set(repo.get_following_user_ids(viewer_id))

    results = []
    for u in users:
        is_following = u.id in following_set
        is_me = (viewer_id == u.id) if viewer_id else False
        results.append({
            "id": u.id,
            "username": u.username,
            "name": u.display_name or u.username,
            "avatar": u.profile_image_url,
            "is_verified": u.is_verified,
            "is_following": is_following,
            "is_me": is_me,
        })
    return results


