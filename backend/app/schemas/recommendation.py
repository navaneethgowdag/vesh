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
    metadata: Optional[Dict[str, Any]] = None


class RecommendationFeedbackResponse(BaseModel):
    id: UUID
    recommendation_id: UUID
    action: str
    created_at: datetime
    message: str = "Feedback recorded and learned preferences updated successfully"

    model_config = {"from_attributes": True}

