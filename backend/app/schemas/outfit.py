from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from app.schemas.wardrobe import ClothingResponse


class OutfitBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    occasion: Optional[str] = "Casual Daily"
    season: Optional[str] = "All-Season"
    style: Optional[str] = "Minimal"
    image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, v: Any) -> str:
        return str(v).strip() if (v and str(v).strip()) else "Tailored Look"

    @field_validator("occasion", mode="before")
    @classmethod
    def validate_occasion(cls, v: Any) -> str:
        return str(v).strip() if (v and str(v).strip()) else "Casual Daily"

    @field_validator("season", mode="before")
    @classmethod
    def validate_season(cls, v: Any) -> str:
        return str(v).strip() if (v and str(v).strip()) else "All-Season"

    @field_validator("style", mode="before")
    @classmethod
    def validate_style(cls, v: Any) -> str:
        return str(v).strip() if (v and str(v).strip()) else "Minimal"

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(item) for item in v if item]
        return []


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

