from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.wardrobe import ClothingResponse


class OutfitBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    occasion: str = "Casual Daily"
    season: str = "All-Season"
    style: str = "Minimal"
    image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class OutfitCreate(OutfitBase):
    clothing_item_ids: List[UUID]


class OutfitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    occasion: Optional[str] = None
    season: Optional[str] = None
    style: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    clothing_item_ids: Optional[List[UUID]] = None


class OutfitResponse(OutfitBase):
    id: UUID
    user_id: UUID
    compatibility_score: float = 0.9
    clothing_items: List[ClothingResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

