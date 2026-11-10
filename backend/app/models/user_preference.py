import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    preferred_styles = Column(JSONB, default=list, nullable=False)
    preferred_colors = Column(JSONB, default=list, nullable=False)
    preferred_categories = Column(JSONB, default=list, nullable=False)
    preferred_fits = Column(JSONB, default=list, nullable=False)
    preferred_patterns = Column(JSONB, default=list, nullable=False)
    preferred_materials = Column(JSONB, default=list, nullable=False)
    preferred_occasions = Column(JSONB, default=list, nullable=False)
    preferred_seasons = Column(JSONB, default=list, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # API compatibility properties
    @property
    def styles(self):
        return self.preferred_styles or []

    @property
    def favorite_colors(self):
        return self.preferred_colors or []

    @property
    def disliked_colors(self):
        return self.avoided_colors

    @property
    def avoided_colors(self):
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("avoided_colors", [])
        return []

    @property
    def disliked_styles(self):
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("disliked_styles", [])
        return []

    @property
    def personalization_enabled(self) -> bool:
        if isinstance(self.preferred_fits, dict):
            val = self.preferred_fits.get("personalization_enabled")
            if val is not None:
                return bool(val)
        return True

    @property
    def diversity_preference(self) -> str:
        if isinstance(self.preferred_fits, dict):
            return str(self.preferred_fits.get("diversity_preference", "balanced"))
        return "balanced"

    @property
    def avoid_recently_worn_days(self) -> int:
        if isinstance(self.preferred_fits, dict):
            return int(self.preferred_fits.get("avoid_recently_worn_days", 7))
        return 7

    @property
    def comfort_priority(self) -> float:
        if isinstance(self.preferred_fits, dict):
            return float(self.preferred_fits.get("comfort_priority", 0.5))
        return 0.5

    @property
    def fits(self):
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("fits", [])
        return self.preferred_fits or []

    @property
    def preferred_brands(self):
        return []

    @property
    def favorite_occasions(self):
        return self.preferred_occasions or []

    @property
    def fashion_goals(self):
        return []

    @property
    def climate_preference(self):
        return "Moderate"

    @property
    def gender(self) -> str:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("gender", "")
        return ""

    @gender.setter
    def gender(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        data["gender"] = value
        self.preferred_fits = data

    @property
    def avatar_style(self) -> str:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("avatar_style", "neutral")
        return "neutral"

    @avatar_style.setter
    def avatar_style(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        data["avatar_style"] = value
        self.preferred_fits = data

    @property
    def styling_preference(self) -> str:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("styling_preference", "")
        return ""

    @property
    def budget_preference(self) -> str:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("budget_preference", "")
        return ""

    @property
    def country(self) -> str:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("country", "")
        return ""

    @property
    def preferred_language(self) -> str:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("preferred_language", "English")
        return "English"

    @property
    def date_of_birth(self) -> str:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("date_of_birth", "")
        return ""

    @property
    def onboarding_completed(self) -> bool:
        if isinstance(self.preferred_fits, dict):
            return bool(self.preferred_fits.get("onboarding_completed", False))
        return False

    @onboarding_completed.setter
    def onboarding_completed(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        data["onboarding_completed"] = bool(value)
        self.preferred_fits = data

    @property
    def lifestyle_occupation(self) -> dict:
        if isinstance(self.preferred_fits, dict):
            val = self.preferred_fits.get("lifestyle_occupation")
            if isinstance(val, dict):
                return val
            elif isinstance(val, str):
                return {"occupation": val, "details": {}}
        return {"occupation": "prefer_not_to_say", "details": {}}

    @lifestyle_occupation.setter
    def lifestyle_occupation(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        if isinstance(value, dict):
            data["lifestyle_occupation"] = value
        elif isinstance(value, str):
            data["lifestyle_occupation"] = {"occupation": value, "details": {}}
        self.preferred_fits = data

    @property
    def occupation_details(self) -> dict:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("occupation_details", {})
        return {}

    @property
    def weekly_routine(self) -> list:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("weekly_routine", [])
        return []

    @weekly_routine.setter
    def weekly_routine(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        data["weekly_routine"] = value if isinstance(value, list) else []
        self.preferred_fits = data

    @property
    def shopping_preferences(self) -> dict:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("shopping_preferences", {
                "budget_tier": "mid_range",
                "budget_per_item": None,
                "shopping_philosophy": "balanced",
                "preferred_categories": [],
                "preferred_platforms": []
            })
        return {
            "budget_tier": "mid_range",
            "budget_per_item": None,
            "shopping_philosophy": "balanced",
            "preferred_categories": [],
            "preferred_platforms": []
        }

    @shopping_preferences.setter
    def shopping_preferences(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        data["shopping_preferences"] = value if isinstance(value, dict) else {}
        self.preferred_fits = data

    @property
    def recommendation_settings(self) -> dict:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("recommendation_settings", {
                "comfort_priority": 0.5,
                "familiar_vs_new": "balanced",
                "repeat_frequency": "moderate",
                "variety_preference": "balanced"
            })
        return {
            "comfort_priority": 0.5,
            "familiar_vs_new": "balanced",
            "repeat_frequency": "moderate",
            "variety_preference": "balanced"
        }

    @recommendation_settings.setter
    def recommendation_settings(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        data["recommendation_settings"] = value if isinstance(value, dict) else {}
        self.preferred_fits = data

    @property
    def saved_products(self) -> list:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("saved_products", [])
        return []

    @saved_products.setter
    def saved_products(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        data["saved_products"] = value if isinstance(value, list) else []
        self.preferred_fits = data

    @property
    def dismissed_products(self) -> list:
        if isinstance(self.preferred_fits, dict):
            return self.preferred_fits.get("dismissed_products", [])
        return []

    @dismissed_products.setter
    def dismissed_products(self, value):
        if not isinstance(self.preferred_fits, dict):
            self.preferred_fits = {"fits": self.preferred_fits or []}
        data = dict(self.preferred_fits)
        data["dismissed_products"] = value if isinstance(value, list) else []
        self.preferred_fits = data

    user = relationship("User", back_populates="preference")
