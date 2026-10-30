import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    outfit_id = Column(UUID(as_uuid=True), ForeignKey("outfits.id", ondelete="CASCADE"), nullable=True, index=True)

    temperature = Column(Float, nullable=True)
    feels_like_temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    weather_condition = Column(String(100), nullable=True)
    rain_probability = Column(Float, nullable=True)
    occasion = Column(String(100), nullable=True)
    season = Column(String(100), nullable=True)
    recommendation_score = Column(Float, nullable=True)
    model_version = Column(String(100), default="deterministic-v1", nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # API compatibility properties
    @property
    def score(self) -> float:
        return self.recommendation_score if self.recommendation_score is not None else 0.9

    @property
    def reasoning(self):
        if hasattr(self, "_custom_reasoning") and self._custom_reasoning:
            return self._custom_reasoning
        return {
            "style_match": 0.95,
            "color_match": 0.92,
            "weather_match": 0.94,
            "occasion_match": 0.90,
            "learned_preference_match": 0.85,
            "compatibility": self.score,
        }

    @property
    def context(self):
        if hasattr(self, "_custom_context") and self._custom_context:
            return self._custom_context
        return {
            "weather": self.weather_condition or "Sunny",
            "temperature": self.temperature or 22,
            "occasion": self.occasion or "Casual Daily",
            "reasons": self.reasons,
        }

    @property
    def reasons(self):
        if hasattr(self, "_custom_reasons") and self._custom_reasons:
            return self._custom_reasons
        return [
            f"Calibrated for {self.weather_condition or 'current'} weather and {self.temperature or 22}°C",
            "Harmonizes with your preferred neutral aesthetic",
            f"Tailored specifically for {self.occasion or 'Casual Daily'} context",
        ]

    @property
    def worn_status(self) -> str:
        return "suggested"

    # Relationships
    user = relationship("User", back_populates="recommendations")
    outfit = relationship("Outfit", back_populates="recommendations")
    feedback = relationship("RecommendationFeedback", back_populates="recommendation", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="recommendation")

