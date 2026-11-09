import uuid
from datetime import date, time, datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import inspect
from app.models.calendar_event import CalendarEvent
from app.models.outfit import Outfit
from app.models.wear_history import WearHistory
from app.models.learned_preference import LearnedPreference


def _wh_to_calendar_event(wh: WearHistory) -> CalendarEvent:
    event_type = "planned_outfit"
    notes = ""
    rec_id = None
    if wh.season and ":" in wh.season:
        parts = wh.season.split(":", 2)
        event_type = parts[0]
        if len(parts) == 3:
            if parts[1]:
                try:
                    rec_id = UUID(parts[1])
                except Exception:
                    rec_id = None
            notes = parts[2]
        else:
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
        event_source="tailorbird",
        outfit_id=wh.outfit_id,
        recommendation_id=rec_id,
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

    def _dict_to_calendar_event(self, d: Dict[str, Any]) -> CalendarEvent:
        """Converts JSONB fallback dict to CalendarEvent model instance."""
        ev_id = UUID(d["id"]) if isinstance(d["id"], str) else d["id"]
        u_id = UUID(d["user_id"]) if isinstance(d["user_id"], str) else d["user_id"]
        o_id = UUID(d["outfit_id"]) if d.get("outfit_id") else None
        r_id = UUID(d["recommendation_id"]) if d.get("recommendation_id") else None

        ev_date = date.fromisoformat(d["event_date"]) if isinstance(d.get("event_date"), str) else d.get("event_date", date.today())
        start_t = time.fromisoformat(d["start_time"]) if isinstance(d.get("start_time"), str) else d.get("start_time")
        end_t = time.fromisoformat(d["end_time"]) if isinstance(d.get("end_time"), str) else d.get("end_time")

        ev = CalendarEvent(
            id=ev_id,
            user_id=u_id,
            event_date=ev_date,
            start_time=start_t,
            end_time=end_t,
            status=d.get("status", "scheduled"),
            event_type=d.get("event_type", "special_event"),
            outfit_id=o_id,
            recommendation_id=r_id,
            occasion=d.get("occasion"),
            notes=d.get("notes"),
            title=d.get("title"),
            description=d.get("description"),
            location=d.get("location"),
            timezone=d.get("timezone"),
            is_all_day=d.get("is_all_day", False),
            google_calendar_id=d.get("google_calendar_id"),
            google_event_id=d.get("google_event_id"),
            event_source=d.get("event_source", "google"),
            last_synced_at=datetime.fromisoformat(d["last_synced_at"]) if d.get("last_synced_at") else None,
            recurrence_rule=d.get("recurrence_rule"),
            inferred_occasion=d.get("inferred_occasion"),
            inferred_formality=d.get("inferred_formality"),
            inferred_dress_code=d.get("inferred_dress_code"),
            inferred_context=d.get("inferred_context"),
            created_at=datetime.fromisoformat(d["created_at"]) if d.get("created_at") else datetime.now(timezone.utc),
            updated_at=datetime.fromisoformat(d["updated_at"]) if d.get("updated_at") else datetime.now(timezone.utc),
        )
        if o_id:
            ev.outfit = (
                self.db.query(Outfit)
                .options(joinedload(Outfit.clothing_items))
                .filter(Outfit.id == o_id)
                .first()
            )
        return ev

    def get_by_id(self, event_id: UUID, user_id: Optional[UUID] = None) -> Optional[CalendarEvent]:
        if not self._has_table:
            # 1. Check fallback Google events in LearnedPreference
            if user_id:
                lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
                if lp and isinstance(lp.weather_scores, dict):
                    g_events = lp.weather_scores.get("_google_calendar_events", {})
                    for ev_data in g_events.values():
                        if ev_data.get("id") == str(event_id):
                            return self._dict_to_calendar_event(ev_data)

            # 2. Check WearHistory fallback for native events
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

    def get_by_google_event(
        self, user_id: UUID, calendar_id: str, google_event_id: str
    ) -> Optional[CalendarEvent]:
        """Finds an imported event by user ID, Google calendar ID, and Google event ID."""
        if not self._has_table:
            lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
            if not lp or not isinstance(lp.weather_scores, dict):
                return None
            g_events = lp.weather_scores.get("_google_calendar_events", {})
            key = f"{calendar_id}:{google_event_id}"
            ev_data = g_events.get(key)
            return self._dict_to_calendar_event(ev_data) if ev_data else None

        return (
            self.db.query(CalendarEvent)
            .options(joinedload(CalendarEvent.outfit).joinedload(Outfit.clothing_items))
            .filter(
                CalendarEvent.user_id == user_id,
                CalendarEvent.google_calendar_id == calendar_id,
                CalendarEvent.google_event_id == google_event_id,
            )
            .first()
        )

    def get_by_recommendation_and_date(
        self, recommendation_id: UUID, event_date: date, user_id: UUID
    ) -> Optional[CalendarEvent]:
        if not self._has_table:
            start_dt = datetime(event_date.year, event_date.month, event_date.day, 0, 0, 0, tzinfo=timezone.utc)
            end_dt = datetime(event_date.year, event_date.month, event_date.day, 23, 59, 59, tzinfo=timezone.utc)
            whs = (
                self.db.query(WearHistory)
                .options(joinedload(WearHistory.outfit).joinedload(Outfit.clothing_items))
                .filter(
                    WearHistory.user_id == user_id,
                    WearHistory.worn_at >= start_dt,
                    WearHistory.worn_at <= end_dt,
                    WearHistory.weather_condition != "cancelled",
                )
                .all()
            )
            rec_str = str(recommendation_id)
            for wh in whs:
                if wh.season and rec_str in wh.season:
                    return _wh_to_calendar_event(wh)
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

    def list_by_user_and_date_range(
        self,
        user_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[CalendarEvent]:
        return self.list_for_user(user_id=user_id, start_date=start_date, end_date=end_date)

    def list_for_user(
        self,
        user_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
        source: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[CalendarEvent]:
        if not self._has_table:
            all_events: List[CalendarEvent] = []

            # 1. Collect Google events from LearnedPreference fallback
            if source != "tailorbird":
                lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
                if lp and isinstance(lp.weather_scores, dict):
                    g_events = lp.weather_scores.get("_google_calendar_events", {})
                    for ev_data in g_events.values():
                        ev = self._dict_to_calendar_event(ev_data)
                        if start_date and ev.event_date < start_date:
                            continue
                        if end_date and ev.event_date > end_date:
                            continue
                        if status and ev.status != status:
                            continue
                        all_events.append(ev)

            # 2. Collect native WearHistory events
            if source != "google":
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

                wh_items = q.all()
                all_events.extend([_wh_to_calendar_event(wh) for wh in wh_items])

            # Sort chronologically by date then start_time
            all_events.sort(key=lambda x: (x.event_date, x.start_time or time(0, 0)))
            return all_events[offset : offset + limit]

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
        if source:
            q = q.filter(CalendarEvent.event_source == source)

        return (
            q.order_by(CalendarEvent.event_date.asc(), CalendarEvent.start_time.asc().nullsfirst())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def count_for_user(self, user_id: UUID, source: Optional[str] = None) -> int:
        """Counts events for a user, optionally filtered by event source."""
        if not self._has_table:
            count = 0
            if source != "tailorbird":
                lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
                if lp and isinstance(lp.weather_scores, dict):
                    g_events = lp.weather_scores.get("_google_calendar_events", {})
                    count += len(g_events)
            if source != "google":
                count += self.db.query(WearHistory).filter(WearHistory.user_id == user_id).count()
            return count

        q = self.db.query(CalendarEvent).filter(CalendarEvent.user_id == user_id)
        if source:
            q = q.filter(CalendarEvent.event_source == source)
        return q.count()

    def upsert_google_event(self, user_id: UUID, **kwargs) -> str:
        """
        Idempotently inserts or updates an imported Google Calendar event.
        Returns 'imported', 'updated', or 'cancelled'.
        Preserves existing user outfit associations.
        """
        cal_id = kwargs.get("google_calendar_id")
        event_id = kwargs.get("google_event_id")
        if not cal_id or not event_id:
            return "skipped"

        existing = self.get_by_google_event(user_id=user_id, calendar_id=cal_id, google_event_id=event_id)

        if not self._has_table:
            lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
            if not lp:
                lp = LearnedPreference(user_id=user_id)
                self.db.add(lp)
                self.db.flush()

            scores = dict(lp.weather_scores or {})
            g_events = dict(scores.get("_google_calendar_events", {}))
            key = f"{cal_id}:{event_id}"

            if existing:
                # Update attributes while preserving outfit associations
                current_data = g_events.get(key, {})
                for k, v in kwargs.items():
                    if k in ("outfit_id", "recommendation_id") and v is None:
                        continue
                    if isinstance(v, (date, time, datetime)):
                        current_data[k] = v.isoformat()
                    else:
                        current_data[k] = v
                current_data["updated_at"] = datetime.now(timezone.utc).isoformat()
                g_events[key] = current_data
                scores["_google_calendar_events"] = g_events
                lp.weather_scores = scores
                flag_modified(lp, "weather_scores")
                self.db.commit()
                return "cancelled" if kwargs.get("status") == "cancelled" else "updated"
            else:
                new_id = str(uuid.uuid4())
                event_data = {
                    "id": new_id,
                    "user_id": str(user_id),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                for k, v in kwargs.items():
                    if isinstance(v, (date, time, datetime)):
                        event_data[k] = v.isoformat()
                    else:
                        event_data[k] = v
                g_events[key] = event_data
                scores["_google_calendar_events"] = g_events
                lp.weather_scores = scores
                flag_modified(lp, "weather_scores")
                self.db.commit()
                return "imported"

        # Relational table path
        if existing:
            # Preserve existing outfit association if user already assigned an outfit
            for key, val in kwargs.items():
                if key in ("outfit_id", "recommendation_id") and val is None:
                    continue
                if hasattr(existing, key):
                    setattr(existing, key, val)
            self.db.commit()
            return "cancelled" if kwargs.get("status") == "cancelled" else "updated"
        else:
            new_event = CalendarEvent(user_id=user_id, **kwargs)
            self.db.add(new_event)
            self.db.commit()
            return "imported"

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
            rec_id_str = str(kwargs.get("recommendation_id") or "")
            season = f"{event_type}:{rec_id_str}:{notes}"[:100]

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
            # Check if this is a fallback Google event in LearnedPreference
            lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == event.user_id).first()
            if lp and isinstance(lp.weather_scores, dict):
                g_events = dict(lp.weather_scores.get("_google_calendar_events", {}))
                for key, data in g_events.items():
                    if data.get("id") == str(event.id):
                        for k, v in kwargs.items():
                            if v is not None:
                                if isinstance(v, (date, time, datetime)):
                                    data[k] = v.isoformat()
                                elif isinstance(v, UUID):
                                    data[k] = str(v)
                                else:
                                    data[k] = v
                        data["updated_at"] = datetime.now(timezone.utc).isoformat()
                        g_events[key] = data
                        scores = dict(lp.weather_scores)
                        scores["_google_calendar_events"] = g_events
                        lp.weather_scores = scores
                        flag_modified(lp, "weather_scores")
                        self.db.commit()
                        return self._dict_to_calendar_event(data)

            # Native WearHistory update
            wh = self.db.query(WearHistory).filter(WearHistory.id == event.id).first()
            if not wh:
                return event
            if "status" in kwargs and kwargs["status"] is not None:
                wh.weather_condition = kwargs["status"]
            if "occasion" in kwargs and kwargs["occasion"] is not None:
                wh.occasion = kwargs["occasion"]
            if "outfit_id" in kwargs and kwargs["outfit_id"] is not None:
                wh.outfit_id = kwargs["outfit_id"]
            if "notes" in kwargs or "event_type" in kwargs or "recommendation_id" in kwargs:
                notes = kwargs.get("notes", event.notes or "")
                event_type = kwargs.get("event_type", event.event_type or "planned_outfit")
                rec_id = kwargs.get("recommendation_id", event.recommendation_id)
                rec_id_str = str(rec_id or "")
                wh.season = f"{event_type}:{rec_id_str}:{notes}"[:100]
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
            # Check if this is a fallback Google event
            lp = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == event.user_id).first()
            if lp and isinstance(lp.weather_scores, dict):
                g_events = dict(lp.weather_scores.get("_google_calendar_events", {}))
                to_delete_key = None
                for key, data in g_events.items():
                    if data.get("id") == str(event.id):
                        to_delete_key = key
                        break
                if to_delete_key:
                    del g_events[to_delete_key]
                    scores = dict(lp.weather_scores)
                    scores["_google_calendar_events"] = g_events
                    lp.weather_scores = scores
                    flag_modified(lp, "weather_scores")
                    self.db.commit()
                    return

            wh = self.db.query(WearHistory).filter(WearHistory.id == event.id).first()
            if wh:
                self.db.delete(wh)
                self.db.commit()
            return

        self.db.delete(event)
        self.db.commit()
