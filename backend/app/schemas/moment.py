from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.social import UserSummary


class MomentCreate(BaseModel):
    image_url: str = Field(..., min_length=1)
    caption: Optional[str] = Field(default="", max_length=1000)
    occasion: Optional[str] = Field(default="Casual Daily", max_length=100)
    tags: List[str] = Field(default_factory=list)


class MomentResponse(BaseModel):
    id: UUID
    user: UserSummary
    image_url: str
    caption: str
    occasion: Optional[str] = "Casual Daily"
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    expires_at: datetime
    time_remaining_seconds: int
    likes_count: int = 0
    is_liked: bool = False

    model_config = {"from_attributes": True}


class MomentActionResponse(BaseModel):
    moment_id: UUID
    action: str  # "liked" or "skipped"
    success: bool = True
