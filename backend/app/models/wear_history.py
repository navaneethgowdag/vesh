import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class WearHistory(Base):
    __tablename__ = "wear_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    outfit_id = Column(UUID(as_uuid=True), ForeignKey("outfits.id", ondelete="SET NULL"), nullable=True, index=True)

    worn_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    temperature = Column(Float, nullable=True)
    feels_like_temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    weather_condition = Column(String(100), nullable=True)
    rain_probability = Column(Float, nullable=True)

    occasion = Column(String(100), nullable=True)
    season = Column(String(100), nullable=True)

    user_rating = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="wear_history")
    outfit = relationship("Outfit", back_populates="wear_history")
