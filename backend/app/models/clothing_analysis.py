import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class ClothingAnalysis(Base):
    __tablename__ = "clothing_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clothing_id = Column(UUID(as_uuid=True), ForeignKey("clothing.id", ondelete="CASCADE"), nullable=False, index=True)
    detected_category = Column(String(100), nullable=True)
    detected_subcategory = Column(String(100), nullable=True)
    detected_colors = Column(JSONB, default=list, nullable=False)  # [{name, hex, percentage, rgb}]
    detected_pattern = Column(String(100), nullable=True)
    detected_material = Column(String(100), nullable=True)
    detected_fit = Column(String(100), nullable=True)
    style_tags = Column(JSONB, default=list, nullable=False)
    season_tags = Column(JSONB, default=list, nullable=False)
    occasion_tags = Column(JSONB, default=list, nullable=False)
    confidence = Column(Float, nullable=True)
    feature_vector = Column(JSONB, nullable=True)  # 16-dim list of floats
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility properties
    @property
    def dominant_colors(self):
        return self.detected_colors or []

    @property
    def secondary_colors(self):
        colors = self.detected_colors or []
        return [c.get("name") for c in colors[1:] if isinstance(c, dict) and "name" in c]

    @property
    def pattern(self):
        return self.detected_pattern

    @property
    def material(self):
        return self.detected_material

    @property
    def fit(self):
        return self.detected_fit

    # Relationships
    clothing = relationship("Clothing", back_populates="analysis")
