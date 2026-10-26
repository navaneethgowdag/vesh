from datetime import date
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from app.models.calendar_event import CalendarEvent
from app.models.outfit import Outfit


class CalendarRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, event_id: UUID, user_id: Optional[UUID] = None) -> Optional[CalendarEvent]:
        q = (
            self.db.query(CalendarEvent)
            .options(joinedload(CalendarEvent.outfit).joinedload(Outfit.clothing_items))
            .filter(CalendarEvent.id == event_id)
        )
        if user_id:
            q = q.filter(CalendarEvent.user_id == user_id)
        return q.first()

    def get_by_recommendation_and_date(
        self, recommendation_id: UUID, event_date: date, user_id: UUID
    ) -> Optional[CalendarEvent]:
        return (
            self.db.query(CalendarEvent)
            .options(joinedload(CalendarEvent.outfit).joinedload(Outfit.clothing_items))
            .filter(
                CalendarEvent.user_id == user_id,
                CalendarEvent.recommendation_id == recommendation_id,
                CalendarEvent.event_date == event_date,
                CalendarEvent.status != "cancelled",
            )
            .first()
        )

    def list_for_user(
        self,
        user_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[CalendarEvent]:
        q = (
            self.db.query(CalendarEvent)
            .options(joinedload(CalendarEvent.outfit).joinedload(Outfit.clothing_items))
            .filter(CalendarEvent.user_id == user_id)
        )
        if start_date:
            q = q.filter(CalendarEvent.event_date >= start_date)
        if end_date:
            q = q.filter(CalendarEvent.event_date <= end_date)
        if status:
            q = q.filter(CalendarEvent.status == status)

        return q.order_by(CalendarEvent.event_date.asc(), CalendarEvent.start_time.asc().nullsfirst()).offset(offset).limit(limit).all()

    def create(self, user_id: UUID, **kwargs) -> CalendarEvent:
        event = CalendarEvent(user_id=user_id, **kwargs)
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return self.get_by_id(event.id, user_id) or event

    def update(self, event: CalendarEvent, **kwargs) -> CalendarEvent:
        for key, value in kwargs.items():
            if value is not None and hasattr(event, key):
                setattr(event, key, value)
        self.db.commit()
        self.db.refresh(event)
        return self.get_by_id(event.id, event.user_id) or event

    def delete(self, event: CalendarEvent) -> None:
        self.db.delete(event)
        self.db.commit()
