from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.messaging import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    ShareRequest,
    BlockUserRequest,
)
from app.services.messaging_service import MessagingService

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/conversations", response_model=List[ConversationResponse])
def list_conversations(
    conversation_type: Optional[str] = Query(None, description="direct | group"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    return service.list_user_conversations(
        user_id=current_user.id,
        conversation_type=conversation_type,
        limit=limit,
        offset=offset,
    )


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conv_in: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    if conv_in.conversation_type == "direct":
        if not conv_in.recipient_user_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="recipient_user_id is required for direct chat")
        return service.get_or_create_direct_chat(
            user_id=current_user.id,
            recipient_id=conv_in.recipient_user_id,
        )
    else:
        return service.create_group_chat(
            creator_id=current_user.id,
            participant_ids=conv_in.participant_user_ids,
            title=conv_in.title or "Fashion Circle",
        )


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    return service.get_conversation(
        conversation_id=conversation_id,
        user_id=current_user.id,
    )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def list_messages(
    conversation_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    return service.list_messages(
        conversation_id=conversation_id,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: UUID,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    return service.send_message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        message_type=msg_in.message_type,
        text_content=msg_in.text_content,
        shared_content_type=msg_in.shared_content_type,
        shared_content_id=msg_in.shared_content_id,
    )


@router.post("/conversations/{conversation_id}/read")
def mark_conversation_as_read(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    return service.mark_as_read(
        conversation_id=conversation_id,
        user_id=current_user.id,
    )


@router.post("/share")
def share_content(
    share_in: ShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    return service.share_content(
        user_id=current_user.id,
        target_type=share_in.target_type,
        target_id=share_in.target_id,
        content_type=share_in.content_type,
        content_id=share_in.content_id,
        message=share_in.message,
    )


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    total = service.repo.get_total_unread_count(current_user.id)
    return {"unread_count": total}


@router.post("/block")
def block_user(
    block_in: BlockUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    return service.block_user(
        blocker_id=current_user.id,
        blocked_id=block_in.user_id,
    )


@router.delete("/block/{user_id}")
def unblock_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MessagingService(db)
    return service.unblock_user(
        blocker_id=current_user.id,
        blocked_id=user_id,
    )
