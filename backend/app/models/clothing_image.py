import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ClothingImage(Base):
    __tablename__ = "clothing_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clothing_id = Column(UUID(as_uuid=True), ForeignKey("clothing.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    image_type = Column(String(30), nullable=False, index=True)  # 'original', 'processed', 'intermediate'
    image_data = Column(LargeBinary, nullable=False)              # PostgreSQL BYTEA
    mime_type = Column(String(50), nullable=False, default="image/webp")
    file_size = Column(Integer, nullable=False, default=0)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    clothing = relationship("Clothing", back_populates="images")
    user = relationship("User")
