from app.schemas.auth import Token, TokenPayload, LoginRequest, RegisterRequest
from app.schemas.user import (
    UserBase,
    UserResponse,
    UserUpdate,
    UserPreferenceBase,
    UserPreferenceResponse,
    LearnedPreferenceResponse,
)
from app.schemas.wardrobe import ClothingBase, ClothingCreate, ClothingUpdate, ClothingResponse
from app.schemas.clothing_ai import ClothingAnalysisRequest, ClothingAnalysisResponse, ColorInfo
from app.schemas.outfit import OutfitBase, OutfitCreate, OutfitUpdate, OutfitResponse
from app.schemas.recommendation import (
    RecommendationResponse,
    RecommendationFeedbackCreate,
    RecommendationFeedbackResponse,
    RecommendationExplanation,
)
from app.schemas.social import (
    UserSummary,
    PostCreate,
    PostResponse,
    CommentCreate,
    CommentResponse,
    CollectionCreate,
    CollectionResponse,
    SavedItemResponse,
)
from app.schemas.notification import NotificationResponse

__all__ = [
    "Token",
    "TokenPayload",
    "LoginRequest",
    "RegisterRequest",
    "UserBase",
    "UserResponse",
    "UserUpdate",
    "UserPreferenceBase",
    "UserPreferenceResponse",
    "LearnedPreferenceResponse",
    "ClothingBase",
    "ClothingCreate",
    "ClothingUpdate",
    "ClothingResponse",
    "ClothingAnalysisRequest",
    "ClothingAnalysisResponse",
    "ColorInfo",
    "OutfitBase",
    "OutfitCreate",
    "OutfitUpdate",
    "OutfitResponse",
    "RecommendationResponse",
    "RecommendationFeedbackCreate",
    "RecommendationFeedbackResponse",
    "RecommendationExplanation",
    "UserSummary",
    "PostCreate",
    "PostResponse",
    "CommentCreate",
    "CommentResponse",
    "CollectionCreate",
    "CollectionResponse",
    "SavedItemResponse",
    "NotificationResponse",
]

