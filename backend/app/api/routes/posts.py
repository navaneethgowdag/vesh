from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.schemas.social import PostCreate, PostResponse
from app.services.feed_service import FeedService
from app.models.user import User

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("", response_model=List[PostResponse])
def get_feed(
    feed_type: str = Query("for_you", description="for_you | following"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = FeedService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_feed(current_user_id=viewer_id, limit=limit, offset=offset, feed_type=feed_type)


@router.get("/stories", response_model=List[PostResponse])
def get_stories(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = FeedService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_stories(current_user_id=viewer_id, limit=limit)


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post_in: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FeedService(db)
    return service.create_post(
        user_id=current_user.id,
        caption=post_in.caption,
        image_url=post_in.image_url,
        outfit_id=post_in.outfit_id,
        location=post_in.location,
        occasion=post_in.occasion,
        tags=post_in.tags,
        tagged_item_ids=[str(tid) for tid in post_in.tagged_item_ids],
    )


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = FeedService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_post_by_id(post_id=post_id, current_user_id=viewer_id)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FeedService(db)
    service.delete_post(post_id=post_id, user_id=current_user.id)
    return None


@router.post("/{post_id}/like")
def like_post(
    post_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FeedService(db)
    return service.like_post(post_id=post_id, user_id=current_user.id)


@router.delete("/{post_id}/like")
def unlike_post(
    post_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FeedService(db)
    return service.unlike_post(post_id=post_id, user_id=current_user.id)

