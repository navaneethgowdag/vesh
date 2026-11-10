import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility virtual properties (not DB columns)
    @property
    def display_name(self) -> str:
        parts = [p for p in (self.first_name, self.last_name) if p]
        if parts:
            return " ".join(parts)
        return self.username

    @display_name.setter
    def display_name(self, value: Optional[str]):
        if not value:
            return
        parts = value.strip().split(" ", 1)
        self.first_name = parts[0]
        self.last_name = parts[1] if len(parts) > 1 else ""

    @property
    def profile_image_url(self) -> Optional[str]:
        return self.avatar_url

    @profile_image_url.setter
    def profile_image_url(self, value: Optional[str]):
        self.avatar_url = value

    @property
    def location(self) -> str:
        return ""

    @property
    def gender(self) -> str:
        if self.preference and hasattr(self.preference, "gender") and self.preference.gender:
            return self.preference.gender
        return ""

    @gender.setter
    def gender(self, value: Optional[str]):
        if self.preference and hasattr(self.preference, "gender"):
            self.preference.gender = value

    @property
    def avatar_style(self) -> str:
        if self.preference and hasattr(self.preference, "avatar_style") and self.preference.avatar_style:
            return self.preference.avatar_style
        return "neutral"

    @avatar_style.setter
    def avatar_style(self, value: Optional[str]):
        if self.preference and hasattr(self.preference, "avatar_style"):
            self.preference.avatar_style = value

    @property
    def onboarding_completed(self) -> bool:
        if self.preference and hasattr(self.preference, "onboarding_completed"):
            if self.preference.onboarding_completed:
                return True
        try:
            if self.clothing_items and len(self.clothing_items) > 0:
                return True
            if self.posts and len(self.posts) > 0:
                return True
        except Exception:
            pass
        return False

    @property
    def age_range(self) -> str:
        return ""

    @property
    def is_admin(self) -> bool:
        from app.core.config import settings
        admin_u = (getattr(settings, "ADMIN_USERNAME", None) or "admin").lower()
        if self.username and self.username.lower() == admin_u:
            return True
        if self.email and self.email.lower() == f"{admin_u}@tailorbird.internal":
            return True
        if self.preference and getattr(self.preference, "preferred_fits", None):
            if isinstance(self.preference.preferred_fits, dict) and self.preference.preferred_fits.get("role") == "admin":
                return True
        return False

    # Relationships
    preference = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    learned_preference = relationship("LearnedPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    clothing_items = relationship("Clothing", back_populates="user", cascade="all, delete-orphan")
    outfits = relationship("Outfit", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    recommendation_feedback = relationship("RecommendationFeedback", back_populates="user", cascade="all, delete-orphan")
    wear_history = relationship("WearHistory", back_populates="user", cascade="all, delete-orphan")
    saved_items = relationship("SavedItem", back_populates="user", cascade="all, delete-orphan")
    collections = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="user", cascade="save-update, merge", passive_deletes="all")
    google_calendar_connection = relationship("GoogleCalendarConnection", back_populates="user", uselist=False, cascade="all, delete-orphan")
    background_jobs = relationship("BackgroundJob", back_populates="user", cascade="save-update, merge", passive_deletes="all")

    following = relationship(
        "Follow",
        foreign_keys="Follow.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan",
    )
    followers = relationship(
        "Follow",
        foreign_keys="Follow.following_id",
        back_populates="following",
        cascade="all, delete-orphan",
    )
