import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


def _default_calendars():
    return ["primary"]


def _default_dict():
    return {}


class GoogleCalendarConnection(Base):
    """
    Tracks a user's Google Calendar integration state, encrypted refresh token,
    selected calendars to synchronize, and Google Calendar sync tokens.
    """
    __tablename__ = "google_calendar_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    encrypted_refresh_token = Column(Text, nullable=True)
    google_email = Column(String(255), nullable=True)

    # List of calendar IDs selected by the user for synchronization (e.g. ["primary"])
    selected_calendars = Column(JSONB, default=_default_calendars, nullable=False)

    # Per-calendar syncToken mapping (e.g. {"primary": "cpio123..."}) for incremental sync
    sync_tokens = Column(JSONB, default=_default_dict, nullable=False)

    last_sync_time = Column(DateTime(timezone=True), nullable=True)
    sync_status = Column(String(50), default="idle", nullable=False)  # idle, syncing, success, error
    last_sync_error = Column(Text, nullable=True)

    is_connected = Column(Boolean, default=True, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="google_calendar_connection")

    __table_args__ = (
        Index("ix_google_cal_conn_user", "user_id"),
    )

    def __init__(self, **kwargs):
        if "id" not in kwargs or kwargs["id"] is None:
            kwargs["id"] = uuid.uuid4()
        super().__init__(**kwargs)
