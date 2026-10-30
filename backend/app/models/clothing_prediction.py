import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class ClothingPrediction(Base):
    __tablename__ = "clothing_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clothing_id = Column(UUID(as_uuid=True), ForeignKey("clothing.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name = Column(String(100), default="clip_vit_b32_quantized", nullable=False)
    model_version = Column(String(50), default="1.0.0", nullable=False)
    input_image_source = Column(String(50), default="processed", nullable=False)  # "processed" or "original"
    predicted_category = Column(String(100), nullable=False)
    category_group = Column(String(50), nullable=True)
    predicted_attributes = Column(JSONB, default=dict, nullable=False)
    prediction_scores = Column(JSONB, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    clothing = relationship("Clothing", back_populates="predictions")
    user = relationship("User")
