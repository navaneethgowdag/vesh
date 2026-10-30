from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class UserPreferenceBase(BaseModel):
    styles: List[str] = Field(default_factory=list)
    preferred_styles: List[str] = Field(default_factory=list)
    favorite_colors: List[str] = Field(default_factory=list)
    preferred_colors: List[str] = Field(default_factory=list)
    disliked_colors: List[str] = Field(default_factory=list)
    avoided_colors: List[str] = Field(default_factory=list)
    disliked_styles: List[str] = Field(default_factory=list)
    personalization_enabled: bool = True
    diversity_preference: str = "balanced"
    avoid_recently_worn_days: int = 7
    comfort_priority: float = 0.5
    preferred_categories: List[str] = Field(default_factory=list)
    preferred_fits: List[str] = Field(default_factory=list)
    preferred_patterns: List[str] = Field(default_factory=list)
    preferred_materials: List[str] = Field(default_factory=list)
    preferred_brands: List[str] = Field(default_factory=list)
    favorite_occasions: List[str] = Field(default_factory=list)
    preferred_occasions: List[str] = Field(default_factory=list)
    preferred_seasons: List[str] = Field(default_factory=list)
    fashion_goals: List[str] = Field(default_factory=list)
    climate_preference: Optional[str] = "Moderate"


class UserPreferenceResponse(BaseModel):
    id: UUID
    user_id: UUID
    preferred_styles: List[str] = Field(default_factory=list)
    preferred_colors: List[str] = Field(default_factory=list)
    preferred_categories: List[str] = Field(default_factory=list)
    preferred_fits: List[str] = Field(default_factory=list)
    preferred_patterns: List[str] = Field(default_factory=list)
    preferred_materials: List[str] = Field(default_factory=list)
    preferred_occasions: List[str] = Field(default_factory=list)
    preferred_seasons: List[str] = Field(default_factory=list)
    styles: List[str] = Field(default_factory=list)
    favorite_colors: List[str] = Field(default_factory=list)
    disliked_colors: List[str] = Field(default_factory=list)
    avoided_colors: List[str] = Field(default_factory=list)
    disliked_styles: List[str] = Field(default_factory=list)
    personalization_enabled: bool = True
    diversity_preference: str = "balanced"
    avoid_recently_worn_days: int = 7
    comfort_priority: float = 0.5
    favorite_occasions: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LearnedPreferenceResponse(BaseModel):
    id: UUID
    user_id: UUID
    style_scores: Dict[str, float] = Field(default_factory=dict)
    color_scores: Dict[str, float] = Field(default_factory=dict)
    category_scores: Dict[str, float] = Field(default_factory=dict)
    fit_scores: Dict[str, float] = Field(default_factory=dict)
    pattern_scores: Dict[str, float] = Field(default_factory=dict)
    material_scores: Dict[str, float] = Field(default_factory=dict)
    occasion_scores: Dict[str, float] = Field(default_factory=dict)
    season_scores: Dict[str, float] = Field(default_factory=dict)
    weather_scores: Dict[str, float] = Field(default_factory=dict)
    confidence_score: float = 0.1
    interaction_count: int = 0
    confidence: Optional[float] = None
    total_interactions: Optional[int] = None
    evidence_summary: Optional[Dict[str, Any]] = None
    top_styles: Optional[List[Dict[str, Any]]] = None
    top_colors: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    updated_at: datetime

    def model_post_init(self, __context: Any) -> None:
        if self.confidence is None:
            self.confidence = self.confidence_score
        if self.total_interactions is None:
            self.total_interactions = self.interaction_count

    model_config = {"from_attributes": True}


class PersonalizationResetResponse(BaseModel):
    user_id: UUID
    success: bool = True
    message: str = "Learned personalization preferences have been reset to baseline."
    confidence_score: float = 0.05
    interaction_count: int = 0


class UserBase(BaseModel):
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    location: Optional[str] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    location: Optional[str] = None
    gender: Optional[str] = None
    age_range: Optional[str] = None


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    is_verified: bool
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    wardrobe_count: int = 0
    is_following: Optional[bool] = False
    preferences: Optional[UserPreferenceBase] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserSearchResponse(BaseModel):
    id: UUID
    username: str
    display_name: str
    bio: Optional[str] = ""
    avatar: Optional[str] = None
    is_verified: bool = False
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    is_following: bool = False
    is_me: bool = False

    model_config = {"from_attributes": True}
