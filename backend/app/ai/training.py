from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.recommendation_feedback import RecommendationFeedback
from app.ai.model_manager import model_manager


def train_recommendation_model_from_feedback(db: Session) -> Dict[str, Any]:
    """
    Query recommendation feedbacks and train a model if enough data is available.
    """
    feedbacks = db.query(RecommendationFeedback).all()
    if len(feedbacks) < 50:
        return {
            "status": "insufficient_data",
            "samples": len(feedbacks),
            "message": "At least 50 feedback interactions are required to trigger ML training.",
        }

    # If >= 50 feedbacks, can train a scikit-learn classifier
    return {
        "status": "ready_for_training",
        "samples": len(feedbacks),
    }

