from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.social import UserSummary, PostResponse
from app.schemas.poll import PollResponse


class CommunityCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    cover_image_url: Optional[str] = None
    category: str = Field("Fashion", max_length=50)
    rules: Optional[str] = Field(None, max_length=2000)
    visibility: str = Field("public", pattern="^(public|private)$")


class CommunityUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=2000)
    cover_image_url: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    rules: Optional[str] = Field(None, max_length=2000)
    visibility: Optional[str] = Field(None, pattern="^(public|private)$")


class CommunityMemberResponse(BaseModel):
    id: UUID
    community_id: UUID
    user: UserSummary
    role: str  # owner, moderator, member
    status: str  # active, pending, rejected
    joined_at: datetime

    model_config = {"from_attributes": True}


class CommunityResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: str = "Fashion"
    rules: Optional[str] = None
    visibility: str = "public"
    owner: UserSummary
    members_count: int = 1
    is_member: bool = False
    membership_role: Optional[str] = None
    membership_status: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CommunityPostCreate(BaseModel):
    post_id: Optional[UUID] = None
    poll_id: Optional[UUID] = None
    title: Optional[str] = Field(None, max_length=255)
    message: Optional[str] = Field(None, max_length=2000)


class CommunityPostResponse(BaseModel):
    id: UUID
    community_id: UUID
    shared_by: UserSummary
    title: Optional[str] = None
    message: Optional[str] = None
    post: Optional[PostResponse] = None
    poll: Optional[PollResponse] = None
    is_pinned: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class MembershipActionRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|reject|make_moderator|remove_moderator)$")
