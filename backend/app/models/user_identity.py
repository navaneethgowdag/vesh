import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserIdentity(Base):
    __tablename__ = "user_identities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(50), nullable=False, index=True, default="google")
    provider_user_id = Column(String(255), nullable=False, index=True)
    provider_subject = Column(String(255), nullable=True, index=True)
    verified_email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_user_identities_provider_user_id"),
        UniqueConstraint("provider", "provider_subject", name="uq_user_identities_provider_subject"),
    )

    # Relationship
    user = relationship("User", foreign_keys=[user_id])

    def __init__(self, **kwargs):
        # Automatically keep provider_subject and provider_user_id synchronized
        if "provider_subject" in kwargs and "provider_user_id" not in kwargs:
            kwargs["provider_user_id"] = kwargs["provider_subject"]
        elif "provider_user_id" in kwargs and "provider_subject" not in kwargs:
            kwargs["provider_subject"] = kwargs["provider_user_id"]
        super().__init__(**kwargs)

    @property
    def subject(self) -> str:
        return self.provider_subject or self.provider_user_id
