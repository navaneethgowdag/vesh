import uuid
from datetime import datetime, date, time, timezone
from sqlalchemy import Column, String, Date, Time, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class CalendarEvent(Base):
    """
    Persistent calendar events for scheduling planned outfits and wardrobe activities.
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

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="calendar_events")
    outfit = relationship("Outfit", back_populates="calendar_events")
    recommendation = relationship("Recommendation", back_populates="calendar_events")

    __table_args__ = (
        Index("ix_calendar_user_date", "user_id", "event_date"),
    )
