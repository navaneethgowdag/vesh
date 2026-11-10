from datetime import datetime, date
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.outfit import OutfitResponse


class RecommendationExplanation(BaseModel):
    style_match: float = 0.9
    color_match: float = 0.9
    weather_match: float = 0.9
    occasion_match: float = 0.9
    learned_preference_match: float = 0.9
    compatibility: float = 0.9


class RecommendationResponse(BaseModel):
    id: Optional[UUID] = None
    recommendation_id: Optional[UUID] = None
    outfit: Optional[OutfitResponse] = None
    score: float = 0.0
    reasoning: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    reasons: List[str] = Field(default_factory=list)
    worn_status: str = "suggested"
    created_at: Optional[datetime] = None

    # Empty & Partial Outfit states (Rule 4.4a)
    status: str = "active"  # active | no_items | partial_outfit | stale
    empty_reason: Optional[Dict[str, Any]] = None
    missing_slots: Optional[List[str]] = None
    can_wear: bool = True
    filter_counts: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


class RecommendationFeedbackCreate(BaseModel):
    recommendation_id: UUID
    action: str = Field(..., description="Action: view, like, save, wear, reject, skip")
    reason: Optional[str] = Field(default=None, description="Optional feedback reason (e.g. not_my_style, dont_like_colors, too_formal, too_casual, not_suitable_for_occasion)")
    metadata: Optional[Dict[str, Any]] = None


class RecommendationFeedbackResponse(BaseModel):
    id: UUID
    recommendation_id: UUID
    action: str
    reason: Optional[str] = None
    created_at: datetime
    message: str = "Feedback recorded and learned preferences updated successfully"

    model_config = {"from_attributes": True}


class OutfitWearResponse(BaseModel):
    success: bool = True
    outfit_id: UUID
    user_id: UUID
    worn_at: datetime
    wear_count_updated: bool = True
    clothing_items_updated: List[UUID] = Field(default_factory=list)
    message: str = "Outfit marked as worn. Wear history and personalization updated."


class RecommendationGenerateRequest(BaseModel):
    recommendation_mode: Optional[str] = Field(
        default="general",
        description="Mode: 'calendar', 'occasion', or 'general'"
    )
    calendar_event_id: Optional[UUID] = Field(
        default=None,
        description="Optional Calendar Event ID to style for (Path A)"
    )
    occasion: Optional[str] = Field(
        default=None,
        description="Target occasion (e.g. 'Office / Work', 'Casual outing', etc.)"
    )
    custom_occasion: Optional[str] = Field(
        default=None,
        description="Custom occasion text if occasion is 'Custom occasion'"
    )
    target_date: Optional[date] = Field(
        default=None,
        description="Target date for the outfit (default: today)"
    )
    target_time: Optional[str] = Field(
        default=None,
        description="Optional time of day (e.g. 'Morning', '19:00')"
    )
    location_context: Optional[str] = Field(
        default=None,
        description="Optional location (e.g. 'Office HQ', 'Beach resort')"
    )
    dress_code: Optional[str] = Field(
        default=None,
        description="Optional dress code (e.g. 'Smart Casual', 'Black Tie', 'Formal', 'Casual')"
    )
    weather_preference: Optional[str] = Field(
        default="automatic",
        description="'automatic' to use weather API, or 'ignore' to skip weather"
    )
    additional_context: Optional[str] = Field(
        default=None,
        description="Any user notes, styling cues, or context"
    )
    excluded_item_ids: Optional[List[UUID]] = Field(
        default_factory=list,
        description="Garment item IDs to exclude from this recommendation"
    )
    preferred_item_ids: Optional[List[UUID]] = Field(
        default_factory=list,
        description="Garment item IDs to prioritize or include"
    )
    outfit_preference: Optional[str] = Field(
        default="any",
        description="western, indian, fusion, or any"
    )
    formality: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Desired formality level 0.0 to 1.0"
    )
    preferred_colors: Optional[List[str]] = Field(default_factory=list)
    avoided_colors: Optional[List[str]] = Field(default_factory=list)
    specific_clothing_id: Optional[UUID] = None
    force_regenerate: Optional[bool] = Field(
        default=False,
        description="Force generating a new recommendation rather than reusing an active persisted look for today."
    )
    limit: Optional[int] = Field(default=1, ge=1, le=10)


class RecommendationAcceptRequest(BaseModel):
    calendar_event_id: Optional[UUID] = None


class RecommendationAcceptResponse(BaseModel):
    recommendation_id: UUID
    calendar_event_id: UUID
    outfit_id: UUID
    status: str = "accepted"
    message: str = "Recommendation accepted and associated with calendar event"
    recommendation: RecommendationResponse
    calendar_event: Optional[Dict[str, Any]] = None

