import uuid
from datetime import datetime, date, time, timezone
from sqlalchemy import Column, String, Date, Time, DateTime, Text, Boolean, Float, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class CalendarEvent(Base):
    """
    Persistent calendar events for scheduling planned outfits and wardrobe activities.
    Supports both native TailorBird events and events synchronized from Google Calendar.
    Decoupled from WearHistory (which tracks confirmed past wears).
    """
    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    event_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)

    # Event lifecycle: scheduled, completed, cancelled
    status = Column(String(50), default="scheduled", nullable=False, index=True)
    # Event type: planned_outfit, outfit_worn, special_event
    event_type = Column(String(50), default="planned_outfit", nullable=False)

    outfit_id = Column(UUID(as_uuid=True), ForeignKey("outfits.id", ondelete="SET NULL"), nullable=True, index=True)
    recommendation_id = Column(UUID(as_uuid=True), ForeignKey("recommendations.id", ondelete="SET NULL"), nullable=True, index=True)

    occasion = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    # Google Calendar & External Event Synchronization Attributes
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    timezone = Column(String(100), nullable=True)
    is_all_day = Column(Boolean, default=False, nullable=False)
    google_calendar_id = Column(String(255), nullable=True, index=True)
    google_event_id = Column(String(255), nullable=True, index=True)
    event_source = Column(String(50), default="tailorbird", nullable=False, index=True)  # "google" | "tailorbird"
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    recurrence_rule = Column(String(255), nullable=True)

    # Inferred Fashion & Context Attributes
    inferred_occasion = Column(String(100), nullable=True)
    inferred_formality = Column(Float, nullable=True)
    inferred_dress_code = Column(String(100), nullable=True)
    inferred_context = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Virtual property for UI display title
    @property
    def display_title(self) -> str:
        if self.title:
            return self.title
        if self.occasion:
            return self.occasion
        if self.outfit and hasattr(self.outfit, "name") and self.outfit.name:
            return self.outfit.name
        return "Planned Outfit"

    # Relationships
    user = relationship("User", back_populates="calendar_events")
    outfit = relationship("Outfit", back_populates="calendar_events")
    recommendation = relationship("Recommendation", back_populates="calendar_events")

    __table_args__ = (
        Index("ix_calendar_user_date", "user_id", "event_date"),
        Index("ix_calendar_google_event", "user_id", "google_calendar_id", "google_event_id"),
    )
