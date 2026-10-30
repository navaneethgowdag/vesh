import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, Float
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

    # Processing metadata properties (backed by ClothingAnalysis or in-memory metadata)
    @property
    def processing_status(self) -> str:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("processing_status", "completed")
        return "completed" if self.image_url else "uploaded"

    @property
    def processing_stage(self) -> str:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("processing_stage", "completed")
        return "completed" if self.image_url else "uploaded"

    @property
    def review_required(self) -> bool:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return bool(self.analysis.feature_vector.get("review_required", False))
        return False

    @property
    def is_processed_available(self) -> bool:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return bool(self.analysis.feature_vector.get("has_processed", False))
        return False

    @property
    def processing_duration(self) -> float:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return float(self.analysis.feature_vector.get("processing_duration", 0.0))
        return 0.0

    @property
    def processing_error(self) -> str:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("error_message") or ""
        return ""

    @property
    def is_finalized(self) -> bool:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return bool(self.analysis.feature_vector.get("is_finalized", False))
        return False

    @property
    def formality(self) -> float:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return float(self.analysis.feature_vector.get("formality", 0.5))
        return 0.5

    @property
    def verified_attributes(self) -> dict:
        if self.analysis and isinstance(self.analysis.feature_vector, dict):
            return self.analysis.feature_vector.get("verified_attributes") or {}
        return {}

    # Relationships
    user = relationship("User", back_populates="clothing_items")
    analysis = relationship("ClothingAnalysis", back_populates="clothing", uselist=False, cascade="all, delete-orphan")
    outfits = relationship("Outfit", secondary="outfit_clothing", back_populates="clothing_items")
    images = relationship(
        "ClothingImage",
        back_populates="clothing",
        cascade="all, delete-orphan",
        lazy="raise",
        passive_deletes=True,
    )
    predictions = relationship(
        "ClothingPrediction",
        back_populates="clothing",
        cascade="all, delete-orphan",
        lazy="raise",
        passive_deletes=True,
    )
    corrections = relationship(
        "ClothingCorrection",
        back_populates="clothing",
        cascade="all, delete-orphan",
        lazy="raise",
        passive_deletes=True,
    )
