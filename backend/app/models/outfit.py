import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

# Many-to-Many association table between Outfits and Clothing items
outfit_clothing = Table(
    "outfit_clothing",
    Base.metadata,
    Column("outfit_id", UUID(as_uuid=True), ForeignKey("outfits.id", ondelete="CASCADE"), primary_key=True),
    Column("clothing_id", UUID(as_uuid=True), ForeignKey("clothing.id", ondelete="CASCADE"), primary_key=True),
)


class Outfit(Base):
    __tablename__ = "outfits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    occasion = Column(String(100), nullable=True)
    season = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility properties
    @property
    def style(self) -> str:
        if hasattr(self, "_custom_style") and self._custom_style:
            return self._custom_style
        return "Minimal"

    @style.setter
    def style(self, val: str):
        self._custom_style = val

    @property
    def compatibility_score(self) -> float:
        return 0.9

    @property
    def image_url(self):
        if self.clothing_items:
            return self.clothing_items[0].image_url
        return None

    @property
    def tags(self):
        t = []
        if self.occasion:
            t.append(self.occasion)
        if self.season:
            t.append(self.season)
        return t

    # Relationships
    user = relationship("User", back_populates="outfits")
    clothing_items = relationship("Clothing", secondary=outfit_clothing, back_populates="outfits")
    recommendations = relationship("Recommendation", back_populates="outfit", cascade="all, delete-orphan")
    wear_history = relationship("WearHistory", back_populates="outfit")
    calendar_events = relationship("CalendarEvent", back_populates="outfit")

