from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.recommendation import Recommendation
from app.models.recommendation_feedback import RecommendationFeedback
from app.models.wear_history import WearHistory


class RecommendationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, rec_id: UUID) -> Optional[Recommendation]:
        return self.db.query(Recommendation).filter(Recommendation.id == rec_id).first()

    def create(
        self,
        user_id: UUID,
        outfit_id: Optional[UUID] = None,
        recommendation_score: Optional[float] = 0.9,
        temperature: Optional[float] = None,
        feels_like_temperature: Optional[float] = None,
        humidity: Optional[float] = None,
        weather_condition: Optional[str] = None,
        rain_probability: Optional[float] = None,
        occasion: Optional[str] = None,
        season: Optional[str] = None,
        model_version: str = "deterministic-v1",
        **extra,
    ) -> Recommendation:
        rec = Recommendation(
            user_id=user_id,
            outfit_id=outfit_id,
            recommendation_score=recommendation_score,
            temperature=temperature,
            feels_like_temperature=feels_like_temperature,
            humidity=humidity,
            weather_condition=weather_condition,
            rain_probability=rain_probability,
            occasion=occasion,
            season=season,
            model_version=model_version,
        )
        self.db.add(rec)
        self.db.commit()
        self.db.refresh(rec)
        return rec

    def list_history(self, user_id: UUID, limit: int = 30) -> List[Recommendation]:
        return (
            self.db.query(Recommendation)
            .filter(Recommendation.user_id == user_id)
            .order_by(Recommendation.created_at.desc())
            .limit(limit)
            .all()
        )

    def save_feedback(
        self,
        user_id: UUID,
        recommendation_id: UUID,
        action: str,
        feedback_value: Optional[float] = None,
        **extra,
    ) -> Optional[RecommendationFeedback]:
        try:
            mapped_action = action.lower()
            if mapped_action in ("accept", "scheduled"):
                mapped_action = "save"
            elif mapped_action in ("dismiss", "rejected"):
                mapped_action = "reject"

            feedback = RecommendationFeedback(
                user_id=user_id,
                recommendation_id=recommendation_id,
                action=mapped_action,
                feedback_value=feedback_value,
            )
            self.db.add(feedback)

            # If action is wear, record in wear_history
            rec = self.get_by_id(recommendation_id)
            if rec and mapped_action == "wear":
                wear_entry = WearHistory(
                    user_id=user_id,
                    outfit_id=rec.outfit_id,
                    temperature=rec.temperature,
                    feels_like_temperature=rec.feels_like_temperature,
                    humidity=rec.humidity,
                    weather_condition=rec.weather_condition,
                    rain_probability=rec.rain_probability,
                    occasion=rec.occasion,
                    season=rec.season,
                )
                self.db.add(wear_entry)

            self.db.commit()
            self.db.refresh(feedback)
            return feedback
        except Exception:
            self.db.rollback()
            return None

    def get_feedback_for_user(self, user_id: UUID, limit: int = 100) -> List[RecommendationFeedback]:
        return (
            self.db.query(RecommendationFeedback)
            .filter(RecommendationFeedback.user_id == user_id)
            .order_by(RecommendationFeedback.created_at.desc())
            .limit(limit)
            .all()
        )
