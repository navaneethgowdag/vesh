import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    caption = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility properties
    @property
    def location(self):
        return None

    @property
    def occasion(self):
        return "Casual Daily"

    @property
    def tags(self):
        return []

    @property
    def tagged_item_ids(self):
        return []

    @property
    def likes_count(self) -> int:
        return len(self.likes) if self.likes else 0

    @property
    def comments_count(self) -> int:
        return len(self.comments) if self.comments else 0

    @property
    def saves_count(self) -> int:
        return len(self.saved_by) if hasattr(self, "saved_by") and self.saved_by else 0

    # Relationships
    user = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    saved_by = relationship("SavedItem", back_populates="post", cascade="all, delete-orphan")
