from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.social import UserSummary, PostResponse
from app.schemas.poll import PollResponse
from app.schemas.community import CommunityResponse


class ExplorePostItem(BaseModel):
    item_type: str  # "post" | "poll" | "community_post"
    post: Optional[PostResponse] = None
    poll: Optional[PollResponse] = None
    community: Optional[CommunityResponse] = None


class ExploreFeedResponse(BaseModel):
    items: List[ExplorePostItem] = Field(default_factory=list)
    has_more: bool = False
    next_cursor: Optional[str] = None


class TrendingPostItem(BaseModel):
    post: PostResponse
    score: float
    rank: int


class TrendingResponse(BaseModel):
    items: List[TrendingPostItem] = Field(default_factory=list)


class RecommendedPerson(BaseModel):
    user: UserSummary
    match_reason: str
    mutual_followers_count: int = 0
    common_styles: List[str] = Field(default_factory=list)


class ExplorePeopleResponse(BaseModel):
    people: List[RecommendedPerson] = Field(default_factory=list)
