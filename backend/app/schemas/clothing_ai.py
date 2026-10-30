from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ColorInfo(BaseModel):
    name: str
    hex: str
    percentage: float


class ClothingAnalysisRequest(BaseModel):
    image_url: Optional[str] = None


class ClothingAnalysisResponse(BaseModel):
    detected_category: Optional[str] = None
    detected_subcategory: Optional[str] = None
    dominant_colors: List[ColorInfo] = Field(default_factory=list)
    secondary_colors: List[str] = Field(default_factory=list)
    pattern: Optional[str] = None
    material: Optional[str] = None
    fit: Optional[str] = None
    style_tags: List[str] = Field(default_factory=list)
    season_tags: List[str] = Field(default_factory=list)
    occasion_tags: List[str] = Field(default_factory=list)
    confidence: Optional[float] = 0.85
    feature_vector: Optional[Any] = None

    model_config = {"from_attributes": True}

