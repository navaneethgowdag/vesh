import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


from typing import Optional, Dict, Any

REASON_TO_VALUE = {
    "not_my_style": -2.0,
    "dont_like_colors": -3.0,
    "too_formal": -4.0,
    "too_casual": -5.0,
    "not_suitable_for_occasion": -6.0,
    "prefer_different": -7.0,
    "general": -1.0,
}

VALUE_TO_REASON = {v: k for k, v in REASON_TO_VALUE.items()}


def encode_feedback_reason(reason: Optional[str]) -> Optional[float]:
    if not reason:
        return None
    clean = reason.lower().strip().replace(" ", "_").replace("'", "")
    for k, v in REASON_TO_VALUE.items():
        if k in clean or clean in k:
            return v
    return -1.0


def decode_feedback_reason(val: Optional[float]) -> Optional[str]:
    if val is None:
        return None
    val_round = round(val, 1)
    return VALUE_TO_REASON.get(val_round)


class RecommendationFeedback(Base):
    __tablename__ = "recommendation_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_id = Column(UUID(as_uuid=True), ForeignKey("recommendations.id", ondelete="CASCADE"), nullable=False, index=True)

    action = Column(String(20), nullable=False, index=True)  # view, like, save, wear, reject, skip
    feedback_value = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # API compatibility properties
    @property
    def reason(self) -> Optional[str]:
        if hasattr(self, "_custom_reason") and self._custom_reason:
            return self._custom_reason
        return decode_feedback_reason(self.feedback_value)

    @reason.setter
    def reason(self, value: Optional[str]):
        self._custom_reason = value
        if value:
            self.feedback_value = encode_feedback_reason(value)

    @property
    def metadata_json(self) -> Dict[str, Any]:
        return {
            "reason": self.reason,
            "action": self.action,
            "feedback_value": self.feedback_value,
        }

    # Relationships
    user = relationship("User", back_populates="recommendation_feedback")
    recommendation = relationship("Recommendation", back_populates="feedback")
