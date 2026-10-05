import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    preferred_styles = Column(JSONB, default=list, nullable=False)
    preferred_colors = Column(JSONB, default=list, nullable=False)
    preferred_categories = Column(JSONB, default=list, nullable=False)
    preferred_fits = Column(JSONB, default=list, nullable=False)
    preferred_patterns = Column(JSONB, default=list, nullable=False)
    preferred_materials = Column(JSONB, default=list, nullable=False)
    preferred_occasions = Column(JSONB, default=list, nullable=False)
    preferred_seasons = Column(JSONB, default=list, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility properties
    @property
    def styles(self):
        return self.preferred_styles or []

    @property
    def favorite_colors(self):
        return self.preferred_colors or []

    @property
    def disliked_colors(self):
        return []

    @property
    def preferred_brands(self):
        return []

    @property
    def favorite_occasions(self):
        return self.preferred_occasions or []

    @property
    def fashion_goals(self):
        return []

    @property
    def climate_preference(self):
        return "Moderate"

    user = relationship("User", back_populates="preference")
