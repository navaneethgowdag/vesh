from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.community import (
    CommunityCreate,
    CommunityUpdate,
    CommunityResponse,
    CommunityMemberResponse,
    CommunityPostCreate,
    CommunityPostResponse,
    MembershipActionRequest,
)
from app.services.community_service import CommunityService

router = APIRouter(prefix="/communities", tags=["communities"])


@router.post("", response_model=CommunityResponse, status_code=status.HTTP_201_CREATED)
def create_community(
    comm_in: CommunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommunityService(db)
    return service.create_community(
        owner_id=current_user.id,
        name=comm_in.name,
        description=comm_in.description,
        category=comm_in.category,
        rules=comm_in.rules,
        cover_image_url=comm_in.cover_image_url,
        visibility=comm_in.visibility,
    )


@router.get("", response_model=List[CommunityResponse])
def list_communities(
    category: Optional[str] = Query(None),
    visibility: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = CommunityService(db)
    viewer_id = current_user.id if current_user else None
    return service.list_communities(
        category=category,
        visibility=visibility,
        limit=limit,
        offset=offset,
        viewer_id=viewer_id,
    )


@router.get("/{identifier}", response_model=CommunityResponse)
def get_community(
    identifier: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = CommunityService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_community(identifier=identifier, viewer_id=viewer_id)


@router.patch("/{community_id}", response_model=CommunityResponse)
def update_community(
    community_id: UUID,
    comm_in: CommunityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommunityService(db)
    return service.update_community(
        community_id=community_id,
        user_id=current_user.id,
        description=comm_in.description,
        category=comm_in.category,
        rules=comm_in.rules,
        cover_image_url=comm_in.cover_image_url,
        visibility=comm_in.visibility,
    )


@router.post("/{community_id}/join")
def join_community(
    community_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommunityService(db)
    return service.join_community(community_id=community_id, user_id=current_user.id)


@router.post("/{community_id}/leave")
def leave_community(
    community_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommunityService(db)
    return service.leave_community(community_id=community_id, user_id=current_user.id)


@router.get("/{community_id}/members", response_model=List[CommunityMemberResponse])
def list_community_members(
    community_id: UUID,
    status: str = Query("active"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = CommunityService(db)
    viewer_id = current_user.id if current_user else None
    return service.list_members(
        community_id=community_id,
        viewer_id=viewer_id,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.post("/{community_id}/members/{target_user_id}/manage")
def manage_community_member(
    community_id: UUID,
    target_user_id: UUID,
    action_in: MembershipActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommunityService(db)
    return service.manage_member(
        community_id=community_id,
        actor_user_id=current_user.id,
        target_user_id=target_user_id,
        action=action_in.action,
    )


@router.get("/{community_id}/feed", response_model=List[CommunityPostResponse])
def get_community_feed(
    community_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = CommunityService(db)
    viewer_id = current_user.id if current_user else None
    return service.list_community_feed(
        community_id=community_id,
        viewer_id=viewer_id,
        limit=limit,
        offset=offset,
    )


@router.post("/{community_id}/feed", response_model=CommunityPostResponse, status_code=status.HTTP_201_CREATED)
def create_community_post(
    community_id: UUID,
    post_in: CommunityPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommunityService(db)
    return service.create_community_post(
        community_id=community_id,
        user_id=current_user.id,
        post_id=post_in.post_id,
        poll_id=post_in.poll_id,
        title=post_in.title,
        message=post_in.message,
    )


@router.delete("/{community_id}/feed/{post_id}")
def delete_community_post(
    community_id: UUID,
    post_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CommunityService(db)
    success = service.delete_community_post(
        community_id=community_id,
        post_id=post_id,
        user_id=current_user.id,
    )
    return {"success": success}
