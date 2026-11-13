import random
from datetime import datetime, date, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
import uuid
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.recommendation import Recommendation
from app.models.outfit import Outfit, outfit_clothing
from app.models.clothing import Clothing
from app.models.calendar_event import CalendarEvent
from app.repositories.user_repository import UserRepository
from app.repositories.wardrobe_repository import WardrobeRepository
from app.repositories.outfit_repository import OutfitRepository
from app.repositories.recommendation_repository import RecommendationRepository
from app.repositories.calendar_repository import CalendarRepository
from app.services.weather_service import weather_service
from app.services.personalization_service import PersonalizationService
from app.services.color_coordination_service import ColorCoordinationService
from app.services.laundry_service import LaundryService
from app.services.recommendation_ml_service import recommendation_ml_service
from app.core.occasion_profiles import get_occasion_profile, OCCASION_PROFILES
import logging

logger = logging.getLogger(__name__)


# -------------------------------------------------------------------------
# Taxonomy & Archetype Classification Helpers
# -------------------------------------------------------------------------

NEUTRAL_COLORS = {
    "black", "white", "grey", "gray", "beige", "cream", "tan", "navy",
    "brown", "cognac", "denim blue", "khaki", "off-white", "charcoal", "ivory"
}

HARMONIOUS_COLOR_PAIRS = {
    ("olive", "terracotta"),
    ("terracotta", "olive"),
    ("navy", "cognac"),
    ("cognac", "navy"),
    ("burgundy", "navy"),
    ("navy", "burgundy"),
    ("sage", "brown"),
    ("brown", "sage"),
    ("denim blue", "terracotta"),
    ("terracotta", "denim blue"),
    ("pastel pink", "grey"),
    ("grey", "pastel pink"),
    ("olive", "cream"),
    ("cream", "olive"),
    ("gold", "maroon"),
    ("maroon", "gold"),
    ("gold", "navy"),
    ("navy", "gold"),
    ("emerald", "gold"),
    ("gold", "emerald"),
    ("mustard", "navy"),
    ("navy", "mustard"),
}


def classify_garment(item: Clothing) -> str:
    """Classifies a wardrobe item into distinct recommendation archetypes."""
    cat = (item.category or "").lower().strip()
    sub = (item.subcategory or "").lower().strip()
    grp = (getattr(item, "category_group", None) or "").lower().strip()
    name = (item.name or "").lower().strip()

    # 1. Indian Ethnic
    if ("blouse" in cat or "blouse" in sub or "blouse" in name or "choli" in name) and (grp == "indian" or "choli" in name or "saree" in name or "lehenga" in name or "ethnic" in name):
        return "indian_blouse"
    if "saree" in cat or "saree" in sub or "sari" in cat or "sari" in sub or "saree" in name:
        return "indian_saree"
    if "kurti" in cat or "kurti" in sub or "kurti" in name:
        return "indian_kurti"
    if "kurta" in cat or "kurta" in sub or "kurta" in name:
        return "indian_kurta"
    if any(k in cat or k in sub or k in name for k in ["salwar", "churidar", "dhoti", "palazzo", "patiala"]):
        return "indian_bottom"
    if "lehenga" in cat or "lehenga" in sub or "lehenga" in name:
        return "indian_lehenga"
    if "dupatta" in cat or "dupatta" in sub or "dupatta" in name:
        return "indian_dupatta"
    if "sherwani" in cat or "sherwani" in sub or "sherwani" in name:
        return "indian_sherwani"

    # 2. Outerwear
    if any(k in cat or k in sub or k in name for k in ["outerwear", "jacket", "blazer", "coat", "cardigan", "trench", "overshirt"]):
        return "outerwear"

    # 3. Western Dress
    is_dress_shirt = "dress shirt" in name or ("shirt" in name and "dress" in name)
    is_explicit_top = any(k in cat or k in sub for k in ["shirt", "top", "tops", "t_shirt", "t-shirt", "tee"])
    if not is_dress_shirt and not is_explicit_top:
        if any(k in cat or k in sub or k in name for k in ["dress", "western_dress", "dresses", "gown", "frock"]):
            return "western_dress"

    # 4. Western Bottom
    if any(k in cat or k in sub or k in name for k in ["jeans", "pants", "trousers", "skirt", "shorts", "bottoms", "slacks", "chinos"]):
        return "western_bottom"

    # 5. Western Top
    if any(k in cat or k in sub or k in name for k in ["shirt", "t_shirt", "t-shirt", "tee", "top", "tops", "sweater", "hoodie", "tank", "polo"]):
        return "western_top"

    # 6. Footwear
    if any(k in cat or k in sub or k in name for k in ["shoes", "sneakers", "sandals", "heels", "flats", "formal_shoes", "boots", "loafers", "mojaris", "juttis", "footwear"]):
        return "footwear"

    # 7. Accessories
    if any(k in cat or k in sub or k in name for k in ["accessories", "bags", "handbag", "backpack", "belt", "watch", "scarf", "jewelry", "sunglasses"]):
        return "accessory"

    # Fallbacks based on category_group or standard category
    if grp == "western":
        return "western_top"
    elif grp == "indian":
        return "indian_kurta"
    elif grp == "footwear":
        return "footwear"
    elif grp == "accessories":
        return "accessory"

    return "western_top"


def get_garment_formality(item: Clothing) -> float:
    """Extracts or derives formality score (0.0 to 1.0) for a garment."""
    # 1. Direct attribute on model
    if hasattr(item, "formality") and item.formality is not None:
        try:
            f = float(item.formality)
            if 0.0 <= f <= 1.0:
                return round(f, 2)
        except Exception:
            pass

    # 2. Verified attributes from Phase 2
    va = getattr(item, "verified_attributes", {}) or {}
    if "formality" in va:
        try:
            f = float(va["formality"])
            if 0.0 <= f <= 1.0:
                return round(f, 2)
        except Exception:
            pass

    # 3. Category & style defaults
    c_type = classify_garment(item)
    style = (item.style or "").lower()
    name = (item.name or "").lower()
    cat = (item.category or "").lower()
    sub = (item.subcategory or "").lower()
    occ = (item.occasion or "").lower()

    base = 0.50
    if c_type in ("indian_sherwani", "indian_lehenga", "indian_saree"):
        base = 0.85
    elif c_type == "outerwear" and ("blazer" in cat or "blazer" in sub or "blazer" in name):
        base = 0.80
    elif c_type == "footwear" and any(k in name or k in sub for k in ["formal", "oxford", "derby", "heels"]):
        base = 0.75
    elif c_type == "western_dress":
        base = 0.70
    elif c_type in ("indian_kurta", "indian_kurti", "indian_blouse", "indian_bottom"):
        base = 0.60
    elif c_type == "western_top" and ("shirt" in name or "button" in name):
        base = 0.65
    elif c_type == "western_bottom" and ("pants" in name or "trousers" in name or "slacks" in name):
        base = 0.65
    elif c_type == "western_bottom" and "jeans" in name:
        base = 0.40
    elif c_type == "western_top" and ("t-shirt" in name or "tee" in name or "hoodie" in name):
        base = 0.25
    elif c_type == "western_bottom" and "shorts" in name:
        base = 0.20
    elif c_type == "footwear" and ("sneakers" in name or "sandals" in name):
        base = 0.35

    if "formal" in style or "black tie" in style or "formal" in name or "work" in occ or "office" in occ:
        base = min(1.0, base + 0.15)
    elif "casual" in style or "relaxed" in style or "casual" in occ:
        base = max(0.1, base - 0.10)

    return round(base, 2)


def score_garment_for_occasion(item: Clothing, occasion: str, custom_text: Optional[str] = None) -> float:
    """
    Computes an occasion-alignment score (0.05 to 0.99) for an individual wardrobe item.
    Used to sort candidate buckets before archetype combination generation.
    """
    occ = (occasion or "").lower()
    c_type = classify_garment(item)
    name = (item.name or "").lower()
    sub = (getattr(item, "subcategory", "") or "").lower()
    style = (getattr(item, "style", "") or "").lower()
    f = get_garment_formality(item)

    score = 0.50

    # 1. Gym / Sports
    if any(k in occ for k in ["sport", "gym", "workout", "athletic", "fitness"]):
        if any(w in name or w in style or w in sub for w in ["athletic", "gym", "sport", "workout", "runner", "track", "shorts", "sweat", "jogger", "training"]):
            score += 0.45
        elif any(w in name or w in sub for w in ["t-shirt", "t_shirt", "tee", "tank", "sneakers"]):
            score += 0.30
        if f > 0.55 or any(w in name or w in sub for w in ["blazer", "suit", "oxford", "trousers", "slacks", "loafer", "dress", "saree"]):
            score -= 0.40

    # 2. Office / Work
    elif any(k in occ for k in ["work", "office"]):
        if any(w in name or w in sub or w in style for w in ["shirt", "oxford", "trousers", "slacks", "chinos", "blazer", "formal", "smart", "polo"]):
            score += 0.42
        elif c_type in ("indian_kurta", "indian_kurti", "western_dress") and f >= 0.60:
            score += 0.35
        elif c_type == "footwear" and any(w in name or w in sub for w in ["loafer", "derby", "oxford", "formal"]):
            score += 0.35
        if f < 0.40 or any(w in name for w in ["gym", "athletic", "distressed", "ripped", "sweat"]):
            score -= 0.35

    # 3. Business meeting / Presentation / Interview / Formal event
    elif any(k in occ for k in ["business", "presentation", "interview", "formal"]):
        if any(w in name or w in sub or w in style for w in ["blazer", "suit", "tuxedo", "oxford", "formal", "dress shirt", "tailored"]):
            score += 0.45
        elif any(w in name or w in sub for w in ["trousers", "slacks", "loafer", "derby"]):
            score += 0.35
        if f < 0.60 or any(w in name for w in ["gym", "casual", "t-shirt", "tee", "shorts", "sneakers", "hoodie"]):
            score -= 0.40

    # 4. Wedding / Festival
    elif any(k in occ for k in ["wedding", "festive", "traditional", "festival"]):
        if c_type in ("indian_saree", "indian_lehenga", "indian_sherwani", "indian_blouse", "indian_dupatta"):
            score += 0.50
        elif c_type in ("indian_kurta", "indian_kurti") or any(w in style for w in ["ethnic", "traditional"]):
            score += 0.40
        elif "blazer" in name or "suit" in name or f >= 0.85:
            score += 0.30
        if any(w in name for w in ["gym", "sport", "shorts", "distressed"]):
            score -= 0.40

    # 5. Party
    elif "party" in occ:
        if any(w in style or w in name for w in ["party", "chic", "bold", "leather", "black", "silk", "cocktail", "blazer", "chelsea", "statement"]):
            score += 0.42
        elif c_type in ("western_dress", "outerwear"):
            score += 0.30
        if any(w in name for w in ["gym", "athletic", "sweatpants", "lounge"]):
            score -= 0.35

    # 6. Date
    elif "date" in occ:
        if any(w in style or w in name for w in ["chic", "elegant", "smart", "knit", "blazer", "fitted", "dark denim", "chelsea", "loafer"]):
            score += 0.38
        elif c_type in ("western_dress", "western_top") and f >= 0.50:
            score += 0.25
        if any(w in name for w in ["gym", "sweatpants", "flip", "distressed"]):
            score -= 0.35

    # 7. College / Everyday / Casual outing / Travel
    elif any(k in occ for k in ["college", "everyday", "outing", "travel", "casual"]):
        if any(w in name or w in sub or w in style for w in ["tee", "t_shirt", "jeans", "chinos", "sneakers", "casual", "hoodie", "polo", "kurti", "flats"]):
            score += 0.35
        if f > 0.85 or any(w in name for w in ["tuxedo", "ballgown", "sherwani"]):
            score -= 0.35

    return max(0.05, min(0.99, score))


# -------------------------------------------------------------------------
# RecommendationService
# -------------------------------------------------------------------------

class RecommendationService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.wardrobe_repo = WardrobeRepository(db)
        self.outfit_repo = OutfitRepository(db)
        self.rec_repo = RecommendationRepository(db)
        self.calendar_repo = CalendarRepository(db)
        self.personalization_service = PersonalizationService(db)

    # ---------------------------------------------------------------------
    # Wardrobe-Based AI Outfit Recommendation Generator
    # ---------------------------------------------------------------------
    async def generate_recommendations(
        self,
        user_id: UUID,
        calendar_event_id: Optional[UUID] = None,
        recommendation_mode: str = "general",
        occasion: Optional[str] = None,
        custom_occasion: Optional[str] = None,
        target_date: Optional[date] = None,
        target_time: Optional[str] = None,
        location_context: Optional[str] = None,
        dress_code: Optional[str] = None,
        weather_preference: str = "automatic",
        additional_context: Optional[str] = None,
        excluded_item_ids: Optional[List[UUID]] = None,
        preferred_item_ids: Optional[List[UUID]] = None,
        outfit_preference: Optional[str] = "any",
        formality: Optional[float] = None,
        preferred_colors: Optional[List[str]] = None,
        avoided_colors: Optional[List[str]] = None,
        specific_clothing_id: Optional[UUID] = None,
        limit: int = 1,
        city: str = "New York",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        item_ids_worn_yesterday: Optional[Set[UUID]] = None,
        force_regenerate: bool = False,
        include_luxury: bool = False,
        attendee_role: str = "guest",
        wardrobe_group: Optional[str] = None,
    ) -> List[Recommendation]:
        """
        Wardrobe-Based AI Outfit Recommendation Engine.
        Supports three flexible paths:
        - Path A: Calendar-assisted recommendations (optional calendar_event_id with user occasion override).
        - Path B: Manual occasion-based recommendations (13 controlled occasions, date, context).
        - Path C: General outfit recommendations (frictionless 'Suggest an outfit for me').
        
        Guaranteed properties:
        - Recommends ONLY actual user clothing items (no mocks).
        - Footwear is optional when absent from the wardrobe.
        - Weather is optional and gracefully handles offline/ignored mode.
        - Strict user isolation.
        """
        # 1. MODE & CONTEXT RESOLUTION (Calendar is OPTIONAL, Event Awareness Enforced)
        from app.services.event_classifier_service import EventClassifierService
        from app.models.wear_history import WearHistory
        from datetime import timedelta

        event: Optional[CalendarEvent] = None
        event_notes = ""
        target_date = target_date or date.today()

        day_events: List[Any] = []
        if calendar_event_id:
            event = self.calendar_repo.get_by_id(calendar_event_id, user_id=user_id)
            if not event or event.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Specified calendar event was not found or does not belong to you.",
                )
            target_date = event.event_date or target_date
            location_context = location_context or getattr(event, "location", None)
            event_notes = event.notes or ""
            day_events = [event]
        elif recommendation_mode == "calendar":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Calendar event ID is required when recommendation_mode is 'calendar'.",
            )
        else:
            # Query any scheduled calendar events for target_date to provide event awareness
            try:
                day_events = self.calendar_repo.list_for_user(
                    user_id=user_id,
                    start_date=target_date,
                    end_date=target_date,
                    limit=10,
                )
            except Exception:
                day_events = []

        # Multi-event resolution & Event classification (14 categories, 5 tones, 5 dress codes)
        day_event_context = EventClassifierService.resolve_day_events(day_events)
        target_event_category = day_event_context["category"]
        target_event_tone = day_event_context["tone"]
        target_event_dress_code = dress_code or day_event_context["dress_code"]
        target_event_formality = formality if formality is not None else day_event_context["formality"]
        event_rationale = day_event_context["rationale"]

        # -----------------------------------------------------------------
        # CONTEXT PRIORITY RESOLUTION:
        # 1. Calendar event for today
        # 2. Selected occasion (explicit user override)
        # 3. User styling preferences & Weekly routine
        # 4. Lifestyle & occupation fallback
        # 5. Weather conditions
        # 6. Wardrobe availability
        # 7. Wear history
        # -----------------------------------------------------------------
        user_pref = self.user_repo.get_preferences(user_id)
        weekday_name = target_date.strftime("%A") if target_date else datetime.now().strftime("%A")

        routine_entry = None
        if user_pref and user_pref.weekly_routine:
            for r in user_pref.weekly_routine:
                if isinstance(r, dict) and r.get("day", "").lower() == weekday_name.lower():
                    routine_entry = r
                    break

        lifestyle = user_pref.lifestyle_occupation if user_pref else {}
        occupation = (lifestyle.get("occupation") or "").lower() if isinstance(lifestyle, dict) else ""

        has_explicit_occasion = bool(occasion and str(occasion).strip() and str(occasion).strip().lower() != "general")

        from app.core.taxonomy import normalize_occasion

        if has_explicit_occasion:
            if occasion in ("Custom occasion", "Custom") or custom_occasion:
                target_occasion = custom_occasion or "Custom occasion"
            else:
                canon_def = normalize_occasion(occasion)
                if not canon_def:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Unsupported occasion: '{occasion}'. Please select a valid occasion from the supported taxonomy.",
                    )
                target_occasion = canon_def.display_name
        elif event and event.occasion:
            canon_def = normalize_occasion(event.occasion)
            target_occasion = canon_def.display_name if canon_def else event.occasion
        elif day_events and target_event_category != "other":
            canon_def = normalize_occasion(target_event_category)
            target_occasion = canon_def.display_name if canon_def else target_event_category.replace("_", " ").title()
        elif routine_entry:
            act = routine_entry.get("activity", "")
            dc = routine_entry.get("dress_code", "")
            if act in ("Work", "Office"):
                target_occasion = "Office"
            elif act in ("College", "Study"):
                target_occasion = "College"
            elif act in ("Gym", "Sports", "Workout"):
                target_occasion = "Gym"
            elif act in ("Outing", "Party"):
                target_occasion = "Casual Outing"
            elif dc:
                canon_dc = normalize_occasion(dc)
                target_occasion = canon_dc.display_name if canon_dc else dc
            else:
                target_occasion = "Everyday"
            if dc and not target_event_dress_code:
                target_event_dress_code = dc
        elif occupation:
            if occupation == "student":
                target_occasion = "College"
            elif occupation in ("working_professional", "freelancer"):
                target_occasion = "Office"
            else:
                target_occasion = "Everyday"
        else:
            target_occasion = "Everyday"

        # Align event classifier parameters with resolved target occasion
        occ_lower = target_occasion.lower()
        if any(k in occ_lower for k in ["gym", "sport", "workout", "athletic"]):
            target_event_category = "sports_fitness"
            target_event_dress_code = target_event_dress_code or "athletic"
            target_event_formality = 0.15 if formality is None else formality
        elif any(k in occ_lower for k in ["business meeting", "interview"]):
            target_event_category = "business_meeting"
            target_event_dress_code = target_event_dress_code or "formal"
            target_event_formality = 0.85 if formality is None else formality
        elif any(k in occ_lower for k in ["office", "work", "presentation"]):
            target_event_category = "work_office"
            target_event_dress_code = target_event_dress_code or "smart_casual"
            target_event_formality = 0.75 if formality is None else formality
        elif any(k in occ_lower for k in ["wedding"]):
            target_event_category = "wedding"
            target_event_dress_code = target_event_dress_code or "festive"
            target_event_formality = 0.95 if formality is None else formality
        elif any(k in occ_lower for k in ["festival", "festive"]):
            target_event_category = "festival"
            target_event_dress_code = target_event_dress_code or "festive"
            target_event_formality = 0.90 if formality is None else formality
        elif any(k in occ_lower for k in ["party"]):
            target_event_category = "party_nightlife"
            target_event_dress_code = target_event_dress_code or "party"
            target_event_formality = 0.70 if formality is None else formality
        elif any(k in occ_lower for k in ["date"]):
            target_event_category = "date_romantic"
            target_event_dress_code = target_event_dress_code or "smart_casual"
            target_event_formality = 0.65 if formality is None else formality
        elif any(k in occ_lower for k in ["formal event", "black tie", "gala"]):
            target_event_category = "formal_event"
            target_event_dress_code = target_event_dress_code or "black_tie"
            target_event_formality = 0.95 if formality is None else formality
        elif any(k in occ_lower for k in ["travel"]):
            target_event_category = "travel_trip"
            target_event_dress_code = target_event_dress_code or "comfortable_casual"
            target_event_formality = 0.40 if formality is None else formality
        elif any(k in occ_lower for k in ["college"]):
            target_event_category = "college_campus"
            target_event_dress_code = target_event_dress_code or "casual"
            target_event_formality = 0.35 if formality is None else formality
        elif any(k in occ_lower for k in ["casual outing", "family"]):
            target_event_category = "casual_outing"
            target_event_dress_code = target_event_dress_code or "casual"
            target_event_formality = 0.45 if formality is None else formality
        else:
            target_event_category = "casual_daily"
            target_event_dress_code = target_event_dress_code or "casual"
            target_event_formality = 0.40 if formality is None else formality

        # 1. CONTEXT RESOLUTION & LAUNDRY LAZY RETURNS
        laundry_service = LaundryService(self.db)
        laundry_service.apply_lazy_returns(user_id, target_date)
        laundry_settings = laundry_service.get_settings(user_id)
        occasion_prof = get_occasion_profile(target_occasion)

        # Check for unexpired recommendation for this exact user, date, and occasion
        if not force_regenerate and limit == 1 and not preferred_item_ids and not excluded_item_ids and not specific_clothing_id:
            active_rec = self.get_active_recommendation(
                user_id=user_id,
                occasion=target_occasion,
                target_date=target_date,
                calendar_event_id=calendar_event_id,
            )
            if active_rec:
                return [active_rec]

        # 2. WEATHER CALIBRATION (Step 1)
        if weather_preference == "ignore":
            temp = 22.0
            feels_like = 22.0
            humidity = 50
            rain_prob = 0
            wind_speed = 5.0
            condition = "Pleasant (Ignored)"
            target_season = "All-Season"
            weather = {
                "city": city,
                "temp": temp,
                "feels_like": feels_like,
                "humidity": humidity,
                "rain_probability": rain_prob,
                "wind_speed": wind_speed,
                "condition": condition,
                "weather_ignored": True,
            }
        else:
            try:
                weather = await weather_service.get_current_weather(
                    city=city,
                    latitude=latitude,
                    longitude=longitude,
                )
                temp = float(weather.get("temp", 22.0))
                feels_like = float(weather.get("feels_like", temp))
                humidity = int(weather.get("humidity", 50))
                rain_prob = int(weather.get("rain_probability", 0))
                wind_speed = float(weather.get("wind_speed", 0.0))
                condition = weather.get("condition", "Pleasant")
            except Exception:
                temp = 22.0
                feels_like = 22.0
                humidity = 50
                rain_prob = 10
                wind_speed = 5.0
                condition = "Pleasant"
                weather = {
                    "city": city,
                    "temp": temp,
                    "feels_like": feels_like,
                    "humidity": humidity,
                    "rain_probability": rain_prob,
                    "wind_speed": wind_speed,
                    "condition": condition,
                }

            if temp >= 25.0:
                target_season = "Summer"
            elif temp <= 12.0:
                target_season = "Winter"
            elif temp <= 18.0:
                target_season = "Autumn"
            else:
                target_season = "Spring"

        # Query wear history in the past 14 days for repetition avoidance
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=14)
        recent_wears = []
        try:
            recent_wears = (
                self.db.query(WearHistory)
                .filter(
                    WearHistory.user_id == user_id,
                    WearHistory.worn_at >= cutoff_date,
                )
                .all()
            )
        except Exception as we_err:
            logger.warning(f"Could not load wear history: {we_err}")

        yesterday_date = target_date - timedelta(days=1)
        outfit_ids_worn_yesterday = set()
        outfit_ids_worn_2_3_days = set()
        item_ids_worn_yesterday_set = set(item_ids_worn_yesterday) if item_ids_worn_yesterday else set()

        for w in recent_wears:
            if not w.worn_at:
                continue
            w_date = w.worn_at.date()
            days_ago = (target_date - w_date).days
            if days_ago == 1:
                if w.outfit_id:
                    outfit_ids_worn_yesterday.add(w.outfit_id)
                if w.outfit and w.outfit.clothing_items:
                    for ci in w.outfit.clothing_items:
                        item_ids_worn_yesterday_set.add(ci.id)
            elif 2 <= days_ago <= 3:
                if w.outfit_id:
                    outfit_ids_worn_2_3_days.add(w.outfit_id)

        item_ids_worn_yesterday = item_ids_worn_yesterday_set

        # 3. WARDROBE RETRIEVAL & STEP 2 HARD FILTERS (with removal counters)
        raw_wardrobe = self.wardrobe_repo.list_for_user(user_id, limit=300)
        filter_counts: Dict[str, Any] = {
            "pending_review": 0,
            "not_accepted": 0,
            "in_laundry": 0,
            "unavailable": 0,
            "category_mismatch": 0,
            "formality_mismatch": 0,
            "weather_rule": 0,
            "earliest_laundry_return": None,
        }

        eligible_wardrobe: List[Clothing] = []

        for item in (raw_wardrobe or []):
            # 1. Review required
            if getattr(item, "review_required", False):
                filter_counts["pending_review"] += 1
                continue

            # 2. Not accepted or failed
            if getattr(item, "processing_status", "") == "failed" or getattr(item, "is_finalized", True) is False:
                filter_counts["not_accepted"] += 1
                continue

            # 3. Availability for target_date (Single source of truth)
            is_avail, avail_reason, avail_from = laundry_service.is_available(item, target_date, laundry_settings)
            if not is_avail:
                if avail_reason == "in_laundry":
                    filter_counts["in_laundry"] += 1
                    if avail_from:
                        if filter_counts["earliest_laundry_return"] is None or avail_from < filter_counts["earliest_laundry_return"]:
                            filter_counts["earliest_laundry_return"] = avail_from
                else:
                    filter_counts["unavailable"] += 1
                continue

            # 3b. Wardrobe collection group filtering (Part 5)
            if wardrobe_group:
                wg = wardrobe_group.lower().strip()
                item_groups = [g.lower() for g in getattr(item, "wardrobe_groups", [])]
                if wg not in item_groups:
                    continue

            # 3c. Occasion Vault: Reserved & In-Care status (Part 6)
            if getattr(item, "reserved_status", "available") in ("reserved", "in_care"):
                filter_counts["unavailable"] += 1
                continue

            # 3d. Occasion Vault: Luxury & Special Wear Tier Isolation (Part 6.3)
            is_special = (getattr(item, "wear_tier", "daily") == "luxury_special") or getattr(item, "is_luxury", False)
            if is_special:
                # Protect special/luxury piece from low-formality everyday recommendations
                if occasion_prof["target_formality"] < 0.75 and not include_luxury:
                    filter_counts["category_mismatch"] += 1
                    continue

            # 3e. Occasion Vault: Special-use restrictions & whitelists
            spec_rest = getattr(item, "special_use_restriction", "none")
            if spec_rest == "special_occasions_only":
                if occasion_prof["target_formality"] < 0.75 and not include_luxury:
                    filter_counts["category_mismatch"] += 1
                    continue
            elif spec_rest == "custom_occasions_only":
                suit_occs = [s.lower() for s in getattr(item, "suitable_occasions", [])]
                if suit_occs and not any(k in target_occasion.lower() for k in suit_occs) and not include_luxury:
                    filter_counts["category_mismatch"] += 1
                    continue

            suit_occs = [s.lower() for s in getattr(item, "suitable_occasions", [])]
            if suit_occs and not include_luxury:
                if not any(k in target_occasion.lower() or target_occasion.lower() in k for k in suit_occs):
                    filter_counts["category_mismatch"] += 1
                    continue

            # 4. Occasion disallowed categories
            c_type = classify_garment(item)
            cat_name = (item.category or "").lower()
            subcat_name = (item.subcategory or "").lower()
            disallowed = occasion_prof.get("disallowed_categories", set())
            if c_type in disallowed or any(d in cat_name or d in subcat_name for d in disallowed):
                filter_counts["category_mismatch"] += 1
                continue

            # 5. Formality within range
            item_form = getattr(item, "formality", None)
            if item_form is not None:
                if item_form < occasion_prof["min_formality"] - 0.15 or item_form > occasion_prof["max_formality"] + 0.15:
                    if c_type not in occasion_prof.get("preferred_categories", set()):
                        filter_counts["formality_mismatch"] += 1
                        continue

            # 6. Weather hard rules
            if rain_prob > 40 and c_type == "footwear":
                if any(k in subcat_name or k in (item.name or "").lower() for k in ["sandal", "flip_flop", "slider", "open"]):
                    filter_counts["weather_rule"] += 1
                    continue
            if temp < 15 and c_type == "western_bottom":
                # Gym and workout shorts are worn indoors, don't filter them out due to outdoor weather
                is_active_occasion = any(k in (target_occasion or "").lower() for k in ["gym", "sport", "workout", "athletic", "fitness"])
                if ("short" in subcat_name or "short" in (item.name or "").lower()) and not is_active_occasion:
                    filter_counts["weather_rule"] += 1
                    continue

            eligible_wardrobe.append(item)

        # Classify items into taxonomy buckets
        buckets: Dict[str, List[Clothing]] = {
            "western_top": [],
            "western_bottom": [],
            "western_dress": [],
            "outerwear": [],
            "indian_saree": [],
            "indian_blouse": [],
            "indian_kurta": [],
            "indian_kurti": [],
            "indian_bottom": [],
            "indian_lehenga": [],
            "indian_dupatta": [],
            "indian_sherwani": [],
            "footwear": [],
            "accessory": [],
        }

        for item in eligible_wardrobe:
            c_type = classify_garment(item)
            if c_type in buckets:
                buckets[c_type].append(item)

        # Audit if ANY valid outfit template can be constructed
        can_western_two_piece = bool(buckets["western_top"] and buckets["western_bottom"])
        can_western_dress = bool(buckets["western_dress"])
        can_indian_saree = bool(buckets["indian_saree"])
        can_indian_kurta = bool(buckets["indian_kurta"] and (buckets["indian_bottom"] or buckets["western_bottom"]))
        can_indian_kurti = bool(buckets["indian_kurti"] and (buckets["indian_bottom"] or buckets["western_bottom"]))
        can_indian_lehenga = bool(buckets["indian_lehenga"])
        can_indian_sherwani = bool(buckets["indian_sherwani"] and (buckets["indian_bottom"] or buckets["western_bottom"]))

        any_archetype_possible = any([
            can_western_two_piece,
            can_western_dress,
            can_indian_saree,
            can_indian_kurta,
            can_indian_kurti,
            can_indian_lehenga,
            can_indian_sherwani,
        ])

        # RULE 4.4a: NO ITEMS FOUND / EMPTY STATE
        if not eligible_wardrobe or not any_archetype_possible:
            earliest_dt = filter_counts["earliest_laundry_return"]
            earliest_str = earliest_dt.strftime("%a") if isinstance(earliest_dt, date) else ""

            if filter_counts["in_laundry"] > 0 and (not eligible_wardrobe or filter_counts["in_laundry"] >= len(eligible_wardrobe)):
                msg = f"All your {target_occasion} clothes are in laundry or unavailable."
                if earliest_str:
                    msg += f" Back on {earliest_str}."
                action_type = "laundry"
            elif filter_counts["pending_review"] > 0 and not eligible_wardrobe:
                msg = f"You have {filter_counts['pending_review']} items waiting for review."
                action_type = "review_pending"
            elif filter_counts["weather_rule"] > 0 and not eligible_wardrobe:
                msg = f"No clothes found for {target_occasion} suitable for current weather conditions."
                action_type = "weather"
            else:
                msg = f"Your wardrobe has no {target_occasion}-suitable clothes yet."
                action_type = "gap_analysis"

            empty_rec = Recommendation(
                id=uuid.uuid4(),
                user_id=user_id,
                outfit_id=None,
                temperature=temp,
                feels_like_temperature=feels_like,
                humidity=float(humidity),
                weather_condition=condition,
                rain_probability=float(rain_prob),
                occasion=target_occasion,
                season=target_season,
                recommendation_score=0.0,
            )
            empty_rec.status = "no_items"
            empty_rec.can_wear = False
            filter_counts_serializable = {
                k: (v.isoformat() if isinstance(v, date) else v)
                for k, v in filter_counts.items()
            }
            empty_rec.empty_reason = {
                "message": msg,
                "action": action_type,
                "earliest_return": earliest_str,
                "filter_counts": filter_counts_serializable,
            }
            empty_rec.filter_counts = filter_counts_serializable
            empty_rec._custom_reasons = [msg]
            empty_rec._custom_context = {
                "occasion": target_occasion,
                "reasons": [msg],
                "status": "no_items",
                "empty_reason": empty_rec.empty_reason,
            }
            empty_rec._custom_reasoning = {
                "compatibility": 0.0,
                "occasion": target_occasion,
            }

            # Persist empty state cache
            laundry_service.repo.save_daily_recommendation(
                user_id=user_id,
                rec_date=target_date,
                occasion=target_occasion,
                item_ids=[],
                status="no_items",
                empty_reason=empty_rec.empty_reason,
                regenerate_counter=0,
            )
            return [empty_rec]

        # 4. CANDIDATE COMBINATION GENERATOR
        candidates = self._generate_archetype_candidates(
            buckets=buckets,
            outfit_preference=(outfit_preference or "any").lower(),
            temp=temp,
            rain_prob=rain_prob,
            target_occasion=target_occasion,
            custom_occasion=custom_occasion,
            excluded_item_ids=set(excluded_item_ids or []),
        )

        if not candidates:
            # Fallback: assemble any available top + bottom (+ footwear if present)
            fallback = []
            for b_name in ["western_top", "indian_kurta", "indian_kurti", "western_dress", "indian_saree"]:
                if buckets[b_name]:
                    fallback.append(buckets[b_name][0])
                    break
            for b_name in ["western_bottom", "indian_bottom", "indian_blouse"]:
                if buckets[b_name]:
                    fallback.append(buckets[b_name][0])
                    break
            if buckets["footwear"]:
                fallback.append(buckets["footwear"][0])
            if fallback:
                candidates = [fallback]
            else:
                earliest_dt = filter_counts["earliest_laundry_return"]
                earliest_str = earliest_dt.strftime("%a") if isinstance(earliest_dt, date) else ""
                msg = f"Your wardrobe has no {target_occasion}-suitable clothes yet."
                empty_rec = Recommendation(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    outfit_id=None,
                    temperature=temp,
                    feels_like_temperature=feels_like,
                    humidity=float(humidity),
                    weather_condition=condition,
                    rain_probability=float(rain_prob),
                    occasion=target_occasion,
                    season=target_season,
                    recommendation_score=0.0,
                )
                empty_rec.status = "no_items"
                empty_rec.can_wear = False
                empty_rec.empty_reason = {
                    "message": msg,
                    "action": "gap_analysis",
                    "earliest_return": earliest_str,
                    "filter_counts": {
                        k: (v.isoformat() if isinstance(v, date) else v)
                        for k, v in filter_counts.items()
                    },
                }
                empty_rec.filter_counts = empty_rec.empty_reason["filter_counts"]
                empty_rec._custom_reasons = [msg]
                empty_rec._custom_context = {
                    "occasion": target_occasion,
                    "reasons": [msg],
                    "status": "no_items",
                    "empty_reason": empty_rec.empty_reason,
                }
                empty_rec._custom_reasoning = {
                    "compatibility": 0.0,
                    "occasion": target_occasion,
                }
                laundry_service.repo.save_daily_recommendation(
                    user_id=user_id,
                    rec_date=target_date,
                    occasion=target_occasion,
                    item_ids=[],
                    status="no_items",
                    empty_reason=empty_rec.empty_reason,
                    regenerate_counter=0,
                )
                return [empty_rec]

        # 5. HARD FILTERING
        user_pref = self.user_repo.get_preferences(user_id)
        learned_pref = self.user_repo.get_or_create_learned_preferences(user_id)
        recent_recs = self.rec_repo.list_history(user_id, limit=20)
        recent_outfit_ids = {r.outfit_id for r in recent_recs if r.outfit_id}

        filtered_candidates = []
        avoided_colors_set = set(c.lower().strip() for c in (avoided_colors or []))
        excluded_set = set(excluded_item_ids or [])
        preferred_set = set(preferred_item_ids or [])

        for items in candidates:
            # A. Excluded Items Hard Filter
            if excluded_set and any(i.id in excluded_set for i in items):
                continue

            # B. Specific Clothing ID Lock-In
            if specific_clothing_id and not any(i.id == specific_clothing_id for i in items):
                continue

            # C. Avoided Colors Exclusion
            if avoided_colors_set:
                has_avoided = False
                for it in items:
                    c1 = (it.color or "").lower().strip()
                    c2 = (it.secondary_color or "").lower().strip()
                    if c1 in avoided_colors_set or c2 in avoided_colors_set:
                        has_avoided = True
                        break
                if has_avoided:
                    continue

            # D. Formality Delta Filter: max delta <= 0.40
            formalities = [get_garment_formality(i) for i in items]
            delta_formality = max(formalities) - min(formalities) if formalities else 0.0
            if delta_formality > 0.40:
                continue

            # E. Dress Code / Target Formality Filter
            avg_formality = sum(formalities) / len(formalities) if formalities else 0.5
            effective_formality = formality if formality is not None else target_event_formality
            if effective_formality is not None:
                if abs(avg_formality - effective_formality) > 0.45:
                    continue
            effective_dc = dress_code or target_event_dress_code
            if effective_dc:
                dc_lower = effective_dc.lower()
                if any(k in dc_lower for k in ["formal", "black tie", "black-tie"]):
                    if avg_formality < 0.60:
                        continue
                elif any(k in dc_lower for k in ["smart casual", "business casual"]):
                    if avg_formality < 0.40 or avg_formality > 0.85:
                        continue
                elif any(k in dc_lower for k in ["casual", "relaxed"]):
                    if avg_formality > 0.65:
                        continue

            # F. Occasion Clash Hard Filter
            if not self._passes_occasion_hard_filter(items, target_occasion):
                continue

            # G. Weather Suitability Hard Filter (if weather not ignored)
            if weather_preference != "ignore":
                if temp < 14.0:
                    # Cold weather: reject sleeveless outfits without outerwear
                    has_outerwear = any(classify_garment(i) == "outerwear" for i in items)
                    has_sleeveless_without_layer = any(
                        (getattr(i, "sleeve_type", None) or "").lower() == "sleeveless"
                        for i in items
                    ) and not has_outerwear
                    if has_sleeveless_without_layer:
                        continue

                if rain_prob > 50:
                    # High rain probability: avoid suede/silk footwear
                    has_vulnerable_shoes = any(
                        classify_garment(i) == "footwear" and (i.material or "").lower() in ("suede", "silk")
                        for i in items
                    )
                    if has_vulnerable_shoes:
                        continue

            # H. Strict Indian Saree rule: NO western pants/jeans paired with a Saree!
            is_saree = any(classify_garment(i) == "indian_saree" for i in items)
            if is_saree:
                has_western_pants = any(classify_garment(i) in ("western_bottom", "western_top") for i in items)
                if has_western_pants:
                    continue

            filtered_candidates.append(items)

        if not filtered_candidates:
            # If hard filters removed all candidates, check if any candidate can pass with a principled relaxation
            # NEVER relax across incompatible occasions or violate luxury isolation!
            relaxed = []
            for items in candidates:
                if excluded_set and any(i.id in excluded_set for i in items):
                    continue
                if avoided_colors_set and any(
                    (it.color or "").lower().strip() in avoided_colors_set or
                    (it.secondary_color or "").lower().strip() in avoided_colors_set
                    for it in items
                ):
                    continue
                if any(classify_garment(i) == "indian_saree" for i in items) and any(classify_garment(i) in ("western_bottom", "western_top") for i in items):
                    continue

                # Hard constraint 1: NEVER bypass occasion hard filter during relaxation
                if not self._passes_occasion_hard_filter(items, target_occasion):
                    continue

                # Hard constraint 2: Protect luxury items from being relaxed into casual wear
                if any((getattr(i, "wear_tier", "daily") == "luxury_special" or getattr(i, "is_luxury", False)) for i in items):
                    if occasion_prof["target_formality"] < 0.75 and not include_luxury:
                        continue

                # Hard constraint 3: Strict minimum formality for formal events/interviews/business meetings
                formalities = [get_garment_formality(i) for i in items]
                avg_f = sum(formalities) / len(formalities) if formalities else 0.5
                if occasion_prof["target_formality"] >= 0.80 and avg_f < 0.65:
                    continue  # Interviews, formal events, business meetings reject casual wear even in relaxation

                delta_formality = max(formalities) - min(formalities) if formalities else 0.0
                if delta_formality <= 0.40:
                    relaxed.append(items)

            if relaxed:
                filtered_candidates = relaxed[:3]
            else:
                earliest_dt = filter_counts["earliest_laundry_return"]
                earliest_str = earliest_dt.strftime("%a") if isinstance(earliest_dt, date) else ""
                msg = f"Your wardrobe has no {target_occasion}-suitable clothes yet."
                empty_rec = Recommendation(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    outfit_id=None,
                    temperature=temp,
                    feels_like_temperature=feels_like,
                    humidity=float(humidity),
                    weather_condition=condition,
                    rain_probability=float(rain_prob),
                    occasion=target_occasion,
                    season=target_season,
                    recommendation_score=0.0,
                )
                empty_rec.status = "no_items"
                empty_rec.can_wear = False
                empty_rec.empty_reason = {
                    "message": msg,
                    "action": "gap_analysis",
                    "earliest_return": earliest_str,
                    "filter_counts": {
                        k: (v.isoformat() if isinstance(v, date) else v)
                        for k, v in filter_counts.items()
                    },
                }
                empty_rec.filter_counts = empty_rec.empty_reason["filter_counts"]
                empty_rec._custom_reasons = [msg]
                empty_rec._custom_context = {
                    "occasion": target_occasion,
                    "reasons": [msg],
                    "status": "no_items",
                    "empty_reason": empty_rec.empty_reason,
                }
                empty_rec._custom_reasoning = {
                    "compatibility": 0.0,
                    "occasion": target_occasion,
                }
                laundry_service.repo.save_daily_recommendation(
                    user_id=user_id,
                    rec_date=target_date,
                    occasion=target_occasion,
                    item_ids=[],
                    status="no_items",
                    empty_reason=empty_rec.empty_reason,
                    regenerate_counter=0,
                )
                return [empty_rec]

        # 6. DETERMINISTIC SCORING & EVENT-AWARE PERSONALIZED RANKING
        personalization_enabled = getattr(user_pref, "personalization_enabled", True) if user_pref else True
        scored_candidates: List[Tuple[List[Clothing], Dict[str, Any]]] = []

        for items in filtered_candidates:
            # 1. Compatibility score (0.35 weight): Category balance, Color harmony, Style consistency, Formality delta
            # 1. Garment Compatibility score (0.30 weight): Category balance, Style consistency, Formality delta
            score_category = self._compute_category_balance_score(items)
            score_color, color_explanation = self._compute_color_harmony_score(items)
            score_style = self._compute_style_compatibility_score(items)
            formalities = [get_garment_formality(i) for i in items]
            delta_formality = max(formalities) - min(formalities) if formalities else 0.0
            score_formality = max(0.5, 1.0 - delta_formality)
            compat_score = round(
                0.35 * score_color + 0.30 * score_category + 0.20 * score_style + 0.15 * score_formality,
                3,
            )

            # 2. Event Suitability score (0.25 weight): Target event category & dress code alignment
            score_event = EventClassifierService.compute_event_suitability(
                items=items,
                target_category=target_event_category,
                target_dress_code=target_event_dress_code,
                target_formality=target_event_formality,
            )

            # 3. Weather Suitability score (0.20 weight): Target season & climate conditions
            # 3. Weather Suitability score (0.15 weight): Target season & climate conditions
            score_weather = self._compute_season_score(
                items=items,
                target_season=target_season,
                temp=temp,
                feels_like=feels_like,
                humidity=humidity,
                wind_speed=wind_speed,
                rain_prob=rain_prob,
                condition=condition,
            )

            # 4. Personalization (0.15 weight) & 5. Diversity (0.05 weight)
            if personalization_enabled:
                s_pref, s_div, p_breakdown, p_rationales = self.personalization_service.score_candidate_personalization(
                    items=items,
                    target_occasion=target_occasion,
                    user_id=user_id,
                    user_pref=user_pref,
                    recent_outfit_ids=recent_outfit_ids,
                )
            else:
                s_pref, s_div, p_breakdown, p_rationales = 0.50, 0.50, {}, []

            # 5. Genuine Occasion Suitability (Weight: 35% / 0.35)
            score_occasion = self._compute_occasion_score(items, target_occasion, custom_occasion)

            # 6. Colour Coordination (Weight: 10% / 0.10): Perceptual CIELAB/HSV harmony & balance
            color_analysis = ColorCoordinationService.analyze_palette(items)
            score_color = color_analysis["score"]
            color_explanation = color_analysis["explanation"]

            # 6-Factor Balanced Aggregation Formula (sum = 1.00):
            # 0.35 * occasion_suitability + 0.25 * garment_compatibility + 0.15 * weather_suitability + 0.10 * color_coordination + 0.10 * personalization + 0.05 * diversity
            base_score = round(
                0.35 * score_occasion +
                0.25 * compat_score +
                0.15 * score_weather +
                0.10 * score_color +
                0.10 * s_pref +
                0.05 * s_div,
                3,
            )

            # 7. Machine Learning Preference Prediction (Random Forest Regressor, 42 features)
            ml_preference_score = None
            try:
                ml_features = recommendation_ml_service.construct_42_features(
                    items=items,
                    user=user,
                    user_pref=user_pref,
                    target_occasion=target_occasion,
                    occasion_prof=occasion_prof,
                    temp=temp,
                    condition=condition,
                    color_analysis=color_analysis,
                    compat_score=compat_score,
                    score_occasion=score_occasion,
                    hard_eligible=True,
                )
                ml_preference_score = recommendation_ml_service.predict_preference_score(ml_features)
            except Exception as ml_err:
                logger.debug(f"[RecommendationService] ML scoring fallback: {ml_err}")

            if ml_preference_score is not None:
                # Hybrid Architecture: 50% ML predicted preference + 50% multi-factor deterministic score
                blended_score = round(0.50 * base_score + 0.50 * ml_preference_score, 3)
            else:
                blended_score = base_score

            # Boost preferred items
            if preferred_set and any(i.id in preferred_set for i in items):
                blended_score = min(0.99, round(blended_score + 0.10, 3))

            # Repetition Avoidance & Recency Penalty (Feature 4)
            recency_penalty = 0.0
            items_worn_yesterday_count = sum(1 for i in items if i.id in item_ids_worn_yesterday)
            if items_worn_yesterday_count > 0:
                recency_penalty += min(0.20, items_worn_yesterday_count * 0.08)

            max_wear = max((getattr(i, "wear_count", 0) or 0) for i in items) if items else 0
            if max_wear >= 6:
                recency_penalty += 0.05

            final_score = max(0.25, min(0.99, round(blended_score - recency_penalty, 3)))

            explanations = self._generate_deterministic_explanations(
                items=items,
                target_occasion=target_occasion,
                temp=temp,
                condition=condition,
                delta_formality=delta_formality,
                color_explanation=color_explanation,
                score_occasion=score_occasion,
            )

            reasons_list = [event_rationale]
            if p_rationales:
                reasons_list.extend(p_rationales[:2])
            if color_explanation and color_explanation not in reasons_list:
                reasons_list.append(color_explanation)
            reasons_list.extend([r for r in explanations.get("reasons", []) if r not in reasons_list])
            if recency_penalty == 0.0:
                reasons_list.append("Fresh look not worn in recent days.")

            context_data = {
                "weather": condition,
                "temperature": temp,
                "occasion": target_occasion,
                "season": target_season,
                "event_category": target_event_category,
                "dress_code": target_event_dress_code,
                "delta_formality": round(delta_formality, 2),
                "color_harmony": color_analysis["harmony_type"],
                "color_explanation": color_explanation,
                "color_swatches": color_analysis["swatches"],
                "contrast_balance": color_analysis.get("contrast_balance"),
                "reasons": reasons_list[:4],
            }

            score_data = {
                "total_score": final_score,
                "reasons": reasons_list[:4],
                "explanations": explanations,
                "context": context_data,
                "reasoning": {
                    "compatibility": round(compat_score, 2),
                    "event_suitability": round(score_event, 2),
                    "weather_suitability": round(score_weather, 2),
                    "personalization": round(s_pref, 2),
                    "color_coordination": round(score_color, 2),
                    "diversity": round(s_div, 2),
                    "recency_penalty": round(recency_penalty, 2),
                    "event_category": target_event_category,
                    "event_dress_code": target_event_dress_code,
                    "event_tone": target_event_tone,
                    "is_personalized": personalization_enabled,
                    "ml_model_version": recommendation_ml_service.active_version if recommendation_ml_service.is_loaded else "deterministic_fallback",
                    "ml_score": ml_preference_score,
                },
                "score_breakdown": {
                    "compatibility": compat_score,
                    "event_suitability": score_event,
                    "weather_suitability": score_weather,
                    "personalization": p_breakdown,
                    "color_coordination": score_color,
                    "recency_penalty": recency_penalty,
                },
            }

            scored_candidates.append((items, score_data))

        # Sort descending by final score
        scored_candidates.sort(key=lambda x: x[1]["total_score"], reverse=True)

        # 7. DEDUPLICATION & PERSISTENCE
        distinct_combinations: List[Tuple[List[Clothing], Dict[str, Any]]] = []
        seen_signatures: Set[frozenset] = set()

        # When explicitly regenerating, find recent signatures to avoid immediate identical repetition
        recent_signatures: Set[frozenset] = set()
        if force_regenerate and recent_recs:
            for r in recent_recs[:4]:
                if r.outfit and r.outfit.clothing_items:
                    recent_signatures.add(frozenset(ci.id for ci in r.outfit.clothing_items))

        for items, score_data in scored_candidates:
            sig = frozenset(i.id for i in items)
            if force_regenerate and sig in recent_signatures and len(scored_candidates) > len(recent_signatures):
                # Skip previously shown look on explicit regeneration if alternative looks exist
                continue
            if sig not in seen_signatures:
                seen_signatures.add(sig)
                distinct_combinations.append((items, score_data))
                if len(distinct_combinations) >= limit:
                    break

        if not distinct_combinations and scored_candidates:
            distinct_combinations.append(scored_candidates[0])

        created_recommendations: List[Recommendation] = []

        # Check occasion-specific wardrobe gap deficiency
        has_blazer = any("blazer" in (i.name or "").lower() or (i.category or "").lower() == "outerwear" for i in eligible_wardrobe)
        has_ethnic = any(classify_garment(i) in ("indian_saree", "indian_kurta", "indian_lehenga", "indian_sherwani") for i in eligible_wardrobe)
        has_formal_shoe = any(classify_garment(i) == "footwear" and any(k in (i.name or "").lower() for k in ["oxford", "derby", "loafer", "formal"]) for i in eligible_wardrobe)

        gap_warning = None
        suggested_gap_cat = None
        if target_occasion in ("Business meeting", "Office", "Interview", "Presentation") and not has_blazer:
            gap_warning = "Your wardrobe is missing a formal blazer to complete authoritative professional looks."
            suggested_gap_cat = "Outerwear & Blazers"
        elif target_occasion in ("Wedding", "Festival") and not has_ethnic:
            gap_warning = "Your wardrobe is missing traditional festive ethnic wear for this celebration."
            suggested_gap_cat = "Indian Ethnic"
        elif target_occasion in ("Business meeting", "Formal event", "Interview") and not has_formal_shoe:
            gap_warning = "A classic dress shoe or leather loafer would elevate this formal outfit."
            suggested_gap_cat = "Footwear"

        for idx, (selected_items, s_data) in enumerate(distinct_combinations):
            if gap_warning:
                s_data["context"]["gap_warning"] = gap_warning
                s_data["context"]["suggested_gap_category"] = suggested_gap_cat

            # Check if footwear slot is filled & construct missing components alerts (Part 8)
            missing_components: List[Dict[str, Any]] = []
            has_footwear = any(classify_garment(i) == "footwear" for i in selected_items)
            if not has_footwear:
                rec_status = "partial_outfit"
                missing_slots = ["footwear"]
                can_wear = False
                notice = f"No footwear found for {target_occasion}"
                missing_components.append({
                    "slot": "footwear",
                    "type": "shoes",
                    "severity": "important" if occasion_prof["target_formality"] >= 0.60 else "recommended",
                    "message": f"No suitable footwear found in your wardrobe for {target_occasion}.",
                })
                if notice not in s_data["reasons"]:
                    s_data["reasons"] = [notice] + s_data["reasons"]
                s_data["context"]["missing_slots"] = missing_slots
                s_data["context"]["can_wear"] = False
                s_data["context"]["notice"] = notice
                empty_reason_data = {"missing_slots": missing_slots, "message": notice}
            else:
                rec_status = "active"
                missing_slots = None
                can_wear = True
                empty_reason_data = None

            # Cold weather outerwear check (Part 8)
            if temp < 15.0:
                has_outerwear = any(classify_garment(i) == "outerwear" for i in selected_items)
                if not has_outerwear:
                    missing_components.append({
                        "slot": "outerwear",
                        "type": "outerwear",
                        "severity": "weather_warning",
                        "message": f"Ambient temperature is {int(temp)}°C. Layering an outerwear piece or coat is recommended.",
                    })

            s_data["context"]["missing_components"] = missing_components

            outfit_name = f"{target_occasion} Look" if len(distinct_combinations) == 1 else f"{target_occasion} Look {idx + 1}"
            clothing_ids = [i.id for i in selected_items]

            # Create or reuse persistent Outfit in Neon PostgreSQL
            outfit = self.outfit_repo.create(
                user_id=user_id,
                clothing_item_ids=clothing_ids,
                name=outfit_name,
                description=s_data.get("explanations", {}).get("overall_rationale", f"{target_occasion} Look"),
                occasion=target_occasion,
                season=target_season,
            )

            # Create persistent Recommendation record in Neon PostgreSQL
            rec = self.rec_repo.create(
                user_id=user_id,
                outfit_id=outfit.id,
                recommendation_score=s_data["total_score"],
                temperature=temp,
                feels_like_temperature=feels_like,
                humidity=float(humidity),
                weather_condition=condition,
                rain_probability=float(rain_prob),
                occasion=target_occasion,
                season=target_season,
                model_version="personalized-v1-phase4" if personalization_enabled else "deterministic-v2-phase3",
            )

            # Attach transient deterministic explanations for API serialization
            rec.status = rec_status
            rec.can_wear = can_wear
            rec.missing_slots = missing_slots
            rec.missing_components = missing_components
            rec.empty_reason = empty_reason_data
            rec._custom_reasoning = s_data["reasoning"]
            rec._custom_context = s_data["context"]
            rec._custom_reasons = s_data["reasons"]
            rec.outfit = outfit
            rec.outfit.clothing_items = selected_items

            # Persist active recommendation in daily_recommendations table / fallback
            laundry_service.repo.save_daily_recommendation(
                user_id=user_id,
                rec_date=target_date,
                occasion=target_occasion,
                item_ids=[str(i.id) for i in selected_items],
                status=rec_status,
                empty_reason=empty_reason_data,
                outfit_hash=str(outfit.id),
                regenerate_counter=1 if force_regenerate else 0,
            )

            created_recommendations.append(rec)

        return created_recommendations

    # ---------------------------------------------------------------------
    # Archetype Combination Generators (Footwear & Blouse Resilient)
    # ---------------------------------------------------------------------
    def _generate_archetype_candidates(
        self,
        buckets: Dict[str, List[Clothing]],
        outfit_preference: str,
        temp: float,
        rain_prob: int,
        target_occasion: str = "Everyday",
        custom_occasion: Optional[str] = None,
        excluded_item_ids: Optional[Set[UUID]] = None,
    ) -> List[List[Clothing]]:
        candidates = []
        excluded = excluded_item_ids or set()

        # Pre-sort items in each bucket by occasion suitability and demote excluded items
        for b_name in buckets:
            buckets[b_name].sort(
                key=lambda it: (
                    it.id not in excluded,
                    score_garment_for_occasion(it, target_occasion, custom_occasion),
                ),
                reverse=True,
            )

        shoes = buckets["footwear"][:4] if buckets["footwear"] else [None]

        # 1. Western Two-Piece Archetype: Top + Bottom (+ Footwear + Optional Outerwear / Accessory)
        if outfit_preference in ("any", "western"):
            for top in buckets["western_top"][:8]:
                for btm in buckets["western_bottom"][:8]:
                    for shoe in shoes:
                        base_combo = [top, btm]
                        if shoe is not None:
                            base_combo.append(shoe)
                        if buckets["accessory"]:
                            base_combo.append(buckets["accessory"][0])
                        candidates.append(base_combo)

                        if buckets["outerwear"]:
                            for out in buckets["outerwear"][:3]:
                                layered_combo = [top, btm]
                                if shoe is not None:
                                    layered_combo.append(shoe)
                                layered_combo.append(out)
                                if buckets["accessory"]:
                                    layered_combo.append(buckets["accessory"][0])
                                candidates.append(layered_combo)

        # 2. Western Dress Archetype: Dress (+ Footwear + Optional Outerwear / Accessory)
        if outfit_preference in ("any", "western"):
            for dress in buckets["western_dress"][:5]:
                for shoe in shoes:
                    base_combo = [dress]
                    if shoe is not None:
                        base_combo.append(shoe)
                    if buckets["accessory"]:
                        base_combo.append(buckets["accessory"][0])
                    candidates.append(base_combo)

                    if buckets["outerwear"]:
                        for out in buckets["outerwear"][:3]:
                            layered_combo = [dress]
                            if shoe is not None:
                                layered_combo.append(shoe)
                            layered_combo.append(out)
                            if buckets["accessory"]:
                                layered_combo.append(buckets["accessory"][0])
                            candidates.append(layered_combo)

        # 3. Western Formal Suit Archetype: Blazer + Top + Trousers (+ Footwear)
        if outfit_preference in ("any", "western"):
            blazers = [
                i for i in buckets["outerwear"]
                if "blazer" in (i.category or "").lower() or "blazer" in (i.subcategory or "").lower() or "blazer" in (i.name or "").lower()
            ]
            trousers = [
                i for i in buckets["western_bottom"]
                if any(k in (i.name or "").lower() or k in (i.subcategory or "").lower() or k in (i.category or "").lower() for k in ["pants", "trouser", "slacks", "chino", "suit"])
            ]
            if blazers and trousers:
                for blz in blazers[:3]:
                    for top in buckets["western_top"][:5]:
                        for tr in trousers[:4]:
                            for shoe in shoes[:3]:
                                c = [blz, top, tr]
                                if shoe is not None:
                                    c.append(shoe)
                                candidates.append(c)

        # 4. Indian Saree Archetype: Saree (+ Blouse + Footwear + Accessory)
        # STRICT RULE: Saree must pair ONLY with Blouse and elegant Footwear (Sandals/Heels/Flats).
        # STRICTLY NO western bottoms or jeans!
        if outfit_preference in ("any", "indian"):
            blouses = buckets["indian_blouse"][:3] or [None]
            saree_shoes = [
                i for i in buckets["footwear"]
                if classify_garment(i) == "footwear" and not ("sneakers" in (i.name or "").lower() or "boots" in (i.name or "").lower())
            ]
            s_shoes = saree_shoes[:2] if saree_shoes else shoes[:2]

            for saree in buckets["indian_saree"][:4]:
                for blouse in blouses:
                    for shoe in s_shoes:
                        combo = [saree]
                        if blouse is not None:
                            combo.append(blouse)
                        if shoe is not None:
                            combo.append(shoe)
                        if buckets["accessory"]:
                            combo.append(buckets["accessory"][0])
                        candidates.append(combo)

        # 5. Indian Kurta Archetype: Kurta + Bottom (Indian or Western) (+ Footwear + Dupatta)
        if outfit_preference in ("any", "indian"):
            k_bottoms = buckets["indian_bottom"] or buckets["western_bottom"]
            for kurta in buckets["indian_kurta"][:3]:
                for btm in k_bottoms[:3]:
                    for shoe in shoes[:2]:
                        combo = [kurta, btm]
                        if shoe is not None:
                            combo.append(shoe)
                        if buckets["indian_dupatta"]:
                            combo.append(buckets["indian_dupatta"][0])
                        candidates.append(combo)

        # 6. Indian Kurti Archetype: Kurti + Bottom (+ Footwear + Dupatta)
        if outfit_preference in ("any", "indian"):
            k_bottoms = buckets["indian_bottom"] or buckets["western_bottom"]
            for kurti in buckets["indian_kurti"][:3]:
                for btm in k_bottoms[:3]:
                    for shoe in shoes[:2]:
                        combo = [kurti, btm]
                        if shoe is not None:
                            combo.append(shoe)
                        if buckets["indian_dupatta"]:
                            combo.append(buckets["indian_dupatta"][0])
                        candidates.append(combo)

        # 7. Indian Lehenga Archetype: Lehenga (+ Blouse + Dupatta + Footwear)
        if outfit_preference in ("any", "indian"):
            blouses = buckets["indian_blouse"][:2] or [None]
            for leh in buckets["indian_lehenga"][:2]:
                for blz in blouses:
                    for dup in (buckets["indian_dupatta"][:2] or [None]):
                        for shoe in shoes[:2]:
                            combo = [leh]
                            if blz is not None:
                                combo.append(blz)
                            if dup is not None:
                                combo.append(dup)
                            if shoe is not None:
                                combo.append(shoe)
                            candidates.append(combo)

        # 8. Indian Sherwani Archetype: Sherwani + Bottom (+ Footwear)
        if outfit_preference in ("any", "indian"):
            s_bottoms = buckets["indian_bottom"] or buckets["western_bottom"]
            for sher in buckets["indian_sherwani"][:2]:
                for btm in s_bottoms[:2]:
                    for shoe in shoes[:2]:
                        combo = [sher, btm]
                        if shoe is not None:
                            combo.append(shoe)
                        candidates.append(combo)

        # 9. Fusion Kurti + Denim Archetype: Kurti + Jeans (+ Footwear)
        if outfit_preference in ("any", "fusion"):
            jeans = [i for i in buckets["western_bottom"] if "jeans" in (i.name or "").lower() or "jeans" in (i.category or "").lower() or "denim" in (getattr(i, "material", None) or "").lower()] or buckets["western_bottom"][:2]
            for kurti in (buckets["indian_kurti"] or buckets["indian_kurta"])[:3]:
                for jn in jeans[:2]:
                    for shoe in shoes[:2]:
                        combo = [kurti, jn]
                        if shoe is not None:
                            combo.append(shoe)
                        candidates.append(combo)

        # 10. Fusion Blazer + Kurta Archetype: Blazer + Kurta + Trousers (+ Footwear)
        if outfit_preference in ("any", "fusion"):
            blazers = [
                i for i in buckets["outerwear"]
                if "blazer" in (i.name or "").lower() or "blazer" in (i.category or "").lower()
            ]
            for blz in blazers[:2]:
                for kurta in buckets["indian_kurta"][:2]:
                    for btm in (buckets["indian_bottom"] or buckets["western_bottom"])[:2]:
                        for shoe in shoes[:2]:
                            combo = [blz, kurta, btm]
                            if shoe is not None:
                                combo.append(shoe)
                            candidates.append(combo)

        return candidates

    # ---------------------------------------------------------------------
    # Occasion Hard Filtering
    # ---------------------------------------------------------------------
    def _passes_occasion_hard_filter(self, items: List[Clothing], occasion: str) -> bool:
        occ = (occasion or "").lower()

        # 1. Office / Business meeting / Interview / Presentation
        if any(k in occ for k in ["work", "office", "formal", "business", "interview", "presentation"]):
            for i in items:
                style = (getattr(i, "style", "") or "").lower()
                name = (i.name or "").lower()
                cat = (i.category or "").lower()
                sub = (getattr(i, "subcategory", "") or "").lower()
                if any(w in name or w in style or w in sub for w in ["gym", "athletic", "sport", "distressed", "ripped", "swim", "sweat"]):
                    return False
                if cat == "shorts" or "shorts" in name or sub == "shorts":
                    return False
                if cat == "shoes" and any(w in name or w in sub for w in ["running", "sport", "trainer", "flip-flop", "sandal"]):
                    return False

        # 2. Sports / Gym settings reject formal suits, blazers, sarees, lehengas, sherwanis, dress shoes, loafers
        if any(k in occ for k in ["sport", "gym", "workout", "athletic", "fitness"]):
            for i in items:
                c_type = classify_garment(i)
                name = (i.name or "").lower()
                style = (getattr(i, "style", "") or "").lower()
                if c_type in ("indian_saree", "indian_lehenga", "indian_sherwani", "indian_blouse"):
                    return False
                if any(w in name or w in style for w in ["blazer", "suit", "tuxedo", "oxford", "loafer", "tie", "formal shirt", "chinos", "slacks"]):
                    return False

        # 3. Wedding / Festival / Festive settings prefer ethnic or high formality; reject pure gym wear & casual shorts
        if any(k in occ for k in ["wedding", "festive", "traditional", "festival", "function"]):
            for i in items:
                name = (i.name or "").lower()
                style = (getattr(i, "style", "") or "").lower()
                sub = (getattr(i, "subcategory", "") or "").lower()
                if any(w in name or w in style or w in sub for w in ["gym", "sport", "shorts", "distressed", "ripped", "sweatpants", "flip-flop"]):
                    return False

        # 4. Casual Daily / Everyday / College / Travel settings reject heavy bridal lehengas or black-tie sherwanis
        if any(k in occ for k in ["casual", "college", "daily", "errands", "everyday", "travel"]):
            for i in items:
                c_type = classify_garment(i)
                name = (i.name or "").lower()
                if c_type in ("indian_sherwani", "indian_lehenga"):
                    return False
                if any(w in name for w in ["tuxedo", "ballgown"]):
                    return False

        # 5. Party / Date settings reject gym wear and slovenly clothes
        if any(k in occ for k in ["party", "date"]):
            for i in items:
                name = (i.name or "").lower()
                style = (getattr(i, "style", "") or "").lower()
                if any(w in name or w in style for w in ["gym", "sweatpants", "running", "athletic shorts"]):
                    return False

        return True

    # ---------------------------------------------------------------------
    # Deterministic Scoring (Occasion 25%, Cat 20%, Color 20%, Style 15%,
    # Formality 10%, Season 5%, Pref/Rotation 5%)
    # ---------------------------------------------------------------------
    def _score_candidate_deterministic(
        self,
        items: List[Clothing],
        target_occasion: str,
        target_season: str,
        temp: float,
        rain_prob: int,
        condition: str,
        user_pref: Any,
        learned_pref: Any,
        preferred_colors: List[str],
        recent_outfit_ids: Set[UUID],
        feels_like: float = 22.0,
        humidity: int = 50,
        wind_speed: float = 5.0,
    ) -> Dict[str, Any]:
        # 1. Occasion Match (Weight: 25% / 0.25)
        score_occasion = self._compute_occasion_score(items, target_occasion)

        # 2. Category Balance & Completeness (Weight: 20% / 0.20)
        score_category = self._compute_category_balance_score(items)

        # 3. Color Harmony (Weight: 20% / 0.20)
        score_color, color_explanation = self._compute_color_harmony_score(items)

        # 4. Style Compatibility (Weight: 15% / 0.15)
        score_style = self._compute_style_compatibility_score(items)

        # 5. Formality Alignment (Weight: 10% / 0.10)
        formalities = [get_garment_formality(i) for i in items]
        delta_formality = max(formalities) - min(formalities) if formalities else 0.0
        score_formality = max(0.5, 1.0 - delta_formality)

        # 6. Season & Climate Calibration (Weight: 5% / 0.05)
        score_season = self._compute_season_score(
            items=items,
            target_season=target_season,
            temp=temp,
            feels_like=feels_like,
            humidity=humidity,
            wind_speed=wind_speed,
            rain_prob=rain_prob,
            condition=condition,
        )

        # 7. Personal Preference & Underused Rotation Bonus (Weight: 5% / 0.05)
        score_pref = self._compute_preference_rotation_bonus(items, preferred_colors, user_pref)

        # Total Weighted Aggregation
        total = (
            score_occasion * 0.25 +
            score_category * 0.20 +
            score_color * 0.20 +
            score_style * 0.15 +
            score_formality * 0.10 +
            score_season * 0.05 +
            score_pref * 0.05
        )

        # Apply Repetition Penalty if identical items were recently recommended
        outfit_sig_ids = [i.id for i in items]
        if any(oid in recent_outfit_ids for oid in outfit_sig_ids):
            total -= 0.10

        total_clamped = max(0.55, min(0.99, round(total, 3)))

        # Natural Language Explanations
        explanations = self._generate_deterministic_explanations(
            items=items,
            target_occasion=target_occasion,
            temp=temp,
            condition=condition,
            delta_formality=delta_formality,
            color_explanation=color_explanation,
            score_occasion=score_occasion,
        )

        reasoning = {
            "occasion_match": round(score_occasion, 2),
            "category_completeness": round(score_category, 2),
            "color_harmony": round(score_color, 2),
            "style_compatibility": round(score_style, 2),
            "formality_alignment": round(score_formality, 2),
            "season_suitability": round(score_season, 2),
            "preference_rotation": round(score_pref, 2),
            "compatibility": total_clamped,
        }

        context = {
            "weather": condition,
            "temperature": temp,
            "occasion": target_occasion,
            "season": target_season,
            "delta_formality": round(delta_formality, 2),
            "reasons": explanations["reasons"],
        }

        return {
            "total_score": total_clamped,
            "reasoning": reasoning,
            "score_breakdown": dict(reasoning),
            "context": context,
            "reasons": explanations["reasons"],
            "explanations": explanations,
        }

    # ---------------------------------------------------------------------
    # Individual Scoring Dimensions
    # ---------------------------------------------------------------------
    def _compute_occasion_score(self, items: List[Clothing], occasion: str, custom_occasion: Optional[str] = None) -> float:
        occ = (occasion or "").lower()
        custom_txt = (custom_occasion or "").lower()
        scores = []
        for i in items:
            it_occ = (i.occasion or "").lower()
            it_style = (getattr(i, "style", "") or "").lower()
            c_type = classify_garment(i)
            name = (i.name or "").lower()
            sub = (getattr(i, "subcategory", "") or "").lower()
            f = get_garment_formality(i)

            # 1. Business meeting: structured, formal, commanding
            if "business" in occ:
                if c_type == "outerwear" and "blazer" in name:
                    scores.append(0.99)
                elif c_type == "western_top" and any(k in name or k in sub for k in ["shirt", "oxford", "button"]):
                    scores.append(0.98)
                elif c_type == "western_bottom" and any(k in name or k in sub for k in ["trouser", "pant", "slacks", "chino"]):
                    scores.append(0.97)
                elif c_type == "footwear" and any(k in name or k in sub for k in ["oxford", "derby", "loafer", "formal"]):
                    scores.append(0.98)
                elif f >= 0.70:
                    scores.append(0.88)
                elif f >= 0.50:
                    scores.append(0.60)
                else:
                    scores.append(0.20)

            # 2. Presentation: neat, authoritative, well-coordinated
            elif "presentation" in occ:
                if c_type == "outerwear" and "blazer" in name:
                    scores.append(0.98)
                elif c_type in ("western_top", "western_dress") and any(k in name or k in it_style or k in sub for k in ["shirt", "blouse", "formal", "tailored"]):
                    scores.append(0.97)
                elif c_type in ("western_bottom", "indian_kurta"):
                    scores.append(0.95)
                elif f >= 0.65:
                    scores.append(0.88)
                else:
                    scores.append(0.30)

            # 3. Interview: conservative, highly polished, formal
            elif "interview" in occ:
                if c_type == "outerwear" and any(k in name for k in ["blazer", "suit"]):
                    scores.append(0.99)
                elif c_type == "western_top" and any(k in name or k in sub for k in ["shirt", "white", "blue", "formal"]):
                    scores.append(0.98)
                elif c_type == "western_bottom" and any(k in name or k in sub for k in ["trouser", "pant", "slacks"]):
                    scores.append(0.98)
                elif f >= 0.75:
                    scores.append(0.90)
                else:
                    scores.append(0.20)

            # 4. Formal event: black-tie, high elegance, gala
            elif any(k in occ for k in ["formal event", "black tie", "gala"]):
                if c_type in ("indian_saree", "indian_lehenga", "indian_sherwani"):
                    scores.append(0.99)
                elif c_type == "outerwear" and any(k in name for k in ["blazer", "suit", "tuxedo"]):
                    scores.append(0.98)
                elif c_type == "western_dress" and f >= 0.80:
                    scores.append(0.98)
                elif f >= 0.80:
                    scores.append(0.92)
                else:
                    scores.append(0.25)

            # 5. Office / Work: smart casual, polished everyday professional
            elif any(k in occ for k in ["work", "office"]):
                if c_type in ("outerwear", "western_top", "western_bottom") and any(k in name or k in sub for k in ["shirt", "pants", "trousers", "blazer", "chino", "polo"]):
                    scores.append(0.98)
                elif c_type in ("indian_kurti", "indian_kurta"):
                    scores.append(0.95)
                elif c_type == "western_dress" and f >= 0.60:
                    scores.append(0.96)
                elif c_type == "western_bottom" and "jeans" in name and not any(k in name for k in ["ripped", "distressed"]):
                    scores.append(0.75)
                elif f >= 0.55:
                    scores.append(0.85)
                else:
                    scores.append(0.25)

            # 6. Wedding: rich textures, ethnic attire, high celebration
            elif "wedding" in occ:
                if c_type in ("indian_saree", "indian_lehenga", "indian_sherwani", "indian_blouse", "indian_dupatta"):
                    scores.append(0.99)
                elif c_type in ("indian_kurta", "indian_kurti"):
                    scores.append(0.95)
                elif c_type == "outerwear" and any(k in name for k in ["blazer", "suit"]):
                    scores.append(0.92)
                elif f >= 0.85:
                    scores.append(0.85)
                else:
                    scores.append(0.25)

            # 7. Festival: festive ethnic, vibrant drapes & kurtas
            elif any(k in occ for k in ["festival", "festive", "traditional"]):
                if c_type in ("indian_kurta", "indian_kurti", "indian_saree", "indian_bottom"):
                    scores.append(0.98)
                elif "ethnic" in it_style or "traditional" in it_style:
                    scores.append(0.96)
                elif f >= 0.70:
                    scores.append(0.85)
                else:
                    scores.append(0.35)

            # 8. Party: chic statement pieces, evening elegance
            elif "party" in occ:
                if c_type in ("western_dress", "outerwear") or any(k in it_style for k in ["party", "chic", "bold"]):
                    scores.append(0.98)
                elif any(k in name for k in ["blazer", "jacket", "leather", "black", "silk", "chelsea", "boot"]):
                    scores.append(0.96)
                elif c_type == "western_bottom" and any(k in name for k in ["black", "dark"]):
                    scores.append(0.90)
                elif f >= 0.50 and not any(k in name for k in ["gym", "athletic", "track"]):
                    scores.append(0.80)
                else:
                    scores.append(0.25)

            # 9. Date: flattering, coordinated, elegant
            elif any(k in occ for k in ["date", "dinner"]):
                if "chic" in it_style or "elegant" in it_style or c_type in ("western_dress", "indian_saree"):
                    scores.append(0.98)
                elif c_type in ("outerwear", "western_top") and any(k in name for k in ["blazer", "shirt", "blouse", "knit", "polo"]):
                    scores.append(0.96)
                elif c_type in ("western_bottom", "footwear") and any(k in name for k in ["chino", "trouser", "dark", "chelsea", "loafer"]):
                    scores.append(0.95)
                elif f >= 0.45 and not any(k in name for k in ["gym", "sweat"]):
                    scores.append(0.80)
                else:
                    scores.append(0.25)

            # 10. Family gathering: comfortable smart-casual or neat ethnic
            elif "family" in occ:
                if c_type in ("indian_kurta", "indian_kurti", "western_dress") or any(k in it_style for k in ["modest", "casual", "smart"]):
                    scores.append(0.97)
                elif any(k in name for k in ["polo", "shirt", "chino"]):
                    scores.append(0.95)
                elif f >= 0.40 and f <= 0.75:
                    scores.append(0.88)
                else:
                    scores.append(0.40)

            # 11. Gym / Sports: activewear, athletic tees, track pants
            elif any(k in occ for k in ["sport", "gym", "workout", "athletic", "fitness"]):
                if any(k in name or k in it_style or k in sub for k in ["athletic", "gym", "sport", "runner", "sneakers", "hoodie", "shorts", "tee", "active", "track"]):
                    scores.append(0.99)
                elif c_type in ("western_top", "western_bottom") and f <= 0.35:
                    scores.append(0.85)
                else:
                    scores.append(0.15)

            # 12. Travel: breathable, stretchy, comfortable layers
            elif "travel" in occ:
                if any(k in name or k in it_style or k in sub for k in ["casual", "sneakers", "jeans", "hoodie", "jacket", "comfortable", "overshirt", "chinos"]):
                    scores.append(0.98)
                elif f <= 0.55:
                    scores.append(0.88)
                else:
                    scores.append(0.25)

            # 13. College: youth, casual ease, denim, sneakers, kurtis
            elif "college" in occ:
                if any(k in name or k in it_style or k in sub for k in ["casual", "sneakers", "jeans", "tee", "kurti", "hoodie", "streetwear", "polo", "chinos"]):
                    scores.append(0.98)
                elif f <= 0.60:
                    scores.append(0.88)
                else:
                    scores.append(0.25)

            # 14. Casual outing: relaxed weekend aesthetics, smart casual
            elif any(k in occ for k in ["outing", "casual outing"]):
                if any(k in name or k in it_style or k in sub for k in ["casual", "smart", "sneakers", "jeans", "overshirt", "polo", "linen", "chino"]):
                    scores.append(0.98)
                elif f <= 0.65:
                    scores.append(0.88)
                else:
                    scores.append(0.30)

            # 15. Custom occasion: keyword-driven scoring
            elif "custom" in occ and custom_txt:
                if any(w in custom_txt for w in ["beach", "pool", "summer"]) and any(w in name for w in ["shorts", "linen", "tee", "sandal"]):
                    scores.append(0.98)
                elif any(w in custom_txt for w in ["gala", "dinner", "formal"]) and f >= 0.75:
                    scores.append(0.98)
                elif any(w in custom_txt for w in ["hike", "trek", "outdoor"]) and any(w in name for w in ["sport", "athletic", "sneaker", "jacket"]):
                    scores.append(0.98)
                elif f <= 0.65:
                    scores.append(0.88)
                else:
                    scores.append(0.50)

            # 16. Everyday: comfortable versatile capsule
            else:
                if f <= 0.60 and not any(k in name for k in ["tuxedo", "bridal", "sherwani"]):
                    scores.append(0.96)
                elif f <= 0.80:
                    scores.append(0.75)
                else:
                    scores.append(0.25)

        return sum(scores) / len(scores) if scores else 0.85

        return sum(scores) / len(scores) if scores else 0.90

    def _compute_category_balance_score(self, items: List[Clothing]) -> float:
        types = set(classify_garment(i) for i in items)
        has_footwear = "footwear" in types

        # Saree ensemble
        if "indian_saree" in types:
            if "indian_blouse" in types:
                return 0.98 if has_footwear else 0.95
            return 0.94 if has_footwear else 0.91

        # Lehenga ensemble
        if "indian_lehenga" in types:
            return 0.98 if ("indian_blouse" in types and has_footwear) else 0.94

        # Western formal suit
        if "outerwear" in types and "western_top" in types and "western_bottom" in types:
            return 0.98 if has_footwear else 0.95

        # Western two-piece
        if "western_top" in types and "western_bottom" in types:
            base = 0.96 if ("outerwear" in types or "accessory" in types) else 0.93
            return base if has_footwear else (base - 0.02)

        # Western dress
        if "western_dress" in types:
            base = 0.96 if ("outerwear" in types or "accessory" in types) else 0.93
            return base if has_footwear else (base - 0.02)

        # Kurta / Kurti
        if ("indian_kurta" in types or "indian_kurti" in types) and ("indian_bottom" in types or "western_bottom" in types):
            base = 0.96 if "indian_dupatta" in types else 0.93
            return base if has_footwear else (base - 0.02)

        return 0.88

    def _compute_color_harmony_score(self, items: List[Clothing]) -> Tuple[float, str]:
        colors = [c.lower().strip() for c in (i.color for i in items if i.color)]
        if not colors:
            return 0.90, "Neutral and balanced tones"

        unique_colors = list(dict.fromkeys(colors))
        non_neutrals = [c for c in unique_colors if c not in NEUTRAL_COLORS]

        # All neutrals
        if len(non_neutrals) == 0:
            return 0.97, f"Monochromatic neutral palette of {' & '.join([c.title() for c in unique_colors])}"

        # 1 Accent + Neutrals
        if len(non_neutrals) == 1:
            accent = non_neutrals[0].title()
            return 0.94, f"Neutral palette anchored by an expressive {accent} accent"

        # 2 Non-neutrals: check harmonious / complementary pairs
        if len(non_neutrals) == 2:
            pair = (non_neutrals[0], non_neutrals[1])
            if pair in HARMONIOUS_COLOR_PAIRS:
                return 0.95, f"Complementary harmony between {pair[0].title()} and {pair[1].title()}"
            return 0.88, f"Dual accent contrast between {non_neutrals[0].title()} and {non_neutrals[1].title()}"

        # 3+ Non-neutrals: visual dissonance risk
        return 0.72, f"Multi-color assemblage ({', '.join([c.title() for c in non_neutrals])})"

    def _compute_style_compatibility_score(self, items: List[Clothing]) -> float:
        styles = [getattr(i, "style", None) or "Casual" for i in items]
        unique_styles = set(s.lower() for s in styles)
        if len(unique_styles) <= 1:
            return 0.98
        elif len(unique_styles) == 2:
            return 0.92
        return 0.82

    def _compute_season_score(
        self,
        items: List[Clothing],
        target_season: str,
        temp: float = 22.0,
        feels_like: float = 22.0,
        humidity: int = 50,
        wind_speed: float = 5.0,
        rain_prob: int = 10,
        condition: str = "Pleasant",
    ) -> float:
        tgt = target_season.lower()
        matches = 0
        for i in items:
            season = (i.season or "All-Season").lower()
            if "all" in season or tgt in season:
                matches += 1
        base_score = matches / len(items) if items else 0.85

        # Micro-climate adjustment based on physical factors
        adj = 0.0
        # Hot conditions (>25°C or feels_like >26°C): prioritize breathable fabrics, penalize heavy fabrics
        if temp >= 25.0 or feels_like >= 26.0:
            for it in items:
                mat = (getattr(it, "material", None) or getattr(it, "fabric", "") or "").lower()
                if any(b in mat for b in ("linen", "cotton", "silk", "rayon", "viscose", "chambray")):
                    adj += 0.03
                elif any(h in mat for h in ("wool", "cashmere", "leather", "fleece", "velvet", "corduroy", "down")):
                    adj -= 0.05
        # Cold conditions (<15°C or feels_like <14°C): prioritize layering and warm fabrics
        elif temp <= 15.0 or feels_like <= 14.0:
            has_layer = any(classify_garment(it) in ("outerwear", "layer") or (getattr(it, "category", "") or "").lower() in ("jackets", "coats", "sweaters", "cardigans") for it in items)
            if has_layer:
                adj += 0.05
            for it in items:
                mat = (getattr(it, "material", None) or getattr(it, "fabric", "") or "").lower()
                if any(w in mat for w in ("wool", "cashmere", "fleece", "denim", "leather", "corduroy")):
                    adj += 0.03
        # Rain conditions (rain_prob >= 40% or rain condition): prioritize water-resistant, penalize suede/raw silk
        if rain_prob >= 40 or "rain" in condition.lower() or "drizzle" in condition.lower():
            for it in items:
                mat = (getattr(it, "material", None) or getattr(it, "fabric", "") or "").lower()
                if any(r in mat for r in ("nylon", "polyester", "waterproof", "leather")):
                    adj += 0.03
                elif any(v in mat for v in ("suede", "raw silk", "velvet")):
                    adj -= 0.06
        # High humidity (>65%): reward breathable relaxed silhouettes
        if humidity >= 65:
            for it in items:
                fit = (getattr(it, "fit", "") or "").lower()
                if "loose" in fit or "oversized" in fit or "relaxed" in fit:
                    adj += 0.02
        # High wind (>20 km/h): reward outerwear
        if wind_speed >= 20.0:
            if any(classify_garment(it) == "outerwear" for it in items):
                adj += 0.04

        return max(0.50, min(1.0, round(base_score + adj, 3)))

    def _compute_preference_rotation_bonus(
        self,
        items: List[Clothing],
        preferred_colors: List[str],
        user_pref: Any,
    ) -> float:
        bonus = 0.75

        # 1. Preferred colors match
        pref_set = set(c.lower().strip() for c in preferred_colors)
        if user_pref and getattr(user_pref, "preferred_colors", None):
            for c in user_pref.preferred_colors:
                pref_set.add(c.lower().strip())

        if pref_set:
            has_pref = any((i.color or "").lower().strip() in pref_set for i in items)
            if has_pref:
                bonus += 0.08

        # 2. Preferred styles match from onboarding
        if user_pref and getattr(user_pref, "preferred_styles", None):
            user_styles = set(s.lower().strip() for s in user_pref.preferred_styles)
            # Map common onboarding styles
            has_style_match = False
            for i in items:
                it_style = (getattr(i, "style", None) or "").lower().strip()
                cat = (getattr(i, "category", None) or "").lower().strip()
                name = (getattr(i, "name", None) or "").lower().strip()

                if it_style in user_styles:
                    has_style_match = True
                    break
                if "minimalist" in user_styles and (it_style in ("minimal", "minimalist", "clean") or (getattr(i, "pattern", "") or "").lower() == "solid"):
                    has_style_match = True
                    break
                if any(es in user_styles for es in ("traditional indian", "ethnic fusion")) and any(k in name or k in cat for k in ("saree", "kurta", "kurti", "lehenga", "ethnic")):
                    has_style_match = True
                    break
                if "streetwear" in user_styles and any(k in name or k in cat for k in ("sneaker", "hoodie", "tee", "cargo", "oversized")):
                    has_style_match = True
                    break
            if has_style_match:
                bonus += 0.08

        # 3. Preferred categories match
        if user_pref and getattr(user_pref, "preferred_categories", None):
            user_cats = set(c.lower().strip() for c in user_pref.preferred_categories)
            if any((getattr(i, "category", "") or "").lower().strip() in user_cats or (getattr(i, "name", "") or "").lower().strip() in user_cats for i in items):
                bonus += 0.05

        # 4. Underused wear rotation bonus: reward unworn pieces (wear_count <= 1)
        unworn_count = sum(1 for i in items if (getattr(i, "wear_count", 0) or 0) <= 1)
        if unworn_count > 0:
            bonus += 0.06  # Encourages capsule wardrobe rotation

        return min(1.0, bonus)

    # ---------------------------------------------------------------------
    # Deterministic Natural Language Explanations
    # ---------------------------------------------------------------------
    def _generate_deterministic_explanations(
        self,
        items: List[Clothing],
        target_occasion: str,
        temp: float,
        condition: str,
        delta_formality: float,
        color_explanation: str,
        score_occasion: float,
    ) -> Dict[str, Any]:
        # Formality description
        if delta_formality <= 0.15:
            formality_desc = f"Exceptional formality coherence (variance: {delta_formality:.2f}) delivering effortless polish."
        else:
            formality_desc = f"Smart formality balance (variance: {delta_formality:.2f}) aligning top and bottom silhouettes."

        # Climate description
        if temp < 14.0:
            climate_desc = f"Layered thermal protection calibrated for cool {temp:.1f}°C {condition}."
        elif temp > 24.0:
            climate_desc = f"Lightweight breathability calibrated for warm {temp:.1f}°C {condition}."
        else:
            climate_desc = f"Optimal climate balance calibrated for pleasant {temp:.1f}°C {condition}."

        # Occasion description
        occasion_desc = f"Silhouette tailored specifically for {target_occasion}."

        # Underused rotation notice
        least_worn = min(items, key=lambda x: getattr(x, "wear_count", 0) or 0)
        wear_desc = f"Rotates your staple {least_worn.name} ({getattr(least_worn, 'wear_count', 0) or 0} recorded wears)."

        reasons = [
            color_explanation,
            occasion_desc,
            climate_desc,
            wear_desc,
        ]

        overall_rationale = (
            f"Curated {target_occasion} look. {color_explanation}. {climate_desc}"
        )

        return {
            "color_explanation": color_explanation,
            "occasion_explanation": occasion_desc,
            "weather_explanation": climate_desc,
            "formality_explanation": formality_desc,
            "reasons": reasons,
            "overall_rationale": overall_rationale,
        }

    # ---------------------------------------------------------------------
    # Listing & Single Retrieval
    # ---------------------------------------------------------------------
    def list_recommendations(
        self, user_id: UUID, limit: int = 20, offset: int = 0
    ) -> List[Recommendation]:
        recs = (
            self.db.query(Recommendation)
            .options(joinedload(Recommendation.outfit).joinedload(Outfit.clothing_items))
            .filter(Recommendation.user_id == user_id)
            .order_by(Recommendation.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return recs

    def get_recommendation(self, recommendation_id: UUID, user_id: UUID) -> Recommendation:
        rec = (
            self.db.query(Recommendation)
            .options(joinedload(Recommendation.outfit).joinedload(Outfit.clothing_items))
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
                detail="You do not have permission to view this recommendation",
            )
        return rec

    # ---------------------------------------------------------------------
    # Phase 3 Accept Recommendation (Associates with Calendar Event Idempotently)
    # ---------------------------------------------------------------------
    def accept_recommendation(
        self,
        recommendation_id: UUID,
        user_id: UUID,
        calendar_event_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Idempotently accepts a recommendation and associates outfit_id and recommendation_id
        to the target calendar event in Neon PostgreSQL. Does not duplicate events.
        """
        rec = self.get_recommendation(recommendation_id, user_id)

        target_event: Optional[CalendarEvent] = None

        if calendar_event_id:
            target_event = self.calendar_repo.get_by_id(calendar_event_id, user_id=user_id)
            if not target_event or target_event.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Specified calendar event was not found",
                )

        if not target_event:
            # Check if this recommendation is already attached to a calendar event
            existing_event = self.calendar_repo.get_by_recommendation_and_date(
                recommendation_id=rec.id,
                event_date=date.today(),
                user_id=user_id,
            )
            if existing_event:
                target_event = existing_event

        if not target_event:
            # Look for an upcoming or today's scheduled event to associate
            events = self.calendar_repo.list_for_user(
                user_id=user_id,
                start_date=date.today(),
                status="scheduled",
                limit=1,
            )
            if events:
                target_event = events[0]

        if not target_event:
            # Create a planned calendar event for today
            target_event = self.calendar_repo.create(
                user_id=user_id,
                event_date=date.today(),
                event_type="planned_outfit",
                outfit_id=rec.outfit_id,
                recommendation_id=rec.id,
                occasion=rec.occasion or "Casual Daily",
                notes=f"Accepted AI Recommendation ({rec.score * 100:.0f}% match)",
                status="scheduled",
            )
        else:
            # Idempotently update existing calendar event
            target_event = self.calendar_repo.update(
                target_event,
                outfit_id=rec.outfit_id,
                recommendation_id=rec.id,
                occasion=target_event.occasion or rec.occasion or "Casual Daily",
                status="scheduled",
            )

        # Record acceptance in feedback
        self.rec_repo.save_feedback(
            user_id=user_id,
            recommendation_id=rec.id,
            action="accept",
            feedback_value=1.0,
        )

        calendar_dict = {
            "id": str(target_event.id),
            "event_date": str(target_event.event_date),
            "start_time": str(target_event.start_time) if target_event.start_time else None,
            "occasion": target_event.occasion,
            "status": target_event.status,
            "outfit_id": str(target_event.outfit_id) if target_event.outfit_id else None,
            "recommendation_id": str(target_event.recommendation_id) if target_event.recommendation_id else None,
        }

        return {
            "recommendation_id": rec.id,
            "calendar_event_id": target_event.id,
            "outfit_id": rec.outfit_id,
            "status": "accepted",
            "message": "Recommendation accepted and associated with calendar event in Neon PostgreSQL",
            "recommendation": rec,
            "calendar_event": calendar_dict,
        }

    # ---------------------------------------------------------------------
    # Phase 3 Dismiss Recommendation
    # ---------------------------------------------------------------------
    def dismiss_recommendation(
        self,
        recommendation_id: UUID,
        user_id: UUID,
    ) -> Dict[str, Any]:
        rec = self.get_recommendation(recommendation_id, user_id)
        self.rec_repo.save_feedback(
            user_id=user_id,
            recommendation_id=rec.id,
            action="reject",
            feedback_value=-1.0,
        )
        return {
            "status": "dismissed",
            "recommendation_id": rec.id,
            "message": "Recommendation dismissed successfully",
        }

    # ---------------------------------------------------------------------
    # Legacy / Daily Fit Backward Compatibility
    # ---------------------------------------------------------------------
    async def generate_daily_fit(
        self,
        user_id: UUID,
        city: str = "New York",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        occasion: str = "Casual Daily",
        variation_seed: int = 0,
    ) -> Recommendation:
        """
        Legacy Daily Fit endpoint. Auto-finds or schedules today's calendar event
        and generates recommendations with the Phase 3 engine.
        """
        # Ensure a calendar event exists for today
        events = self.calendar_repo.list_for_user(
            user_id=user_id,
            start_date=date.today(),
            end_date=date.today(),
            limit=1,
        )
        if events:
            ev = events[0]
        else:
            ev = self.calendar_repo.create(
                user_id=user_id,
                event_date=date.today(),
                event_type="planned_outfit",
                occasion=occasion,
                notes="Daily Fit auto-scheduled session",
                status="scheduled",
            )

        recs = await self.generate_recommendations(
            user_id=user_id,
            calendar_event_id=ev.id,
            occasion=occasion,
            limit=1,
            city=city,
            latitude=latitude,
            longitude=longitude,
        )

        if not recs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to generate daily fit recommendations for your wardrobe.",
            )

        idx = variation_seed % len(recs)
        selected = recs[idx]

        # Auto-associate selected outfit with today's event
        self.calendar_repo.update(
            ev,
            outfit_id=selected.outfit_id,
            recommendation_id=selected.id,
        )

        return selected

    # ---------------------------------------------------------------------
    # Phase 4 Wear & Feedback Integration
    # ---------------------------------------------------------------------
    def mark_outfit_as_worn(
        self,
        user_id: UUID,
        outfit_id: UUID,
        recommendation_id: Optional[UUID] = None,
        temperature: Optional[float] = None,
        feels_like: Optional[float] = None,
        humidity: Optional[float] = None,
        weather_condition: Optional[str] = None,
        rain_probability: Optional[float] = None,
        occasion: Optional[str] = None,
        season: Optional[str] = None,
        user_rating: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Phase 4: Marks an outfit as worn.
        - Persists wear entry in wear_history in Neon PostgreSQL.
        - Idempotently prevents duplicate wear submissions on the same calendar day.
        - Increments wear count for all constituent clothing items.
        - Feeds the wear event into PersonalizationService for continuous learning.
        """
        outfit = self.outfit_repo.get_by_id(outfit_id, user_id=user_id)
        if not outfit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outfit not found or access denied",
            )

        # 1. Record wear entry in repository (idempotent per calendar date)
        wear_entry = self.rec_repo.record_wear(
            user_id=user_id,
            outfit_id=outfit_id,
            temperature=temperature,
            feels_like_temperature=feels_like,
            humidity=humidity,
            weather_condition=weather_condition,
            rain_probability=rain_probability,
            occasion=occasion or outfit.occasion,
            season=season or outfit.season,
            user_rating=user_rating,
        )

        is_new = getattr(wear_entry, "_is_new", True)

        # 2. Feed positive signal into personalization service ONLY if newly worn
        if is_new:
            self.personalization_service.record_feedback(
                user_id=user_id,
                outfit=outfit,
                action="wear",
                reason=None,
            )

        # 3. Synchronize with Laundry & Wear Tracking Service (Rule 3.1 & 3.4)
        laundry_service = LaundryService(self.db)
        laundry_res = laundry_service.record_wear(
            user_id=user_id,
            outfit_id=outfit.id,
            target_date=date.today(),
            source="daily_fit",
        )

        item_ids = [item.id for item in (outfit.clothing_items or [])]
        return {
            "success": True,
            "outfit_id": outfit.id,
            "user_id": user_id,
            "worn_at": wear_entry.worn_at if wear_entry else datetime.now(timezone.utc),
            "wear_count_updated": is_new,
            "clothing_items_updated": item_ids if is_new else [],
            "laundry_notifications": laundry_res.get("laundry_notifications", []),
            "message": "Outfit marked as worn. Wear history and personalization updated." if is_new else "Outfit was already marked as worn today.",
        }

    def get_feedback_history(self, user_id: UUID, limit: int = 50) -> List[Any]:
        return self.rec_repo.get_feedback_for_user(user_id=user_id, limit=limit)

    def get_active_recommendation(
        self,
        user_id: UUID,
        occasion: str = "Everyday",
        target_date: Optional[date] = None,
        calendar_event_id: Optional[UUID] = None,
    ) -> Optional[Recommendation]:
        """
        Retrieves the active persisted recommendation for this user, date, and occasion.
        Ensures stability across page navigation, occasion switching, and remounts.
        """
        import uuid
        target_date = target_date or date.today()
        laundry_service = LaundryService(self.db)
        laundry_service.apply_lazy_returns(user_id, target_date)

        # 1. Check daily_recommendations persistent storage (Rule 4.3)
        stored = laundry_service.repo.get_daily_recommendation(user_id, target_date, occasion)
        if stored:
            if stored.status == "no_items":
                empty_rec = Recommendation(
                    id=stored.id,
                    user_id=user_id,
                    outfit_id=None,
                    occasion=occasion,
                    recommendation_score=0.0,
                )
                empty_rec.status = "no_items"
                empty_rec.can_wear = False
                empty_rec.empty_reason = stored.empty_reason
                msg = (stored.empty_reason or {}).get("message") or f"No clothes found for {occasion}."
                empty_rec._custom_reasons = [msg]
                empty_rec._custom_context = {
                    "occasion": occasion,
                    "reasons": [msg],
                    "status": "no_items",
                    "empty_reason": stored.empty_reason,
                }
                empty_rec.filter_counts = (stored.empty_reason or {}).get("filter_counts")
                return empty_rec
            elif stored.status in ("active", "partial_outfit", "stale"):
                if stored.item_ids:
                    items = (
                        self.db.query(Clothing)
                        .filter(
                            Clothing.user_id == user_id,
                            Clothing.id.in_([UUID(i) for i in stored.item_ids]),
                        )
                        .all()
                    )
                    if len(items) == len(stored.item_ids):
                        laundry_settings = laundry_service.get_settings(user_id)
                        is_stale = stored.status == "stale" or any(
                            not laundry_service.is_available(it, target_date, laundry_settings)[0]
                            for it in items
                        )
                        outfit = None
                        if stored.outfit_hash:
                            try:
                                outfit = self.outfit_repo.get_by_id(UUID(stored.outfit_hash), user_id=user_id)
                            except Exception:
                                outfit = None
                        if not outfit:
                            outfit = Outfit(
                                id=UUID(stored.outfit_hash) if stored.outfit_hash else uuid.uuid4(),
                                user_id=user_id,
                                name=f"{occasion} Look",
                                occasion=occasion,
                                season="All-Season",
                            )
                        outfit.clothing_items = items
                        rec = self.db.query(Recommendation).filter(Recommendation.outfit_id == outfit.id).first()
                        if not rec:
                            rec = Recommendation(
                                id=stored.id,
                                user_id=user_id,
                                outfit_id=outfit.id,
                                occasion=occasion,
                                recommendation_score=0.92,
                            )
                        rec.outfit = outfit
                        rec.status = "stale" if is_stale else stored.status
                        rec.can_wear = rec.status == "active"
                        rec.missing_slots = (stored.empty_reason or {}).get("missing_slots")
                        rec.empty_reason = stored.empty_reason
                        rec._custom_reasons = getattr(rec, "_custom_reasons", None) or [f"Active curated look for {occasion}."]
                        rec._custom_context = {
                            "occasion": occasion,
                            "reasons": rec._custom_reasons,
                            "status": rec.status,
                            "can_wear": rec.can_wear,
                        }
                        return rec

        # 2. Fallback to querying recent recommendation records
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        query = (
            self.db.query(Recommendation)
            .filter(
                Recommendation.user_id == user_id,
                Recommendation.occasion == occasion,
                Recommendation.created_at >= cutoff,
            )
        )
        if calendar_event_id:
            try:
                event = self.calendar_repo.get_by_id(calendar_event_id, user_id=user_id)
                if event and getattr(event, "recommendation_id", None):
                    query = query.filter(Recommendation.id == event.recommendation_id)
            except Exception:
                pass
        rec = query.order_by(Recommendation.created_at.desc()).first()
        if rec and rec.outfit and rec.outfit.clothing_items:
            items = rec.outfit.clothing_items
            if all(
                getattr(i, "processing_status", "") != "failed"
                and not getattr(i, "review_required", False)
                and getattr(i, "is_finalized", True) is not False
                for i in items
            ):
                rec._custom_reasoning = getattr(rec, "_custom_reasoning", {}) or {
                    "compatibility": round(rec.recommendation_score or 0.9, 2),
                    "occasion": occasion,
                }
                rec._custom_context = getattr(rec, "_custom_context", {}) or {
                    "occasion": occasion,
                    "reasons": [f"Active curated look for {occasion}."],
                }
                rec._custom_reasons = getattr(rec, "_custom_reasons", []) or [f"Active curated look for {occasion}."]
                return rec
        return None
