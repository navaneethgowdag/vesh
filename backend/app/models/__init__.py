from app.core.database import Base
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.learned_preference import LearnedPreference
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.clothing_image import ClothingImage
from app.models.clothing_prediction import ClothingPrediction
from app.models.clothing_correction import ClothingCorrection
from app.models.outfit import Outfit, outfit_clothing
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.follow import Follow
from app.models.saved import SavedItem
from app.models.collection import Collection
from app.models.recommendation import Recommendation
from app.models.recommendation_feedback import RecommendationFeedback
from app.models.wear_history import WearHistory
from app.models.notification import Notification
from app.models.calendar_event import CalendarEvent
from app.models.background_job import BackgroundJob

__all__ = [
    "Base",
    "User",
    "UserPreference",
    "LearnedPreference",
    "Clothing",
    "ClothingAnalysis",
    "ClothingImage",
    "ClothingPrediction",
    "ClothingCorrection",
    "Outfit",
    "outfit_clothing",
    "Post",
    "Comment",
    "Like",
    "Follow",
    "SavedItem",
    "Collection",
    "Recommendation",
    "RecommendationFeedback",
    "WearHistory",
    "Notification",
    "CalendarEvent",
    "BackgroundJob",
]
