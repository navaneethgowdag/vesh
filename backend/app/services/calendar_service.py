from datetime import date
from typing import Optional, List
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.calendar_event import CalendarEvent
from app.models.outfit import Outfit
from app.models.recommendation import Recommendation
from app.repositories.calendar_repository import CalendarRepository
from app.schemas.calendar import CalendarEventCreate, CalendarEventUpdate, ScheduleRecommendationRequest


class CalendarService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CalendarRepository(db)

    def list_events(
        self,
        user_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status_filter: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[CalendarEvent]:
        return self.repo.list_for_user(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            status=status_filter,
            limit=limit,
            offset=offset,
        )

    def get_event(self, event_id: UUID, user_id: UUID) -> CalendarEvent:
        event = self.repo.get_by_id(event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Calendar event not found",
            )
        if event.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this calendar event",
            )
        return event

    def create_event(self, user_id: UUID, event_in: CalendarEventCreate) -> CalendarEvent:
        data = event_in.model_dump()
        outfit_id = data.get("outfit_id")
        if outfit_id:
            outfit = self.db.query(Outfit).filter(Outfit.id == outfit_id).first()
            if not outfit or outfit.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Outfit not found or does not belong to user",
                )

        return self.repo.create(user_id=user_id, **data)

    def update_event(self, event_id: UUID, user_id: UUID, update_in: CalendarEventUpdate) -> CalendarEvent:
        event = self.get_event(event_id, user_id)
        data = update_in.model_dump(exclude_unset=True)

        outfit_id = data.get("outfit_id")
        if outfit_id:
            outfit = self.db.query(Outfit).filter(Outfit.id == outfit_id).first()
            if not outfit or outfit.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Outfit not found or does not belong to user",
                )

        return self.repo.update(event, **data)

    def delete_event(self, event_id: UUID, user_id: UUID) -> None:
        event = self.get_event(event_id, user_id)
        self.repo.delete(event)

    def schedule_recommendation(
        self, user_id: UUID, recommendation_id: UUID, req: ScheduleRecommendationRequest
    ) -> CalendarEvent:
        """
        Idempotently schedules an AI recommendation as a planned calendar event.
        Does NOT increment clothing wear_count. Does NOT create wear_history.
        """
        rec = (
            self.db.query(Recommendation)
            .filter(Recommendation.id == recommendation_id)
            .first()
        )
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recommendation not found",
            )
        if rec.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot schedule another user's recommendation",
            )

        # Idempotency check: see if already scheduled for that target date
        existing = self.repo.get_by_recommendation_and_date(
            recommendation_id=recommendation_id,
            event_date=req.date,
            user_id=user_id,
        )
        if existing:
            # Update notes or occasion if provided, and return existing event
            updates = {}
            if req.notes is not None:
                updates["notes"] = req.notes
            if req.occasion is not None:
                updates["occasion"] = req.occasion
            if req.time is not None:
                updates["start_time"] = req.time
            if updates:
                return self.repo.update(existing, **updates)
            return existing

        # Create new planned calendar event
        event_data = {
            "event_date": req.date,
            "start_time": req.time,
            "event_type": "planned_outfit",
            "outfit_id": rec.outfit_id,
            "recommendation_id": rec.id,
            "occasion": req.occasion or rec.occasion or "Casual Daily",
            "notes": req.notes,
            "status": "scheduled",
        }
        return self.repo.create(user_id=user_id, **event_data)
