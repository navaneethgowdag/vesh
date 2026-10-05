import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(100), nullable=False)  # like, comment, follow, recommendation, system
    title = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility properties
    @property
    def target_id(self):
        return None

    @property
    def target_image(self):
        return None

    @property
    def link(self):
        return None

    @property
    def actor(self):
        return None

    @property
    def action_user(self):
        return None

    # Relationships
    user = relationship("User", back_populates="notifications")
