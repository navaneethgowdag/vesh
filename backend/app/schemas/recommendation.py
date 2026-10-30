from datetime import datetime
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
    id: UUID
    recommendation_id: Optional[UUID] = None
    outfit: OutfitResponse
    score: float
    reasoning: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    reasons: List[str] = Field(default_factory=list)
    worn_status: str = "suggested"
    created_at: datetime

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
    calendar_event_id: UUID = Field(..., description="Mandatory Calendar Event ID to style for")
    occasion: Optional[str] = None
    outfit_preference: Optional[str] = Field(default="any", description="western, indian, fusion, or any")
    formality: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    preferred_colors: Optional[List[str]] = Field(default_factory=list)
    avoided_colors: Optional[List[str]] = Field(default_factory=list)
    specific_clothing_id: Optional[UUID] = None


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

