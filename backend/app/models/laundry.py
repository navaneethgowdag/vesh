import uuid
from datetime import datetime, date, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Integer, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


def _empty_dict():
    return {}


class UserLaundrySettings(Base):
    __tablename__ = "user_laundry_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    default_max_wears = Column(Integer, default=2, nullable=False)
    default_wash_days = Column(Integer, default=4, nullable=False)
    category_overrides = Column(JSONB, default=_empty_dict, nullable=False)
    same_item_cooldown_days = Column(Integer, default=1, nullable=False)
    auto_return_from_laundry = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": str(self.user_id),
            "default_max_wears": self.default_max_wears,
            "default_wash_days": self.default_wash_days,
            "category_overrides": self.category_overrides or {},
            "same_item_cooldown_days": self.same_item_cooldown_days,
            "auto_return_from_laundry": self.auto_return_from_laundry,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class WearLog(Base):
    __tablename__ = "wear_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), ForeignKey("clothing.id", ondelete="CASCADE"), nullable=False, index=True)
    outfit_id = Column(UUID(as_uuid=True), ForeignKey("outfits.id", ondelete="SET NULL"), nullable=True)
    worn_on = Column(Date, nullable=False, index=True)
    source = Column(String(50), default="daily_fit", nullable=False)  # daily_fit | planner | manual
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    undone_at = Column(DateTime(timezone=True), nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        if not self.id:
            self.id = uuid.uuid4()
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "item_id": str(self.item_id),
            "outfit_id": str(self.outfit_id) if self.outfit_id else None,
            "worn_on": self.worn_on.isoformat() if self.worn_on else None,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "undone_at": self.undone_at.isoformat() if self.undone_at else None,
        }


class DailyRecommendation(Base):
    __tablename__ = "daily_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    occasion = Column(String(100), nullable=False)
    context_hash = Column(String(64), nullable=True)
    item_ids = Column(JSONB, default=list, nullable=False)
    outfit_hash = Column(String(64), nullable=True)
    regenerate_counter = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="active", nullable=False)  # active | stale | worn | empty
    empty_reason = Column(JSONB, nullable=True)
    recommendation_data = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
