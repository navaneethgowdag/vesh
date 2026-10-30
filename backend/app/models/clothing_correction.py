import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ClothingCorrection(Base):
    __tablename__ = "clothing_corrections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clothing_id = Column(UUID(as_uuid=True), ForeignKey("clothing.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attribute_name = Column(String(100), nullable=False)
    predicted_value = Column(Text, nullable=True)
    corrected_value = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    clothing = relationship("Clothing", back_populates="corrections")
    user = relationship("User")
