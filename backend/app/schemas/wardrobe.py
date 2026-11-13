from datetime import datetime, date
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.schemas.clothing_ai import ClothingAnalysisResponse


class ClothingBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = "Tops"
    subcategory: Optional[str] = None
    color: str = "Black"
    secondary_color: Optional[str] = None
    pattern: Optional[str] = None
    material: Optional[str] = None
    fit: Optional[str] = None
    brand: Optional[str] = None
    size: Optional[str] = None
    season: Optional[str] = "All-Season"
    occasion: Optional[str] = "Casual Daily"
    style_tags: List[str] = Field(default_factory=list)
    image_url: Optional[str] = None
    description: Optional[str] = None

    @field_validator("season", mode="before")
    @classmethod
    def validate_season(cls, v: Any) -> str:
        return str(v).strip() if (v and str(v).strip()) else "All-Season"

    @field_validator("occasion", mode="before")
    @classmethod
    def validate_occasion(cls, v: Any) -> str:
        return str(v).strip() if (v and str(v).strip()) else "Casual Daily"

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, v: Any) -> str:
        return str(v).strip() if (v and str(v).strip()) else "Tops"

    @field_validator("color", mode="before")
    @classmethod
    def validate_color(cls, v: Any) -> str:
        return str(v).strip() if (v and str(v).strip()) else "Black"


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
    # Occasion Vault & Groups
    wear_tier: Optional[str] = None
    is_luxury: Optional[bool] = None
    formality: Optional[float] = None
    wardrobe_groups: Optional[List[str]] = None
    suitable_occasions: Optional[List[str]] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None
    care_type: Optional[str] = None
    special_use_restriction: Optional[str] = None
    reserved_status: Optional[str] = None
    notes: Optional[str] = None


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
    preferred_image_url: Optional[str] = None
    sleeve_type: Optional[str] = None
    neckline: Optional[str] = None
    category_group: Optional[str] = None

    # Laundry & Wear Tracking
    wear_count_since_wash: int = 0
    last_worn_on: Optional[date] = None
    laundry_status: str = "clean"
    laundry_started_on: Optional[date] = None
    available_from: Optional[date] = None
    max_wears_override: Optional[int] = None
    wash_days_override: Optional[int] = None
    track_laundry: bool = True

    # Occasion Vault & Wardrobe Groups
    wear_tier: Optional[str] = "daily"
    is_luxury: Optional[bool] = False
    wardrobe_groups: List[str] = Field(default_factory=lambda: ["daily_work"])
    suitable_occasions: List[str] = Field(default_factory=list)
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None
    care_type: Optional[str] = "machine_wash"
    special_use_restriction: Optional[str] = "none"
    reserved_status: Optional[str] = "available"
    notes: Optional[str] = None
    provenance: Optional[dict] = Field(default_factory=dict)
    cost_per_wear: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ClothingUploadResponse(BaseModel):
    item_id: UUID
    status: str
    stage: str
    original_image_url: str
    status_url: str
    prediction: Optional[dict] = None


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
    name: Optional[str] = None
    category: Optional[str] = None
    category_group: Optional[str] = None
    article_type: Optional[str] = None
    master_category: Optional[str] = None
    sub_category: Optional[str] = None
    base_colour: Optional[str] = None
    gender: Optional[str] = None
    usage: Optional[str] = None
    age_group: Optional[str] = None
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
    # Occasion Vault & Groups
    wear_tier: Optional[str] = None
    is_luxury: Optional[bool] = None
    wardrobe_groups: Optional[List[str]] = None
    suitable_occasions: Optional[List[str]] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None
    care_type: Optional[str] = None
    special_use_restriction: Optional[str] = None
    reserved_status: Optional[str] = None
    notes: Optional[str] = None


class ClothingAttributesResponse(BaseModel):
    clothing_id: str
    is_finalized: bool = False
    current_attributes: dict = Field(default_factory=dict)
    original_prediction: Optional[dict] = None
    corrections_count: int = 0
    corrections: List[dict] = Field(default_factory=list)


class ClothingFinalizeRequest(BaseModel):
    verified_attributes: Optional[dict] = None
    model_config = {"extra": "allow"}


class BulkFinalizeRequest(BaseModel):
    item_ids: List[UUID]


class BulkFinalizeResponse(BaseModel):
    finalized_count: int
    message: str


class ClothingReanalyzeResponse(BaseModel):
    status: str
    message: str
    prediction: dict = Field(default_factory=dict)


class ClothingAvatarAttributesResponse(BaseModel):
    wardrobe_item_id: str
    category: str
    subcategory: str
    category_group: str = "western"
    dominant_color: str
    primary_hex: str
    secondary_colors: List[str] = Field(default_factory=list)
    pattern: str = "solid"
    silhouette: str = "regular"
    fit: str = "regular"
    garment_specific: dict = Field(default_factory=dict)
    processed_image_url: str
    avatar_sprite_key: str
    avatar_color_tint: str
    is_finalized: bool = False


class BatchItemStatus(BaseModel):
    clothing_id: str
    name: str
    sequence_order: int = 0
    status: str
    stage: str
    has_processed: bool = False
    review_required: bool = False
    original_image_url: str
    processed_image_url: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0
    quality: Optional[dict] = None


class BatchUploadResponse(BaseModel):
    batch_id: UUID
    status: str
    total_items: int
    status_url: str


class BatchStatusResponse(BaseModel):
    batch_id: str
    status: str
    total_items: int
    completed_items: int
    failed_items: int
    queued_items: int
    processing_items: int
    remaining_items: int
    progress_percentage: float
    current_processing_item: Optional[dict] = None
    items: List[BatchItemStatus] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# Occasion Vault Schemas
# -----------------------------------------------------------------------------

class VaultSettingsUpdateRequest(BaseModel):
    wear_tier: Optional[str] = None  # 'daily', 'elevated', 'luxury_special'
    is_luxury: Optional[bool] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None
    care_type: Optional[str] = None  # 'machine_wash', 'hand_wash', 'dry_clean_only', 'delicate'
    special_use_restriction: Optional[str] = None  # 'none', 'special_occasions_only', 'custom_occasions_only'
    reserved_status: Optional[str] = None  # 'available', 'reserved', 'in_care'
    suitable_occasions: Optional[List[str]] = None
    wardrobe_groups: Optional[List[str]] = None
    notes: Optional[str] = None


class VaultReserveToggleRequest(BaseModel):
    reserved_status: str = "reserved"  # 'available', 'reserved', 'in_care'
    notes: Optional[str] = None


class VaultEventPrepRequest(BaseModel):
    event_id: Optional[UUID] = None
    occasion: Optional[str] = None
    event_date: Optional[date] = None
    attendee_role: Optional[str] = "guest"  # 'guest', 'close_family', 'wedding_party', 'groom_bride', 'formal_guest', 'traditional_guest'


class VaultEventPrepResponse(BaseModel):
    occasion: str
    event_date: Optional[date] = None
    attendee_role: str = "guest"
    target_formality: float
    eligible_vault_items: List[ClothingResponse] = Field(default_factory=list)
    recommended_combinations: List[dict] = Field(default_factory=list)
    missing_components: List[dict] = Field(default_factory=list)
    care_reminders: List[str] = Field(default_factory=list)
    weather_note: Optional[str] = None
    readiness_status: str  # 'ready', 'partial', 'needs_attention'


class VaultAnalyticsResponse(BaseModel):
    total_vault_items: int
    luxury_items_count: int
    elevated_items_count: int
    reserved_count: int
    in_care_count: int
    most_used_special_items: List[dict] = Field(default_factory=list)
    never_worn_special_items: List[dict] = Field(default_factory=list)
    total_vault_valuation: Optional[float] = None
    items_with_price_count: int
    average_cost_per_wear: Optional[float] = None
    care_type_breakdown: dict = Field(default_factory=dict)



