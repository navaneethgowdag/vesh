from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.social import UserSummary


class SharedContentPreview(BaseModel):
    content_type: str  # post, poll, community
    id: UUID
    title_or_caption: Optional[str] = None
    image_url: Optional[str] = None
    author_name: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class MessageCreate(BaseModel):
    message_type: str = Field("text", pattern="^(text|post_share|poll_share|community_share)$")
    text_content: Optional[str] = Field(None, max_length=5000)
    shared_content_type: Optional[str] = None
    shared_content_id: Optional[UUID] = None


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender: UserSummary
    message_type: str
    text_content: Optional[str] = None
    shared_content: Optional[SharedContentPreview] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ParticipantResponse(BaseModel):
    id: UUID
    user: UserSummary
    role: str
    joined_at: datetime
    last_read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    conversation_type: str = Field("direct", pattern="^(direct|group)$")
    recipient_user_id: Optional[UUID] = None
    participant_user_ids: List[UUID] = Field(default_factory=list)
    title: Optional[str] = Field(None, max_length=100)


class ConversationResponse(BaseModel):
    id: UUID
    conversation_type: str
    title: Optional[str] = None
    image_url: Optional[str] = None
    participants: List[ParticipantResponse] = Field(default_factory=list)
    other_participant: Optional[UserSummary] = None
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    updated_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ShareRequest(BaseModel):
    target_type: str = Field(..., pattern="^(conversation|community)$")
    target_id: UUID
    content_type: str = Field(..., pattern="^(post|poll|community)$")
    content_id: UUID
    message: Optional[str] = Field(None, max_length=1000)


class BlockUserRequest(BaseModel):
    user_id: UUID
