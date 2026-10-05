import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class RecommendationFeedback(Base):
    __tablename__ = "recommendation_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_id = Column(UUID(as_uuid=True), ForeignKey("recommendations.id", ondelete="CASCADE"), nullable=False, index=True)

    action = Column(String(20), nullable=False, index=True)  # view, like, save, wear, reject, skip
    feedback_value = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # API compatibility property
    @property
    def metadata_json(self):
        return {}

    # Relationships
    user = relationship("User", back_populates="recommendation_feedback")
    recommendation = relationship("Recommendation", back_populates="feedback")
