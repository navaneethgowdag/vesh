from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.clothing_ai import ClothingAnalysisResponse


class ClothingBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str
    subcategory: Optional[str] = None
    color: str
    secondary_color: Optional[str] = None
    pattern: Optional[str] = None
    material: Optional[str] = None
    fit: Optional[str] = None
    brand: Optional[str] = None
    size: Optional[str] = None
    season: str = "All-Season"
    occasion: str = "Casual Daily"
    style_tags: List[str] = Field(default_factory=list)
    image_url: Optional[str] = None
    description: Optional[str] = None


class ClothingCreate(ClothingBase):
    pass


class ClothingUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    color: Optional[str] = None
    secondary_color: Optional[str] = None
    pattern: Optional[str] = None
    material: Optional[str] = None
    fit: Optional[str] = None
    brand: Optional[str] = None
    size: Optional[str] = None
    season: Optional[str] = None
    occasion: Optional[str] = None
    style_tags: Optional[List[str]] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    is_favorite: Optional[bool] = None
    wear_count: Optional[int] = None


class ClothingResponse(ClothingBase):
    id: UUID
    user_id: UUID
    is_favorite: bool = False
    wear_count: int = 0
    last_worn: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    analysis: Optional[ClothingAnalysisResponse] = None

    model_config = ConfigDict(from_attributes=True)
