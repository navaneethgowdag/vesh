from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.moment import MomentCreate, MomentResponse, MomentActionResponse
from app.services.moment_service import MomentService

router = APIRouter(prefix="/moments", tags=["moments"])


@router.get("/feed", response_model=List[MomentResponse])
def get_discovery_feed(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get active 24-hour outfit moments for For You discovery.
    Excludes expired moments, own moments, and previously seen/liked/skipped moments.
    """
    service = MomentService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_discovery_feed(current_user_id=viewer_id, limit=limit, offset=offset)


@router.get("/me", response_model=List[MomentResponse])
def get_my_active_moments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the authenticated creator's active (unexpired) 24-hour moments.
    """
    service = MomentService(db)
    return service.get_user_moments(user_id=current_user.id)


@router.post("", response_model=MomentResponse, status_code=status.HTTP_201_CREATED)
def publish_moment(
    moment_in: MomentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Publish a short-lived 24-hour outfit moment for For You discovery.
    Server calculates created_at and expires_at (+24h).
    """
    service = MomentService(db)
    return service.create_moment(
        user_id=current_user.id,
        image_url=moment_in.image_url,
        caption=moment_in.caption,
        occasion=moment_in.occasion,
        tags=moment_in.tags,
    )


@router.delete("/{moment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_moment(
    moment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete own 24-hour outfit moment before expiration.
    """
    service = MomentService(db)
    service.delete_moment(moment_id=moment_id, user_id=current_user.id)
    return None


@router.post("/{moment_id}/like", response_model=MomentActionResponse)
def like_moment(
    moment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Like an outfit moment. Persists like, notifies creator, and marks as seen.
    """
    service = MomentService(db)
    return service.like_moment(moment_id=moment_id, user_id=current_user.id)


@router.post("/{moment_id}/skip", response_model=MomentActionResponse)
def skip_moment(
    moment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Skip an outfit moment. Does not create like or notification; marks as seen.
    """
    service = MomentService(db)
    return service.skip_moment(moment_id=moment_id, user_id=current_user.id)
