import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String, LargeBinary, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class ProfileImage(Base):
    """
    ProfileImage model for direct device profile photo uploads.
    Stores raw binary data in PostgreSQL LargeBinary (BYTEA) without cloud storage dependencies.
    """
    __tablename__ = "profile_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    image_data = Column(LargeBinary, nullable=False)
    mime_type = Column(String(50), nullable=False, default="image/webp")
    file_size = Column(Integer, nullable=False, default=0)
    width = Column(Integer, nullable=False, default=512)
    height = Column(Integer, nullable=False, default=512)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
