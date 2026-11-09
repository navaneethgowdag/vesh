import json
import uuid
from datetime import date, datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import inspect
from app.models.weekly_plan import WeeklyPlan, WeeklyPlanDay
from app.models.outfit import Outfit
from app.models.clothing import Clothing
from app.models.learned_preference import LearnedPreference


class WeeklyPlanRepository:
    """
    Repository for Weekly Plans with dual persistence:
    1. Direct physical PostgreSQL tables (weekly_plans, weekly_plan_days)
    2. Resilient JSONB fallback via LearnedPreference if physical DDL is restricted.
    """

    def __init__(self, db: Session):
        self.db = db
        self._has_tables = self._check_tables_exist()

    def _check_tables_exist(self) -> bool:
        try:
            insp = inspect(self.db.bind)
            table_names = insp.get_table_names()
            return "weekly_plans" in table_names and "weekly_plan_days" in table_names
        except Exception:
            return False

    # -------------------------------------------------------------------------
    # Physical Table Operations
    # -------------------------------------------------------------------------
    def _get_by_id_db(self, plan_id: UUID, user_id: UUID) -> Optional[WeeklyPlan]:
        return (
            self.db.query(WeeklyPlan)
            .options(
                joinedload(WeeklyPlan.days)
                .joinedload(WeeklyPlanDay.outfit)
                .joinedload(Outfit.clothing_items)
            )
            .filter(WeeklyPlan.id == plan_id, WeeklyPlan.user_id == user_id)
            .first()
        )

    def _get_by_week_db(self, user_id: UUID, week_start_date: date) -> Optional[WeeklyPlan]:
        return (
            self.db.query(WeeklyPlan)
            .options(
                joinedload(WeeklyPlan.days)
                .joinedload(WeeklyPlanDay.outfit)
                .joinedload(Outfit.clothing_items)
            )
            .filter(
                WeeklyPlan.user_id == user_id,
                WeeklyPlan.week_start_date == week_start_date,
            )
            .order_by(WeeklyPlan.created_at.desc())
            .first()
        )

    # -------------------------------------------------------------------------
    # Fallback JSONB Operations (LearnedPreference)
    # -------------------------------------------------------------------------
    def _get_fallback_store(self, user_id: UUID) -> Dict[str, Any]:
        pref = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
        if not pref:
            pref = LearnedPreference(user_id=user_id)
            self.db.add(pref)
            self.db.commit()
            self.db.refresh(pref)

        scores = dict(pref.weather_scores or {})
        return dict(scores.get("_weekly_plans", {}))

    def _dict_to_plan(self, d: Dict[str, Any]) -> WeeklyPlan:
        plan = WeeklyPlan(
            id=UUID(d["id"]) if isinstance(d["id"], str) else d["id"],
            user_id=UUID(d["user_id"]) if isinstance(d["user_id"], str) else d["user_id"],
            week_start_date=date.fromisoformat(d["week_start_date"]) if isinstance(d["week_start_date"], str) else d["week_start_date"],
            week_end_date=date.fromisoformat(d["week_end_date"]) if isinstance(d["week_end_date"], str) else d["week_end_date"],
            status=d.get("status", "active"),
            created_at=datetime.fromisoformat(d["created_at"]) if isinstance(d.get("created_at"), str) else datetime.now(timezone.utc),
            updated_at=datetime.fromisoformat(d["updated_at"]) if isinstance(d.get("updated_at"), str) else datetime.now(timezone.utc),
        )

        days_list = []
        for day_dict in d.get("days", []):
            day_obj = WeeklyPlanDay(
                id=UUID(day_dict["id"]) if isinstance(day_dict["id"], str) else day_dict["id"],
                weekly_plan_id=plan.id,
                plan_date=date.fromisoformat(day_dict["plan_date"]) if isinstance(day_dict["plan_date"], str) else day_dict["plan_date"],
                outfit_id=UUID(day_dict["outfit_id"]) if day_dict.get("outfit_id") else None,
                calendar_event_id=UUID(day_dict["calendar_event_id"]) if day_dict.get("calendar_event_id") else None,
                status=day_dict.get("status", "planned"),
                recommendation_explanation=day_dict.get("recommendation_explanation"),
            )
            if day_obj.outfit_id:
                outfit = self.db.query(Outfit).options(joinedload(Outfit.clothing_items)).filter(Outfit.id == day_obj.outfit_id).first()
                day_obj.outfit = outfit
            day_obj.weekly_plan = plan
            days_list.append(day_obj)

        days_list.sort(key=lambda x: x.plan_date)
        plan.days = days_list
        return plan

    def _plan_to_dict(self, plan: WeeklyPlan) -> Dict[str, Any]:
        return {
            "id": str(plan.id),
            "user_id": str(plan.user_id),
            "week_start_date": plan.week_start_date.isoformat(),
            "week_end_date": plan.week_end_date.isoformat(),
            "status": plan.status,
            "created_at": plan.created_at.isoformat() if plan.created_at else datetime.now(timezone.utc).isoformat(),
            "updated_at": plan.updated_at.isoformat() if plan.updated_at else datetime.now(timezone.utc).isoformat(),
            "days": [
                {
                    "id": str(day.id),
                    "weekly_plan_id": str(plan.id),
                    "plan_date": day.plan_date.isoformat(),
                    "outfit_id": str(day.outfit_id) if day.outfit_id else None,
                    "calendar_event_id": str(day.calendar_event_id) if day.calendar_event_id else None,
                    "status": day.status,
                    "recommendation_explanation": day.recommendation_explanation,
                }
                for day in (plan.days or [])
            ],
        }

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------
    def get_by_id(self, plan_id: UUID, user_id: UUID) -> Optional[WeeklyPlan]:
        if self._has_tables:
            try:
                return self._get_by_id_db(plan_id, user_id)
            except Exception:
                pass
        store = self._get_fallback_store(user_id)
        raw = store.get(str(plan_id))
        return self._dict_to_plan(raw) if raw else None

    def get_by_week(self, user_id: UUID, week_start_date: date) -> Optional[WeeklyPlan]:
        if self._has_tables:
            try:
                return self._get_by_week_db(user_id, week_start_date)
            except Exception:
                pass
        store = self._get_fallback_store(user_id)
        for raw in store.values():
            if raw.get("week_start_date") == week_start_date.isoformat():
                return self._dict_to_plan(raw)
        return None

    def get_active_or_latest(self, user_id: UUID, reference_date: Optional[date] = None) -> Optional[WeeklyPlan]:
        ref = reference_date or date.today()
        # Find plan that covers ref
        if self._has_tables:
            try:
                plan = (
                    self.db.query(WeeklyPlan)
                    .options(
                        joinedload(WeeklyPlan.days)
                        .joinedload(WeeklyPlanDay.outfit)
                        .joinedload(Outfit.clothing_items)
                    )
                    .filter(
                        WeeklyPlan.user_id == user_id,
                        WeeklyPlan.week_start_date <= ref,
                        WeeklyPlan.week_end_date >= ref,
                    )
                    .order_by(WeeklyPlan.created_at.desc())
                    .first()
                )
                if plan:
                    return plan
            except Exception:
                pass

        store = self._get_fallback_store(user_id)
        for raw in store.values():
            s_date = date.fromisoformat(raw["week_start_date"])
            e_date = date.fromisoformat(raw["week_end_date"])
            if s_date <= ref <= e_date:
                return self._dict_to_plan(raw)

        # Fallback to most recent
        if self._has_tables:
            try:
                return (
                    self.db.query(WeeklyPlan)
                    .options(
                        joinedload(WeeklyPlan.days)
                        .joinedload(WeeklyPlanDay.outfit)
                        .joinedload(Outfit.clothing_items)
                    )
                    .filter(WeeklyPlan.user_id == user_id)
                    .order_by(WeeklyPlan.week_start_date.desc())
                    .first()
                )
            except Exception:
                pass

        if store:
            sorted_raw = sorted(store.values(), key=lambda x: x["week_start_date"], reverse=True)
            return self._dict_to_plan(sorted_raw[0])
        return None

    def save_plan(self, plan: WeeklyPlan) -> WeeklyPlan:
        if self._has_tables:
            try:
                # Merge plan and days
                merged = self.db.merge(plan)
                self.db.commit()
                self.db.refresh(merged)
                return merged
            except Exception:
                self.db.rollback()

        # Fallback persistence in LearnedPreference JSONB
        pref = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == plan.user_id).first()
        if not pref:
            pref = LearnedPreference(user_id=plan.user_id)
            self.db.add(pref)
            self.db.commit()
            self.db.refresh(pref)

        from sqlalchemy.orm.attributes import flag_modified
        scores = dict(pref.weather_scores or {})
        plans_dict = dict(scores.get("_weekly_plans", {}))
        plans_dict[str(plan.id)] = self._plan_to_dict(plan)
        scores["_weekly_plans"] = plans_dict
        pref.weather_scores = scores
        flag_modified(pref, "weather_scores")
        self.db.commit()
        return plan

    def delete_plan(self, plan_id: UUID, user_id: UUID) -> bool:
        if self._has_tables:
            try:
                plan = self._get_by_id_db(plan_id, user_id)
                if plan:
                    self.db.delete(plan)
                    self.db.commit()
                    return True
            except Exception:
                self.db.rollback()

        pref = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
        if pref and pref.weather_scores:
            from sqlalchemy.orm.attributes import flag_modified
            scores = dict(pref.weather_scores)
            plans_dict = dict(scores.get("_weekly_plans", {}))
            if str(plan_id) in plans_dict:
                del plans_dict[str(plan_id)]
                scores["_weekly_plans"] = plans_dict
                pref.weather_scores = scores
                flag_modified(pref, "weather_scores")
                self.db.commit()
                return True
        return False
