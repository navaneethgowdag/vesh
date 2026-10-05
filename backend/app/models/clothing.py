import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Clothing(Base):
    __tablename__ = "clothing"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True, index=True)
    subcategory = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True, index=True)
    secondary_color = Column(String(50), nullable=True)
    pattern = Column(String(50), default="Solid", nullable=True)
    material = Column(String(50), nullable=True)
    fit = Column(String(50), default="Regular", nullable=True)
    brand = Column(String(100), nullable=True)
    size = Column(String(30), nullable=True)
    season = Column(String(50), default="All-Season", nullable=True)
    occasion = Column(String(50), default="Casual Daily", nullable=True)
    image_url = Column(String(1024), nullable=True)
    description = Column(Text, nullable=True)
    is_favorite = Column(Boolean, default=False, nullable=False)
    wear_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility properties
    @property
    def style_tags(self):
        if self.analysis and self.analysis.style_tags:
            return self.analysis.style_tags
        return [self.occasion] if self.occasion else []

    @property
    def last_worn(self):
        return None

    # Relationships
    user = relationship("User", back_populates="clothing_items")
    analysis = relationship("ClothingAnalysis", back_populates="clothing", uselist=False, cascade="all, delete-orphan")
    outfits = relationship("Outfit", secondary="outfit_clothing", back_populates="clothing_items")
