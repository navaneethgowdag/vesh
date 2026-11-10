"""
TailorBird Laundry & Wear Tracking Service.
Implements the single source of truth for clothing availability and wear lifecycle:
- Exact day rule: limit reached on date D with wash_days N -> unavailable D+1..D+N, available D+N+1.
- Override resolution: Item override > Category override > Global default.
- Idempotent wear recording (1 wear per user, item, date).
- Wear undo with laundry status rollback.
- Lazy auto-return when queried for target_date.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
import uuid
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.clothing import Clothing
from app.models.outfit import Outfit
from app.models.laundry import UserLaundrySettings, WearLog
from app.repositories.laundry_repository import LaundryRepository


class LaundryService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = LaundryRepository(db)

    # -------------------------------------------------------------------------
    # Settings
    # -------------------------------------------------------------------------
    def get_settings(self, user_id: UUID) -> UserLaundrySettings:
        return self.repo.get_settings(user_id)

    def update_settings(self, user_id: UUID, settings_data: Dict[str, Any]) -> UserLaundrySettings:
        current = self.repo.get_settings(user_id)
        if "default_max_wears" in settings_data:
            val = int(settings_data["default_max_wears"])
            current.default_max_wears = max(1, min(30, val))
        if "default_wash_days" in settings_data:
            val = int(settings_data["default_wash_days"])
            current.default_wash_days = max(0, min(14, val))
        if "category_overrides" in settings_data:
            current.category_overrides = dict(settings_data["category_overrides"] or {})
        if "same_item_cooldown_days" in settings_data:
            val = int(settings_data["same_item_cooldown_days"])
            current.same_item_cooldown_days = max(0, min(7, val))
        if "auto_return_from_laundry" in settings_data:
            current.auto_return_from_laundry = bool(settings_data["auto_return_from_laundry"])

        saved = self.repo.save_settings(current)
        # Mark active daily recommendations stale without silently auto-regenerating (Rule 3.4 / 4.3)
        self.repo.mark_all_stale(user_id)
        return saved

    # -------------------------------------------------------------------------
    # Resolution Order: Item > Category > Global Default
    # -------------------------------------------------------------------------
    def get_effective_limits(
        self, item: Clothing, settings: Optional[UserLaundrySettings] = None
    ) -> Tuple[int, int, bool]:
        """
        Returns (max_wears, wash_days, track_laundry).
        Resolution order: item override > category override > global default.
        """
        if settings is None:
            settings = self.repo.get_settings(item.user_id)

        cat = (item.category or "").lower().strip()
        cat_overrides = (settings.category_overrides or {}).get(cat, {})

        # 1. max_wears
        if item.max_wears_override is not None:
            max_wears = item.max_wears_override
        elif cat_overrides.get("max_wears") is not None:
            max_wears = int(cat_overrides["max_wears"])
        else:
            max_wears = settings.default_max_wears if settings.default_max_wears is not None else 2

        # 2. wash_days
        if item.wash_days_override is not None:
            wash_days = item.wash_days_override
        elif cat_overrides.get("wash_days") is not None:
            wash_days = int(cat_overrides["wash_days"])
        else:
            wash_days = settings.default_wash_days if settings.default_wash_days is not None else 4

        # 3. track_laundry
        if "track_laundry" in item.laundry_data:
            track_laundry = bool(item.laundry_data["track_laundry"])
        elif "track_laundry" in cat_overrides:
            track_laundry = bool(cat_overrides["track_laundry"])
        else:
            track_laundry = item.track_laundry

        return max(1, min(30, max_wears)), max(0, min(14, wash_days)), track_laundry

    # -------------------------------------------------------------------------
    # Single Source of Truth: is_available
    # -------------------------------------------------------------------------
    def is_available(
        self,
        item: Clothing,
        target_date: date,
        settings: Optional[UserLaundrySettings] = None,
    ) -> Tuple[bool, Optional[str], Optional[date]]:
        """
        Single source of truth evaluating availability for a TARGET date.
        Returns: (is_available, status_reason, available_from)
        """
        if settings is None:
            settings = self.repo.get_settings(item.user_id)

        status = item.laundry_status or "clean"

        # If in_laundry:
        if status == "in_laundry":
            if settings.auto_return_from_laundry and item.available_from and target_date >= item.available_from:
                return True, None, None
            return False, "in_laundry", item.available_from

        # If unavailable:
        if status == "unavailable":
            if item.available_from and target_date >= item.available_from:
                return True, None, None
            return False, "unavailable", item.available_from

        # If clean:
        return True, None, None

    # -------------------------------------------------------------------------
    # Lazy Auto-Return
    # -------------------------------------------------------------------------
    def apply_lazy_returns(self, user_id: UUID, target_date: date) -> int:
        """
        Lazily resets items that reached their available_from date back to clean.
        Runs inside a transaction when reading wardrobe or generating recommendations for today.
        """
        settings = self.repo.get_settings(user_id)
        if not settings.auto_return_from_laundry:
            return 0

        items = self.db.query(Clothing).filter(Clothing.user_id == user_id).all()
        returned_count = 0

        for item in items:
            status = item.laundry_status
            if status in ("in_laundry", "unavailable") and item.available_from and target_date >= item.available_from:
                item.laundry_status = "clean"
                item.wear_count_since_wash = 0
                item.laundry_started_on = None
                item.available_from = None
                returned_count += 1

        if returned_count > 0:
            self.db.commit()

        return returned_count

    # -------------------------------------------------------------------------
    # Record Wear (Idempotent)
    # -------------------------------------------------------------------------
    def record_wear(
        self,
        user_id: UUID,
        item_ids: Optional[List[UUID]] = None,
        outfit_id: Optional[UUID] = None,
        target_date: Optional[date] = None,
        source: str = "daily_fit",
    ) -> Dict[str, Any]:
        """
        Records outfit/items wear idempotently.
        Exact day rule: if item reaches limit on date D and wash_days = N,
        unavailable D+1..D+N and available D+N+1.
        """
        if target_date is None:
            target_date = date.today()

        resolved_item_ids: List[UUID] = []
        if item_ids:
            resolved_item_ids.extend(item_ids)

        if outfit_id:
            outfit = self.db.query(Outfit).filter(Outfit.id == outfit_id, Outfit.user_id == user_id).first()
            if outfit and outfit.clothing_items:
                for c in outfit.clothing_items:
                    if c.id not in resolved_item_ids:
                        resolved_item_ids.append(c.id)

        if not resolved_item_ids:
            return {"success": False, "message": "No items specified", "items": []}

        settings = self.repo.get_settings(user_id)
        items = (
            self.db.query(Clothing)
            .filter(Clothing.user_id == user_id, Clothing.id.in_(resolved_item_ids))
            .all()
        )

        laundry_toasts: List[str] = []
        updated_items: List[Dict[str, Any]] = []

        for item in items:
            # Rule 3.1: Wearing an outfit twice on the same day must not double-count.
            already_worn = self.repo.has_worn_on_date(user_id=user_id, item_id=item.id, worn_on=target_date)
            if not already_worn:
                item.wear_count_since_wash = item.wear_count_since_wash + 1
                item.last_worn_on = target_date
                item.wear_count = (item.wear_count or 0) + 1

                # Write wear log
                log = WearLog(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    item_id=item.id,
                    outfit_id=outfit_id,
                    worn_on=target_date,
                    source=source,
                )
                self.repo.add_wear_log(log)

            max_wears, wash_days, track_laundry = self.get_effective_limits(item, settings)

            # Check if wear limit reached
            if track_laundry and item.wear_count_since_wash >= max_wears:
                item.laundry_status = "in_laundry"
                item.laundry_started_on = target_date
                # Exact day rule: unavailable D+1..D+N, available from D+N+1
                item.available_from = target_date + timedelta(days=wash_days + 1)
                back_day = item.available_from.strftime("%a")
                laundry_toasts.append(f"{item.name} goes to laundry, back on {back_day}")

            updated_items.append({
                "id": str(item.id),
                "name": item.name,
                "wear_count_since_wash": item.wear_count_since_wash,
                "laundry_status": item.laundry_status,
                "available_from": item.available_from.isoformat() if item.available_from else None,
                "max_wears": max_wears,
            })

        self.db.commit()

        # If an item went to laundry, mark active daily recommendations stale
        if laundry_toasts:
            for item in items:
                if item.laundry_status == "in_laundry":
                    self.repo.mark_all_stale(user_id, item_id=item.id)

        return {
            "success": True,
            "worn_date": target_date.isoformat(),
            "laundry_notifications": laundry_toasts,
            "items": updated_items,
        }

    # -------------------------------------------------------------------------
    # Undo Wear
    # -------------------------------------------------------------------------
    def undo_wear(
        self,
        user_id: UUID,
        item_ids: Optional[List[UUID]] = None,
        outfit_id: Optional[UUID] = None,
        target_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Reverts a wear: decrements wear_count_since_wash, marks wear_log undone,
        and reverts laundry state if it was triggered on that date.
        """
        if target_date is None:
            target_date = date.today()

        resolved_item_ids: List[UUID] = []
        if item_ids:
            resolved_item_ids.extend(item_ids)

        if outfit_id:
            outfit = self.db.query(Outfit).filter(Outfit.id == outfit_id, Outfit.user_id == user_id).first()
            if outfit and outfit.clothing_items:
                for c in outfit.clothing_items:
                    if c.id not in resolved_item_ids:
                        resolved_item_ids.append(c.id)

        if not resolved_item_ids:
            return {"success": False, "message": "No items to undo"}

        undone_ids = self.repo.undo_wear_logs(user_id, resolved_item_ids, target_date)
        items = (
            self.db.query(Clothing)
            .filter(Clothing.user_id == user_id, Clothing.id.in_(undone_ids))
            .all()
        )

        for item in items:
            item.wear_count_since_wash = max(0, item.wear_count_since_wash - 1)
            item.wear_count = max(0, (item.wear_count or 1) - 1)
            # Revert laundry status if it went to laundry on that date
            if item.laundry_status == "in_laundry" and item.laundry_started_on == target_date:
                item.laundry_status = "clean"
                item.laundry_started_on = None
                item.available_from = None

        self.db.commit()
        return {
            "success": True,
            "undone_count": len(undone_ids),
            "items": [
                {
                    "id": str(i.id),
                    "name": i.name,
                    "wear_count_since_wash": i.wear_count_since_wash,
                    "laundry_status": i.laundry_status,
                }
                for i in items
            ],
        }

    # -------------------------------------------------------------------------
    # Manual Actions
    # -------------------------------------------------------------------------
    def manual_laundry_action(
        self,
        user_id: UUID,
        item_id: UUID,
        action: str,
        return_date: Optional[date] = None,
    ) -> Clothing:
        item = self.db.query(Clothing).filter(Clothing.id == item_id, Clothing.user_id == user_id).first()
        if not item:
            raise ValueError("Clothing item not found or unauthorized")

        settings = self.repo.get_settings(user_id)
        max_wears, wash_days, _ = self.get_effective_limits(item, settings)
        today = date.today()

        if action == "wash_now":
            item.wear_count_since_wash = 0
            item.laundry_status = "clean"
            item.laundry_started_on = None
            item.available_from = None
        elif action == "send_to_laundry":
            item.laundry_status = "in_laundry"
            item.laundry_started_on = today
            item.available_from = return_date or (today + timedelta(days=wash_days + 1))
            self.repo.mark_all_stale(user_id, item_id=item.id)
        elif action == "mark_unavailable":
            item.laundry_status = "unavailable"
            item.available_from = return_date
            self.repo.mark_all_stale(user_id, item_id=item.id)
        elif action == "restore":
            item.laundry_status = "clean"
            item.wear_count_since_wash = 0
            item.laundry_started_on = None
            item.available_from = None
        else:
            raise ValueError(f"Unknown laundry action '{action}'")

        self.db.commit()
        self.db.refresh(item)
        return item
