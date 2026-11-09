import json
import uuid
from datetime import datetime, date, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class WeeklyPlan(Base):
    __tablename__ = "weekly_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start_date = Column(Date, nullable=False, index=True)
    week_end_date = Column(Date, nullable=False)
    status = Column(String(50), default="active", nullable=False)  # active, completed, archived

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __init__(self, **kwargs):
        if "created_at" not in kwargs:
            kwargs["created_at"] = datetime.now(timezone.utc)
        if "updated_at" not in kwargs:
            kwargs["updated_at"] = datetime.now(timezone.utc)
        super().__init__(**kwargs)

    # Relationships
    user = relationship("User")
    days = relationship(
        "WeeklyPlanDay",
        back_populates="weekly_plan",
        cascade="all, delete-orphan",
        order_by="WeeklyPlanDay.plan_date",
    )


class WeeklyPlanDay(Base):
    __tablename__ = "weekly_plan_days"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    weekly_plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("weekly_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_date = Column(Date, nullable=False, index=True)
    outfit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("outfits.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    calendar_event_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String(50), default="planned", nullable=False)  # planned, accepted, rejected, worn, needs_manual_selection
    recommendation_explanation = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __init__(self, **kwargs):
        if "created_at" not in kwargs:
            kwargs["created_at"] = datetime.now(timezone.utc)
        if "updated_at" not in kwargs:
            kwargs["updated_at"] = datetime.now(timezone.utc)
        super().__init__(**kwargs)

    # Relationships
    weekly_plan = relationship("WeeklyPlan", back_populates="days")
    outfit = relationship("Outfit")

    @property
    def explanation_data(self) -> Dict[str, Any]:
        """Parsed explanation JSON payload."""
        if not self.recommendation_explanation:
            return {}
        try:
            return json.loads(self.recommendation_explanation)
        except Exception:
            return {"summary": self.recommendation_explanation}
