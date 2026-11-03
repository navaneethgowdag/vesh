from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


class PollOptionCreate(BaseModel):
    option_text: str = Field(..., min_length=1, max_length=200)


class PollOptionResponse(BaseModel):
    id: UUID
    poll_id: Optional[UUID] = None
    option_text: str
    display_order: int = 0
    vote_count: Optional[int] = None
    percentage: Optional[float] = None

    model_config = {"from_attributes": True}


class PollCreate(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    options: List[str] = Field(..., min_length=2, max_length=6)
    duration_hours: Optional[int] = Field(default=24, ge=1, le=720)  # up to 30 days
    expires_at: Optional[datetime] = None
    allow_vote_change: bool = False
    show_results_before_vote: bool = False
    allow_creator_vote: bool = False
    content_type: str = Field(default="standalone", pattern="^(standalone|post|moment)$")
    post_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validate_options(self):
        cleaned = [opt.strip() for opt in self.options if opt and opt.strip()]
        if len(cleaned) < 2:
            raise ValueError("Poll must have at least 2 non-empty options")
        if len(cleaned) > 6:
            raise ValueError("Poll cannot have more than 6 options")
        self.options = cleaned
        return self


class PollVoteRequest(BaseModel):
    option_id: UUID


class PollVoteResponse(BaseModel):
    poll_id: UUID
    option_id: UUID
    user_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class PollCreatorSummary(BaseModel):
    id: UUID
    username: str
    name: Optional[str] = None
    avatar: Optional[str] = None
    is_verified: bool = False

    model_config = {"from_attributes": True}


class PollResponse(BaseModel):
    id: UUID
    creator_user_id: UUID
    question: str
    content_type: str
    parent_post_id: Optional[UUID] = None
    parent_moment_id: Optional[UUID] = None
    post_id: Optional[UUID] = None
    expires_at: datetime
    is_expired: bool
    time_remaining_seconds: int
    allow_vote_change: bool
    show_results_before_vote: bool
    allow_creator_vote: bool
    total_votes: Optional[int] = None
    has_voted: bool = False
    user_voted_option_id: Optional[UUID] = None
    options: List[PollOptionResponse] = Field(default_factory=list)
    created_at: datetime
    creator: Optional[PollCreatorSummary] = None

    model_config = {"from_attributes": True}
