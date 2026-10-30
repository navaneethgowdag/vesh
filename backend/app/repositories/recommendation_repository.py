from datetime import datetime, date, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import cast, Date
from app.models.recommendation import Recommendation
from app.models.recommendation_feedback import RecommendationFeedback, encode_feedback_reason
from app.models.wear_history import WearHistory
from app.models.outfit import Outfit, outfit_clothing
from app.models.clothing import Clothing


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
        reason: Optional[str] = None,
        feedback_value: Optional[float] = None,
        **extra,
    ) -> Optional[RecommendationFeedback]:
        try:
            mapped_action = action.lower()
            if mapped_action in ("accept", "scheduled"):
                mapped_action = "save"
            elif mapped_action in ("dismiss", "rejected"):
                mapped_action = "reject"

            # Compute feedback_value from reason if provided
            if reason and feedback_value is None:
                feedback_value = encode_feedback_reason(reason)

            # Deduplication: check if same feedback was submitted within recent 5 minutes
            five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
            existing = (
                self.db.query(RecommendationFeedback)
                .filter(
                    RecommendationFeedback.user_id == user_id,
                    RecommendationFeedback.recommendation_id == recommendation_id,
                    RecommendationFeedback.action == mapped_action,
                    RecommendationFeedback.created_at >= five_mins_ago,
                )
                .first()
            )
            if existing:
                if reason and not existing.feedback_value:
                    existing.feedback_value = feedback_value
                    self.db.commit()
                    self.db.refresh(existing)
                return existing

            feedback = RecommendationFeedback(
                user_id=user_id,
                recommendation_id=recommendation_id,
                action=mapped_action,
                feedback_value=feedback_value,
            )
            self.db.add(feedback)

            # If action is wear, record wear event idempotently
            rec = self.get_by_id(recommendation_id)
            if rec and rec.outfit_id and mapped_action == "wear":
                self.record_wear(
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

            self.db.commit()
            self.db.refresh(feedback)
            return feedback
        except Exception:
            self.db.rollback()
            return None

    def record_wear(
        self,
        user_id: UUID,
        outfit_id: UUID,
        temperature: Optional[float] = None,
        feels_like_temperature: Optional[float] = None,
        humidity: Optional[float] = None,
        weather_condition: Optional[str] = None,
        rain_probability: Optional[float] = None,
        occasion: Optional[str] = None,
        season: Optional[str] = None,
        user_rating: Optional[int] = None,
    ) -> Optional[WearHistory]:
        """
        Records an outfit wear event in Neon PostgreSQL.
        Prevents duplicate wear events submitted on the same calendar date.
        Increments wear_count on individual clothing pieces.
        """
        try:
            today_date = date.today()
            # Idempotency check: duplicate wear on same day
            existing_today = (
                self.db.query(WearHistory)
                .filter(
                    WearHistory.user_id == user_id,
                    WearHistory.outfit_id == outfit_id,
                    cast(WearHistory.worn_at, Date) == today_date,
                )
                .first()
            )
            if existing_today:
                existing_today._is_new = False
                return existing_today

            wear_entry = WearHistory(
                user_id=user_id,
                outfit_id=outfit_id,
                worn_at=datetime.now(timezone.utc),
                temperature=temperature,
                feels_like_temperature=feels_like_temperature,
                humidity=humidity,
                weather_condition=weather_condition,
                rain_probability=rain_probability,
                occasion=occasion,
                season=season,
                user_rating=user_rating,
            )
            self.db.add(wear_entry)

            # Increment wear_count on each individual clothing item in this outfit
            outfit = self.db.query(Outfit).filter(Outfit.id == outfit_id).first()
            if outfit and outfit.clothing_items:
                for item in outfit.clothing_items:
                    item.wear_count = (item.wear_count or 0) + 1
                    item.updated_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(wear_entry)
            wear_entry._is_new = True
            return wear_entry
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

    def get_wear_history(self, user_id: UUID, limit: int = 50) -> List[WearHistory]:
        return (
            self.db.query(WearHistory)
            .filter(WearHistory.user_id == user_id)
            .order_by(WearHistory.worn_at.desc())
            .limit(limit)
            .all()
        )
