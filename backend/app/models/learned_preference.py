import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


def _empty_dict():
    return {}


class LearnedPreference(Base):
    """Derived per-user preference profile learned from behavioral signals.

    IMPORTANT: this is derived state. The raw behavioral source of truth lives in
    ``wear_history``, ``recommendations``, ``recommendation_feedback``, ``likes``,
    ``saved`` and ``posts``. This table caches aggregated scores.
    """

    __tablename__ = "learned_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Preference scores bounded [-1.0, 1.0] mapped by key
    style_scores = Column(JSONB, default=_empty_dict, nullable=False)
    color_scores = Column(JSONB, default=_empty_dict, nullable=False)
    category_scores = Column(JSONB, default=_empty_dict, nullable=False)
    fit_scores = Column(JSONB, default=_empty_dict, nullable=False)
    pattern_scores = Column(JSONB, default=_empty_dict, nullable=False)
    material_scores = Column(JSONB, default=_empty_dict, nullable=False)
    occasion_scores = Column(JSONB, default=_empty_dict, nullable=False)
    season_scores = Column(JSONB, default=_empty_dict, nullable=False)
    weather_scores = Column(JSONB, default=_empty_dict, nullable=False)

    # API compatibility properties (unpersisted)
    @property
    def brand_scores(self):
        return {}

    @property
    def combination_scores(self):
        return {}

    # Learned scalars
    confidence_score = Column(Float, default=0.1, nullable=False)  # 0.0 to 1.0
    interaction_count = Column(Integer, default=0, nullable=False)

    @property
    def confidence(self):
        return self.confidence_score

    @confidence.setter
    def confidence(self, val):
        self.confidence_score = val

    @property
    def total_interactions(self):
        return self.interaction_count

    @total_interactions.setter
    def total_interactions(self, val):
        self.interaction_count = val

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="learned_preference")
