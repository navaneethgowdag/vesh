from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.wardrobe import ClothingResponse


class UserSummary(BaseModel):
    id: UUID
    username: str
    name: Optional[str] = None
    avatar: Optional[str] = None
    is_verified: bool = False
    is_following: bool = False


class CommentCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


class CommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    user: UserSummary
    text: str
    likes_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class PostCreate(BaseModel):
    caption: str = Field(..., min_length=1, max_length=2000)
    image_url: str
    outfit_id: Optional[UUID] = None
    location: Optional[str] = None
    occasion: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    tagged_item_ids: List[UUID] = Field(default_factory=list)
    is_story: Optional[bool] = False


class StoryCreate(BaseModel):
    image_url: str
    caption: Optional[str] = ""


class PostResponse(BaseModel):
    id: UUID
    user: UserSummary
    caption: str
    image_url: str
    location: Optional[str] = None
    occasion: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    tagged_items: List[ClothingResponse] = Field(default_factory=list)
    likes_count: int = 0
    comments_count: int = 0
    saves_count: int = 0
    is_liked: bool = False
    is_saved: bool = False
    comments: List[CommentResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    cover_image: Optional[str] = None
    is_private: bool = False


class CollectionResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    is_private: bool = False
    item_count: int = 0
    outfit_ids: List[str] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class SavedItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    item_type: str
    item_id: UUID
    collection_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}

