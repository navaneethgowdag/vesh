"""
TailorBird Weekly Outfit Planner Service.
Generates, persists, and manages a 7-day outfit plan using the user's actual wardrobe,
calendar events, weather forecast, personalization preferences, and wear history.
"""

import json
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Set, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.weekly_plan import WeeklyPlan, WeeklyPlanDay
from app.models.outfit import Outfit
from app.models.clothing import Clothing
from app.models.calendar_event import CalendarEvent
from app.repositories.weekly_plan_repository import WeeklyPlanRepository
from app.repositories.calendar_repository import CalendarRepository
from app.services.recommendation_service import RecommendationService
from app.services.event_classifier_service import EventClassifierService
from app.services.weather_service import weather_service
from app.services.color_coordination_service import ColorCoordinationService

logger = logging.getLogger(__name__)


class WeeklyPlannerService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = WeeklyPlanRepository(db)
        self.calendar_repo = CalendarRepository(db)
        self.rec_service = RecommendationService(db)

    @staticmethod
    def get_week_boundaries(target_date: Optional[date] = None) -> Tuple[date, date]:
        """Calculates Monday-to-Sunday boundaries for target date (defaulting to today)."""
        ref = target_date or date.today()
        # Monday is 0
        start = ref - timedelta(days=ref.weekday())
        end = start + timedelta(days=6)
        return start, end

    def get_plan(self, user_id: UUID, week_start_date: Optional[date] = None) -> Optional[WeeklyPlan]:
        """Retrieves active weekly plan for user."""
        if week_start_date:
            return self.repo.get_by_week(user_id, week_start_date)
        start, _ = self.get_week_boundaries()
        plan = self.repo.get_by_week(user_id, start)
        if not plan:
            plan = self.repo.get_active_or_latest(user_id)
        return plan

    async def generate_weekly_plan(
        self,
        user_id: UUID,
        week_start_date: Optional[date] = None,
        force_regenerate: bool = False,
    ) -> WeeklyPlan:
        """
        Generates or returns a 7-day outfit plan.
        - Prevents duplicate plans unless force_regenerate is True.
        - Preserves accepted daily outfits when regenerating.
        - Avoids repeating garments across consecutive days.
        - Strictly isolates user wardrobe items.
        - Gracefully handles insufficient wardrobe items without failing the entire week.
        """
        start, end = self.get_week_boundaries(week_start_date)

        # 1. Check for existing plan for this week
        existing_plan = self.repo.get_by_week(user_id, start)
        if existing_plan and not force_regenerate:
            return existing_plan

        # Map of existing accepted days to preserve
        preserved_days: Dict[date, WeeklyPlanDay] = {}
        if existing_plan:
            for day in (existing_plan.days or []):
                if day.status == "accepted" and day.outfit_id:
                    preserved_days[day.plan_date] = day

        # 2. Check wardrobe sufficiency
        user_items_count = (
            self.db.query(Clothing)
            .filter(Clothing.user_id == user_id)
            .count()
        )

        plan = existing_plan or WeeklyPlan(
            id=uuid.uuid4(),
            user_id=user_id,
            week_start_date=start,
            week_end_date=end,
            status="active",
        )
        plan.updated_at = datetime.now(timezone.utc)

        new_days: List[WeeklyPlanDay] = []
        garments_assigned_yesterday: Set[UUID] = set()

        for day_idx in range(7):
            cur_date = start + timedelta(days=day_idx)

            # Preserve accepted day
            if cur_date in preserved_days:
                preserved = preserved_days[cur_date]
                new_days.append(preserved)
                if preserved.outfit and preserved.outfit.clothing_items:
                    garments_assigned_yesterday = {i.id for i in preserved.outfit.clothing_items}
                continue

            # Day needs generation
            if user_items_count < 2:
                # Not enough items in wardrobe
                day_entry = WeeklyPlanDay(
                    id=uuid.uuid4(),
                    weekly_plan_id=plan.id,
                    plan_date=cur_date,
                    outfit_id=None,
                    status="needs_manual_selection",
                    recommendation_explanation=json.dumps({
                        "summary": "Wardrobe contains fewer than 2 items. Please add tops and bottoms.",
                        "reasons": ["Insufficient wardrobe items to formulate recommendations."],
                        "needs_items": True,
                    }),
                )
                new_days.append(day_entry)
                continue

            # Check calendar events for cur_date
            events = self.calendar_repo.list_by_user_and_date_range(user_id, cur_date, cur_date)
            primary_event: Optional[CalendarEvent] = None
            if events:
                primary_event = events[0]

            # Try generating recommendation for this day
            try:
                recs = await self.rec_service.generate_recommendations(
                    user_id=user_id,
                    calendar_event_id=primary_event.id if primary_event else None,
                    target_date=cur_date,
                    limit=1,
                    item_ids_worn_yesterday=garments_assigned_yesterday,
                )

                if recs and recs[0].outfit:
                    rec = recs[0]
                    outfit = rec.outfit
                    explanation_payload = {
                        "summary": rec.reasons[0] if rec.reasons else "Daily tailored outfit.",
                        "reasons": rec.reasons,
                        "score": round(rec.score, 2),
                        "reasoning": rec.reasoning,
                        "context": rec.context,
                    }

                    day_entry = WeeklyPlanDay(
                        id=uuid.uuid4(),
                        weekly_plan_id=plan.id,
                        plan_date=cur_date,
                        outfit_id=outfit.id,
                        calendar_event_id=primary_event.id if primary_event else None,
                        status="planned",
                        recommendation_explanation=json.dumps(explanation_payload),
                    )
                    day_entry.outfit = outfit
                    new_days.append(day_entry)

                    # Update rotation tracker for next consecutive day
                    if outfit.clothing_items:
                        garments_assigned_yesterday = {i.id for i in outfit.clothing_items}
                    else:
                        garments_assigned_yesterday = set()
                else:
                    raise ValueError("No candidates found")

            except Exception as e:
                logger.info(f"Day {cur_date} recommendation needs manual selection: {e}")
                day_entry = WeeklyPlanDay(
                    id=uuid.uuid4(),
                    weekly_plan_id=plan.id,
                    plan_date=cur_date,
                    outfit_id=None,
                    calendar_event_id=primary_event.id if primary_event else None,
                    status="needs_manual_selection",
                    recommendation_explanation=json.dumps({
                        "summary": "Specific style or event constraints could not be automatically satisfied. Manual outfit selection suggested.",
                        "reasons": ["No compatible outfit combinations met the formality/dress-code requirements."],
                        "needs_items": False,
                    }),
                )
                new_days.append(day_entry)
                garments_assigned_yesterday = set()

        plan.days = new_days
        saved = self.repo.save_plan(plan)
        return saved

    async def regenerate_day(
        self,
        user_id: UUID,
        plan_id: UUID,
        day_id: UUID,
    ) -> WeeklyPlanDay:
        """
        Regenerates an individual day's outfit recommendation without altering other days.
        Preserves accepted days and respects adjacent-day rotation.
        """
        plan = self.repo.get_by_id(plan_id, user_id)
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weekly plan not found.")

        target_day: Optional[WeeklyPlanDay] = None
        adjacent_garments: Set[UUID] = set()

        # Find target day and garments from adjacent days
        for idx, day in enumerate(plan.days or []):
            if day.id == day_id:
                target_day = day
                # Check previous day
                if idx > 0 and plan.days[idx - 1].outfit and plan.days[idx - 1].outfit.clothing_items:
                    adjacent_garments.update(i.id for i in plan.days[idx - 1].outfit.clothing_items)
                # Check next day
                if idx < len(plan.days) - 1 and plan.days[idx + 1].outfit and plan.days[idx + 1].outfit.clothing_items:
                    adjacent_garments.update(i.id for i in plan.days[idx + 1].outfit.clothing_items)
                break

        if not target_day:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day not found in weekly plan.")

        # Re-run recommendation
        events = self.calendar_repo.list_by_user_and_date_range(user_id, target_day.plan_date, target_day.plan_date)
        primary_event = events[0] if events else None

        recs = await self.rec_service.generate_recommendations(
            user_id=user_id,
            calendar_event_id=primary_event.id if primary_event else None,
            target_date=target_day.plan_date,
            limit=1,
            item_ids_worn_yesterday=adjacent_garments,
        )

        if not recs or not recs[0].outfit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Could not generate alternative outfit. Please add compatible items or select manually.",
            )

        rec = recs[0]
        target_day.outfit_id = rec.outfit.id
        target_day.outfit = rec.outfit
        target_day.status = "planned"
        target_day.updated_at = datetime.now(timezone.utc)
        target_day.recommendation_explanation = json.dumps({
            "summary": rec.reasons[0] if rec.reasons else "Regenerated daily outfit.",
            "reasons": rec.reasons,
            "score": round(rec.score, 2),
            "reasoning": rec.reasoning,
            "context": rec.context,
        })

        self.repo.save_plan(plan)
        return target_day

    def update_day_outfit(
        self,
        user_id: UUID,
        plan_id: UUID,
        day_id: UUID,
        outfit_id: Optional[UUID] = None,
        clothing_item_ids: Optional[List[UUID]] = None,
    ) -> WeeklyPlanDay:
        """Manually sets an alternative outfit for a specific day."""
        plan = self.repo.get_by_id(plan_id, user_id)
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weekly plan not found.")

        target_day = next((d for d in (plan.days or []) if d.id == day_id), None)
        if not target_day:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day not found in plan.")

        if outfit_id:
            outfit = self.db.query(Outfit).filter(Outfit.id == outfit_id, Outfit.user_id == user_id).first()
            if not outfit:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found in your wardrobe.")
        elif clothing_item_ids:
            # Validate clothing belongs to user
            items = (
                self.db.query(Clothing)
                .filter(Clothing.id.in_(clothing_item_ids), Clothing.user_id == user_id)
                .all()
            )
            if len(items) != len(clothing_item_ids):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="One or more items do not belong to you.")

            outfit = Outfit(
                id=uuid.uuid4(),
                user_id=user_id,
                name=f"Manual Look - {target_day.plan_date.strftime('%a %b %d')}",
                occasion="Custom",
            )
            outfit.clothing_items = items
            self.db.add(outfit)
            self.db.commit()
            self.db.refresh(outfit)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Must provide outfit_id or clothing_item_ids.")

        target_day.outfit_id = outfit.id
        target_day.outfit = outfit
        target_day.status = "accepted"
        target_day.updated_at = datetime.now(timezone.utc)
        target_day.recommendation_explanation = json.dumps({
            "summary": "Manually selected by user.",
            "reasons": ["Custom outfit chosen from personal wardrobe."],
            "manual": True,
        })

        self.repo.save_plan(plan)
        return target_day

    def update_day_status(
        self,
        user_id: UUID,
        plan_id: UUID,
        day_id: UUID,
        new_status: str,
    ) -> WeeklyPlanDay:
        """
        Updates day status (planned, accepted, rejected, worn).
        If marked worn, records in wear history idempotently.
        """
        valid_statuses = {"planned", "accepted", "rejected", "worn", "needs_manual_selection"}
        if new_status not in valid_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status: {new_status}")

        plan = self.repo.get_by_id(plan_id, user_id)
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weekly plan not found.")

        target_day = next((d for d in (plan.days or []) if d.id == day_id), None)
        if not target_day:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day not found in plan.")

        target_day.status = new_status
        target_day.updated_at = datetime.now(timezone.utc)

        # Idempotently record wear history if marked worn
        if new_status == "worn" and target_day.outfit_id:
            try:
                self.rec_service.mark_outfit_as_worn(user_id=user_id, outfit_id=target_day.outfit_id)
            except Exception as e:
                logger.warning(f"Could not record wear history: {e}")

        self.repo.save_plan(plan)
        return target_day
