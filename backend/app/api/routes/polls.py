from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.poll import (
    PollCreate,
    PollResponse,
    PollVoteRequest,
)
from app.services.poll_service import PollService

router = APIRouter(prefix="/polls", tags=["polls"])


@router.post("", response_model=PollResponse, status_code=status.HTTP_201_CREATED)
def create_poll(
    poll_in: PollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a standalone poll or attach a poll to a post or moment.
    Configurable options (2-6), expiration duration, and voting rules.
    """
    service = PollService(db)
    return service.create_poll(
        creator_user_id=current_user.id,
        poll_in=poll_in,
    )


@router.get("", response_model=List[PollResponse])
def list_polls(
    content_type: Optional[str] = Query(None, description="standalone | post | moment"),
    only_active: bool = Query(False, description="Filter for unexpired polls"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    List polls with optional filtering by content format and active state.
    """
    service = PollService(db)
    viewer_id = current_user.id if current_user else None
    return service.list_polls(
        limit=limit,
        offset=offset,
        content_type=content_type,
        only_active=only_active,
        viewer_id=viewer_id,
    )


@router.get("/{poll_id}", response_model=PollResponse)
def get_poll(
    poll_id: UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get a poll by ID. Respects results visibility settings.
    """
    service = PollService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_poll(poll_id=poll_id, viewer_id=viewer_id)


@router.post("/{poll_id}/vote", response_model=PollResponse)
def vote_on_poll(
    poll_id: UUID,
    vote_in: PollVoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Vote on a poll option.
    - Creator voting prevention by default to ensure unbiased polls.
    - Vote change policy enforced.
    - Closed polls reject new votes.
    """
    service = PollService(db)
    return service.vote_poll(
        poll_id=poll_id,
        option_id=vote_in.option_id,
        user_id=current_user.id,
    )


@router.get("/{poll_id}/results", response_model=PollResponse)
def get_poll_results(
    poll_id: UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get poll results.
    """
    service = PollService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_poll(poll_id=poll_id, viewer_id=viewer_id)


@router.delete("/{poll_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_poll(
    poll_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a poll (creator only).
    """
    service = PollService(db)
    service.delete_poll(poll_id=poll_id, user_id=current_user.id)
    return None
