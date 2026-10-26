from datetime import date, datetime, timezone
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import inspect
from app.models.calendar_event import CalendarEvent
from app.models.outfit import Outfit
from app.models.wear_history import WearHistory


def _wh_to_calendar_event(wh: WearHistory) -> CalendarEvent:
    event_type = "planned_outfit"
    notes = ""
    if wh.season and ":" in wh.season:
        parts = wh.season.split(":", 1)
        event_type = parts[0]
        notes = parts[1]
    elif wh.season:
        event_type = wh.season

    ev_date = wh.worn_at.date() if wh.worn_at else date.today()
    ev_time = (
        wh.worn_at.time()
        if wh.worn_at and (wh.worn_at.hour != 12 or wh.worn_at.minute != 0 or wh.worn_at.second != 0)
        else None
    )

    ev = CalendarEvent(
        id=wh.id,
        user_id=wh.user_id,
        event_date=ev_date,
        start_time=ev_time,
        end_time=None,
        status=wh.weather_condition or "scheduled",
        event_type=event_type,
        outfit_id=wh.outfit_id,
        recommendation_id=None,
        occasion=wh.occasion,
        notes=notes,
        created_at=wh.created_at,
        updated_at=wh.created_at,
    )
    ev.outfit = wh.outfit
    return ev


class CalendarRepository:
    def __init__(self, db: Session):
        self.db = db
        self._has_table = self._check_table_exists()

    def _check_table_exists(self) -> bool:
        try:
            insp = inspect(self.db.bind)
            return "calendar_events" in insp.get_table_names()
        except Exception:
            return False

    def get_by_id(self, event_id: UUID, user_id: Optional[UUID] = None) -> Optional[CalendarEvent]:
        if not self._has_table:
            q = (
                self.db.query(WearHistory)
                .options(joinedload(WearHistory.outfit).joinedload(Outfit.clothing_items))
                .filter(WearHistory.id == event_id)
            )
            if user_id:
                q = q.filter(WearHistory.user_id == user_id)
            wh = q.first()
            return _wh_to_calendar_event(wh) if wh else None

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
        if not self._has_table:
            return None

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
        if not self._has_table:
            q = (
                self.db.query(WearHistory)
                .options(joinedload(WearHistory.outfit).joinedload(Outfit.clothing_items))
                .filter(WearHistory.user_id == user_id)
            )
            if start_date:
                start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0, tzinfo=timezone.utc)
                q = q.filter(WearHistory.worn_at >= start_dt)
            if end_date:
                end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)
                q = q.filter(WearHistory.worn_at <= end_dt)
            if status:
                q = q.filter(WearHistory.weather_condition == status)

            items = q.order_by(WearHistory.worn_at.asc()).offset(offset).limit(limit).all()
            return [_wh_to_calendar_event(wh) for wh in items]

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
        if not self._has_table:
            ev_date = kwargs.get("event_date", date.today())
            st_time = kwargs.get("start_time")
            hour = st_time.hour if st_time else 12
            minute = st_time.minute if st_time else 0
            second = st_time.second if st_time else 0
            worn_at = datetime(ev_date.year, ev_date.month, ev_date.day, hour, minute, second, tzinfo=timezone.utc)

            event_type = kwargs.get("event_type", "planned_outfit")
            notes = kwargs.get("notes") or ""
            season = f"{event_type}:{notes}"[:100]

            wh = WearHistory(
                user_id=user_id,
                outfit_id=kwargs.get("outfit_id"),
                worn_at=worn_at,
                occasion=kwargs.get("occasion"),
                weather_condition=kwargs.get("status", "scheduled"),
                season=season,
            )
            self.db.add(wh)
            self.db.commit()
            self.db.refresh(wh)
            return self.get_by_id(wh.id, user_id) or _wh_to_calendar_event(wh)

        event = CalendarEvent(user_id=user_id, **kwargs)
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return self.get_by_id(event.id, user_id) or event

    def update(self, event: CalendarEvent, **kwargs) -> CalendarEvent:
        if not self._has_table:
            wh = self.db.query(WearHistory).filter(WearHistory.id == event.id).first()
            if not wh:
                return event
            if "status" in kwargs and kwargs["status"] is not None:
                wh.weather_condition = kwargs["status"]
            if "occasion" in kwargs and kwargs["occasion"] is not None:
                wh.occasion = kwargs["occasion"]
            if "outfit_id" in kwargs and kwargs["outfit_id"] is not None:
                wh.outfit_id = kwargs["outfit_id"]
            if "notes" in kwargs or "event_type" in kwargs:
                notes = kwargs.get("notes", event.notes or "")
                event_type = kwargs.get("event_type", event.event_type or "planned_outfit")
                wh.season = f"{event_type}:{notes}"[:100]
            if "event_date" in kwargs and kwargs["event_date"] is not None:
                ed = kwargs["event_date"]
                wh.worn_at = datetime(ed.year, ed.month, ed.day, 12, 0, 0, tzinfo=timezone.utc)
            self.db.commit()
            self.db.refresh(wh)
            return self.get_by_id(wh.id, wh.user_id) or _wh_to_calendar_event(wh)

        for key, value in kwargs.items():
            if value is not None and hasattr(event, key):
                setattr(event, key, value)
        self.db.commit()
        self.db.refresh(event)
        return self.get_by_id(event.id, event.user_id) or event

    def delete(self, event: CalendarEvent) -> None:
        if not self._has_table:
            wh = self.db.query(WearHistory).filter(WearHistory.id == event.id).first()
            if wh:
                self.db.delete(wh)
                self.db.commit()
            return

        self.db.delete(event)
        self.db.commit()
