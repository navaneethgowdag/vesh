import uuid
from datetime import date, datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from sqlalchemy.orm.attributes import flag_modified

from app.models.laundry import UserLaundrySettings, WearLog, DailyRecommendation
from app.models.learned_preference import LearnedPreference
from app.models.clothing import Clothing


class LaundryRepository:
    """
    Repository for Laundry Settings, Wear Logs, and Active Daily Recommendations.
    Supports dual persistence:
    1. Physical PostgreSQL tables when available
    2. Resilient JSONB storage via LearnedPreference if physical DDL is restricted.
    """

    def __init__(self, db: Session):
        self.db = db
        self._tables_checked = False
        self._has_laundry_tables = False

    def _check_tables(self) -> bool:
        if not self._tables_checked:
            try:
                insp = inspect(self.db.bind)
                table_names = insp.get_table_names()
                self._has_laundry_tables = (
                    "user_laundry_settings" in table_names
                    and "wear_log" in table_names
                    and "daily_recommendations" in table_names
                )
            except Exception:
                self._has_laundry_tables = False
            self._tables_checked = True
        return self._has_laundry_tables

    # -------------------------------------------------------------------------
    # Fallback JSONB Accessor
    # -------------------------------------------------------------------------
    def _get_learned_pref(self, user_id: UUID) -> LearnedPreference:
        pref = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
        if not pref:
            pref = LearnedPreference(user_id=user_id)
            self.db.add(pref)
            self.db.commit()
            self.db.refresh(pref)
        return pref

    # -------------------------------------------------------------------------
    # Laundry Settings
    # -------------------------------------------------------------------------
    def get_settings(self, user_id: UUID) -> UserLaundrySettings:
        if self._check_tables():
            try:
                s = self.db.query(UserLaundrySettings).filter(UserLaundrySettings.user_id == user_id).first()
                if s:
                    return s
            except Exception:
                pass

        # Fallback via LearnedPreference
        pref = self._get_learned_pref(user_id)
        scores = dict(pref.weather_scores or {})
        saved = scores.get("_laundry_settings")
        if saved:
            return UserLaundrySettings(
                user_id=user_id,
                default_max_wears=saved.get("default_max_wears", 2),
                default_wash_days=saved.get("default_wash_days", 4),
                category_overrides=saved.get("category_overrides", {}),
                same_item_cooldown_days=saved.get("same_item_cooldown_days", 1),
                auto_return_from_laundry=saved.get("auto_return_from_laundry", True),
            )

        # Return defaults
        return UserLaundrySettings(
            user_id=user_id,
            default_max_wears=2,
            default_wash_days=4,
            category_overrides={},
            same_item_cooldown_days=1,
            auto_return_from_laundry=True,
        )

    def save_settings(self, settings: UserLaundrySettings) -> UserLaundrySettings:
        if self._check_tables():
            try:
                existing = self.db.query(UserLaundrySettings).filter(UserLaundrySettings.user_id == settings.user_id).first()
                if existing:
                    existing.default_max_wears = settings.default_max_wears
                    existing.default_wash_days = settings.default_wash_days
                    existing.category_overrides = settings.category_overrides
                    existing.same_item_cooldown_days = settings.same_item_cooldown_days
                    existing.auto_return_from_laundry = settings.auto_return_from_laundry
                    existing.updated_at = datetime.now(timezone.utc)
                else:
                    self.db.add(settings)
                self.db.commit()
                return settings
            except Exception:
                self.db.rollback()

        # Fallback via LearnedPreference
        pref = self._get_learned_pref(settings.user_id)
        scores = dict(pref.weather_scores or {})
        scores["_laundry_settings"] = settings.to_dict()
        pref.weather_scores = scores
        flag_modified(pref, "weather_scores")
        self.db.commit()
        return settings

    # -------------------------------------------------------------------------
    # Wear Logs
    # -------------------------------------------------------------------------
    def has_worn_on_date(self, user_id: UUID, item_id: UUID, worn_on: date) -> bool:
        logs = self.get_wear_logs(user_id=user_id, item_id=item_id, worn_on=worn_on, active_only=True)
        return len(logs) > 0

    def add_wear_log(self, log: WearLog) -> WearLog:
        if self._check_tables():
            try:
                self.db.add(log)
                self.db.commit()
                self.db.refresh(log)
                return log
            except Exception:
                self.db.rollback()

        # Fallback via LearnedPreference
        pref = self._get_learned_pref(log.user_id)
        scores = dict(pref.weather_scores or {})
        raw_logs = list(scores.get("_wear_logs", []))
        raw_logs.append(log.to_dict())
        scores["_wear_logs"] = raw_logs
        pref.weather_scores = scores
        flag_modified(pref, "weather_scores")
        self.db.commit()
        return log

    def get_wear_logs(
        self,
        user_id: UUID,
        item_id: Optional[UUID] = None,
        worn_on: Optional[date] = None,
        active_only: bool = True,
    ) -> List[WearLog]:
        if self._check_tables():
            try:
                q = self.db.query(WearLog).filter(WearLog.user_id == user_id)
                if item_id:
                    q = q.filter(WearLog.item_id == item_id)
                if worn_on:
                    q = q.filter(WearLog.worn_on == worn_on)
                if active_only:
                    q = q.filter(WearLog.undone_at.is_(None))
                return q.order_by(WearLog.worn_on.desc()).all()
            except Exception:
                pass

        # Fallback via LearnedPreference
        pref = self._get_learned_pref(user_id)
        scores = dict(pref.weather_scores or {})
        raw_logs = scores.get("_wear_logs", [])
        results = []
        for d in raw_logs:
            if active_only and d.get("undone_at"):
                continue
            if item_id and d.get("item_id") != str(item_id):
                continue
            if worn_on and d.get("worn_on") != worn_on.isoformat():
                continue
            id_raw = d.get("id")
            log_id = UUID(id_raw) if id_raw and id_raw != "None" else uuid.uuid4()
            results.append(
                WearLog(
                    id=log_id,
                    user_id=user_id,
                    item_id=UUID(d["item_id"]),
                    outfit_id=UUID(d["outfit_id"]) if d.get("outfit_id") else None,
                    worn_on=date.fromisoformat(d["worn_on"]) if isinstance(d.get("worn_on"), str) else d.get("worn_on"),
                    source=d.get("source", "daily_fit"),
                    created_at=datetime.fromisoformat(d["created_at"]) if isinstance(d.get("created_at"), str) else datetime.now(timezone.utc),
                    undone_at=datetime.fromisoformat(d["undone_at"]) if d.get("undone_at") else None,
                )
            )
        return results

    def undo_wear_logs(self, user_id: UUID, item_ids: List[UUID], worn_on: date) -> List[UUID]:
        undone_ids = []
        now_ts = datetime.now(timezone.utc)

        if self._check_tables():
            try:
                logs = (
                    self.db.query(WearLog)
                    .filter(
                        WearLog.user_id == user_id,
                        WearLog.item_id.in_(item_ids),
                        WearLog.worn_on == worn_on,
                        WearLog.undone_at.is_(None),
                    )
                    .all()
                )
                for l in logs:
                    l.undone_at = now_ts
                    undone_ids.append(l.item_id)
                self.db.commit()
                return undone_ids
            except Exception:
                self.db.rollback()

        # Fallback via LearnedPreference
        pref = self._get_learned_pref(user_id)
        scores = dict(pref.weather_scores or {})
        raw_logs = scores.get("_wear_logs", [])
        str_item_ids = {str(i) for i in item_ids}
        worn_on_str = worn_on.isoformat()

        for d in raw_logs:
            if d.get("item_id") in str_item_ids and d.get("worn_on") == worn_on_str and not d.get("undone_at"):
                d["undone_at"] = now_ts.isoformat()
                undone_ids.append(UUID(d["item_id"]))

        scores["_wear_logs"] = raw_logs
        pref.weather_scores = scores
        flag_modified(pref, "weather_scores")
        self.db.commit()
        return undone_ids

    # -------------------------------------------------------------------------
    # Daily Recommendations Persistence
    # -------------------------------------------------------------------------
    def get_daily_recommendation(self, user_id: UUID, rec_date: date, occasion: str) -> Optional[DailyRecommendation]:
        occ_norm = occasion.lower().strip()
        if self._check_tables():
            try:
                return (
                    self.db.query(DailyRecommendation)
                    .filter(
                        DailyRecommendation.user_id == user_id,
                        DailyRecommendation.date == rec_date,
                        DailyRecommendation.occasion.ilike(occ_norm),
                    )
                    .first()
                )
            except Exception:
                pass

        # Fallback via LearnedPreference
        pref = self._get_learned_pref(user_id)
        scores = dict(pref.weather_scores or {})
        recs = scores.get("_daily_recommendations", {})
        key = f"{rec_date.isoformat()}_{occ_norm}"
        data = recs.get(key)
        if data:
            return DailyRecommendation(
                id=UUID(data["id"]),
                user_id=user_id,
                date=rec_date,
                occasion=data["occasion"],
                context_hash=data.get("context_hash"),
                item_ids=data.get("item_ids", []),
                outfit_hash=data.get("outfit_hash"),
                regenerate_counter=data.get("regenerate_counter", 0),
                status=data.get("status", "active"),
                empty_reason=data.get("empty_reason"),
                recommendation_data=data.get("recommendation_data"),
            )
        return None

    def save_daily_recommendation(
        self,
        user_id: UUID,
        rec_date: date,
        occasion: str,
        item_ids: List[str],
        status: str = "active",
        empty_reason: Optional[Dict[str, Any]] = None,
        recommendation_data: Optional[Dict[str, Any]] = None,
        outfit_hash: Optional[str] = None,
        context_hash: Optional[str] = None,
        regenerate_counter: int = 0,
    ) -> DailyRecommendation:
        occ_norm = occasion.lower().strip()
        now_ts = datetime.now(timezone.utc)

        if self._check_tables():
            try:
                rec = (
                    self.db.query(DailyRecommendation)
                    .filter(
                        DailyRecommendation.user_id == user_id,
                        DailyRecommendation.date == rec_date,
                        DailyRecommendation.occasion.ilike(occ_norm),
                    )
                    .first()
                )
                if rec:
                    rec.item_ids = item_ids
                    rec.status = status
                    rec.empty_reason = empty_reason
                    rec.recommendation_data = recommendation_data
                    rec.outfit_hash = outfit_hash
                    rec.context_hash = context_hash
                    rec.regenerate_counter = regenerate_counter
                    rec.updated_at = now_ts
                else:
                    rec = DailyRecommendation(
                        user_id=user_id,
                        date=rec_date,
                        occasion=occ_norm,
                        item_ids=item_ids,
                        status=status,
                        empty_reason=empty_reason,
                        recommendation_data=recommendation_data,
                        outfit_hash=outfit_hash,
                        context_hash=context_hash,
                        regenerate_counter=regenerate_counter,
                    )
                    self.db.add(rec)
                self.db.commit()
                self.db.refresh(rec)
                return rec
            except Exception:
                self.db.rollback()

        # Fallback via LearnedPreference
        pref = self._get_learned_pref(user_id)
        scores = dict(pref.weather_scores or {})
        recs = dict(scores.get("_daily_recommendations", {}))
        key = f"{rec_date.isoformat()}_{occ_norm}"

        rec_dict = {
            "id": str(uuid.uuid4()),
            "user_id": str(user_id),
            "date": rec_date.isoformat(),
            "occasion": occ_norm,
            "item_ids": item_ids,
            "status": status,
            "empty_reason": empty_reason,
            "recommendation_data": recommendation_data,
            "outfit_hash": outfit_hash,
            "context_hash": context_hash,
            "regenerate_counter": regenerate_counter,
            "updated_at": now_ts.isoformat(),
        }
        recs[key] = rec_dict
        scores["_daily_recommendations"] = recs
        pref.weather_scores = scores
        flag_modified(pref, "weather_scores")
        self.db.commit()

        return DailyRecommendation(
            id=UUID(rec_dict["id"]),
            user_id=user_id,
            date=rec_date,
            occasion=occ_norm,
            item_ids=item_ids,
            status=status,
            empty_reason=empty_reason,
            recommendation_data=recommendation_data,
            outfit_hash=outfit_hash,
            context_hash=context_hash,
            regenerate_counter=regenerate_counter,
        )

    def mark_all_stale(self, user_id: UUID, item_id: Optional[UUID] = None) -> None:
        """Marks recommendations stale without deleting them or silently auto-regenerating."""
        if self._check_tables():
            try:
                q = self.db.query(DailyRecommendation).filter(
                    DailyRecommendation.user_id == user_id,
                    DailyRecommendation.status == "active",
                )
                for rec in q.all():
                    if item_id is None or str(item_id) in (rec.item_ids or []):
                        rec.status = "stale"
                        rec.updated_at = datetime.now(timezone.utc)
                self.db.commit()
                return
            except Exception:
                self.db.rollback()

        pref = self._get_learned_pref(user_id)
        scores = dict(pref.weather_scores or {})
        recs = dict(scores.get("_daily_recommendations", {}))
        for key, rec_dict in list(recs.items()):
            if rec_dict.get("status") == "active":
                if item_id is None or str(item_id) in rec_dict.get("item_ids", []):
                    updated = dict(rec_dict)
                    updated["status"] = "stale"
                    recs[key] = updated
        scores["_daily_recommendations"] = recs
        pref.weather_scores = scores
        flag_modified(pref, "weather_scores")
        self.db.commit()
