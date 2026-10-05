import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class SavedItem(Base):
    __tablename__ = "saved"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_saved_user_post"),
    )

    # API compatibility properties
    @property
    def item_type(self) -> str:
        return "post"

    @property
    def item_id(self):
        return self.post_id

    @property
    def collection_id(self):
        return None

    # Relationships
    user = relationship("User", back_populates="saved_items")
    post = relationship("Post", back_populates="saved_by")
