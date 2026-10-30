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
    processing_status: Optional[str] = "completed"
    processing_stage: Optional[str] = "completed"
    review_required: Optional[bool] = False
    is_processed_available: Optional[bool] = False
    processing_duration: Optional[float] = 0.0
    is_finalized: Optional[bool] = False
    formality: Optional[float] = 0.5
    verified_attributes: Optional[dict] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class ClothingUploadResponse(BaseModel):
    item_id: UUID
    status: str
    stage: str
    original_image_url: str
    status_url: str


class ClothingProcessingStatusResponse(BaseModel):
    item_id: UUID
    status: str
    stage: str
    review_required: bool = False
    is_processed_available: bool = False
    duration_seconds: float = 0.0
    error_message: Optional[str] = None
    original_image_url: str
    processed_image_url: Optional[str] = None


class ClothingImageActionResponse(BaseModel):
    status: str
    item_id: UUID
    image_url: str
    message: str


class ClothingPredictionResponse(BaseModel):
    id: Optional[str] = None
    clothing_id: str
    user_id: Optional[str] = None
    model_name: str
    model_version: str
    input_image_source: str
    predicted_category: str
    category_group: Optional[str] = None
    category_score: float = 0.5
    category_alternatives: List[dict] = Field(default_factory=list)
    predicted_attributes: dict = Field(default_factory=dict)
    prediction_scores: dict = Field(default_factory=dict)
    color_palette: List[dict] = Field(default_factory=list)
    created_at: Optional[str] = None


class ClothingAttributesUpdateRequest(BaseModel):
    category: Optional[str] = None
    category_group: Optional[str] = None
    primary_color: Optional[str] = None
    primary_hex: Optional[str] = None
    secondary_color: Optional[str] = None
    secondary_hex: Optional[str] = None
    pattern: Optional[str] = None
    style: Optional[str] = None
    season: Optional[str] = None
    occasion: Optional[str] = None
    formality: Optional[float] = None
    fabric: Optional[str] = None
    brand: Optional[str] = None
    category_specific: Optional[dict] = None


class ClothingAttributesResponse(BaseModel):
    clothing_id: str
    is_finalized: bool = False
    current_attributes: dict = Field(default_factory=dict)
    original_prediction: Optional[dict] = None
    corrections_count: int = 0
    corrections: List[dict] = Field(default_factory=list)


class ClothingFinalizeRequest(BaseModel):
    verified_attributes: Optional[dict] = None


class ClothingReanalyzeResponse(BaseModel):
    status: str
    message: str
    prediction: dict = Field(default_factory=dict)

