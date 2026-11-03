import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Poll(Base):
    __tablename__ = "polls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    content_type = Column(String(20), nullable=False, default="standalone")  # "standalone", "post", "moment"
    
    # Associated post or moment (moments are stored in the posts table)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=True, index=True)
    
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    allow_vote_change = Column(Boolean, default=False, nullable=False)
    show_results_before_vote = Column(Boolean, default=False, nullable=False)
    allow_creator_vote = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    creator = relationship("User", foreign_keys=[creator_user_id])
    post = relationship("Post", back_populates="poll", foreign_keys=[post_id])
    options = relationship(
        "PollOption",
        back_populates="poll",
        cascade="all, delete-orphan",
        order_by="PollOption.display_order",
    )
    votes = relationship("PollVote", back_populates="poll", cascade="all, delete-orphan")

    @property
    def parent_post_id(self):
        return self.post_id if self.content_type == "post" else None

    @property
    def parent_moment_id(self):
        return self.post_id if self.content_type == "moment" else None

    @property
    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc)
        return now >= self.expires_at

    @property
    def time_remaining_seconds(self) -> int:
        now = datetime.now(timezone.utc)
        return max(0, int((self.expires_at - now).total_seconds()))


class PollOption(Base):
    __tablename__ = "poll_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poll_id = Column(UUID(as_uuid=True), ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True)
    option_text = Column(String(255), nullable=False)
    display_order = Column(Integer, default=0, nullable=False)

    poll = relationship("Poll", back_populates="options")
    votes = relationship("PollVote", back_populates="option", cascade="all, delete-orphan")


class PollVote(Base):
    __tablename__ = "poll_votes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poll_id = Column(UUID(as_uuid=True), ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True)
    option_id = Column(UUID(as_uuid=True), ForeignKey("poll_options.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("poll_id", "user_id", name="uq_poll_user_vote"),
    )

    poll = relationship("Poll", back_populates="votes")
    option = relationship("PollOption", back_populates="votes")
    user = relationship("User")
