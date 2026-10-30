import random
from datetime import datetime, date, timezone
from typing import List, Dict, Any, Optional, Tuple, Set
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
    if "saree" in cat or "saree" in sub or "sari" in cat or "sari" in sub or "saree" in name:
        return "indian_saree"
    if ("blouse" in cat or "blouse" in sub or "blouse" in name) and (grp == "indian" or "choli" in name or "saree" in name):
        return "indian_blouse"
    if cat == "blouse" or sub == "blouse":
        return "indian_blouse"
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

    if "formal" in style or "black tie" in style:
        base = min(1.0, base + 0.15)
    elif "casual" in style or "relaxed" in style:
        base = max(0.1, base - 0.10)

    return round(base, 2)


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
    # Phase 3 Recommendation Generator (With Calendar Prerequisite)
    # ---------------------------------------------------------------------
    async def generate_recommendations(
        self,
        user_id: UUID,
        calendar_event_id: UUID,
        occasion: Optional[str] = None,
        outfit_preference: Optional[str] = "any",
        formality: Optional[float] = None,
        preferred_colors: Optional[List[str]] = None,
        avoided_colors: Optional[List[str]] = None,
        specific_clothing_id: Optional[UUID] = None,
        limit: int = 5,
        city: str = "New York",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> List[Recommendation]:
        """
        Phase 3 Deterministic AI Outfit Recommendation Engine.
        Calendar event is a mandatory prerequisite.
        Generates category-aware, formality-compatible, weather-calibrated outfit combinations.
        """
        # 1. MANDATORY CALENDAR PREREQUISITE VALIDATION
        if not calendar_event_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Calendar event is a mandatory prerequisite to generate outfit recommendations.",
            )

        event = self.calendar_repo.get_by_id(calendar_event_id, user_id=user_id)
        if not event or event.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified calendar event was not found or does not belong to you.",
            )

        target_occasion = occasion or event.occasion or "Casual Daily"
        target_date = event.event_date or date.today()
        event_notes = event.notes or ""

        # 2. WARDROBE RETRIEVAL & SUFFICIENCY AUDIT
        raw_wardrobe = self.wardrobe_repo.list_for_user(user_id, limit=300)
        if not raw_wardrobe:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Your wardrobe is empty. Add clothing items to receive AI outfit recommendations.",
            )

        # Filter out failed items or items without basic metadata
        eligible_wardrobe = [
            i for i in raw_wardrobe
            if getattr(i, "processing_status", "") != "failed"
        ]

        if not eligible_wardrobe:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="No eligible clothing items found in your wardrobe. Items undergoing processing or in failed states cannot be styled.",
            )

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
        can_western_two_piece = bool(buckets["western_top"] and buckets["western_bottom"] and buckets["footwear"])
        can_western_dress = bool(buckets["western_dress"] and buckets["footwear"])
        can_indian_saree = bool(buckets["indian_saree"] and buckets["indian_blouse"] and buckets["footwear"])
        can_indian_kurta = bool(buckets["indian_kurta"] and (buckets["indian_bottom"] or buckets["western_bottom"]) and buckets["footwear"])
        can_indian_kurti = bool(buckets["indian_kurti"] and (buckets["indian_bottom"] or buckets["western_bottom"]) and buckets["footwear"])
        can_indian_lehenga = bool(buckets["indian_lehenga"] and buckets["indian_blouse"] and buckets["indian_dupatta"] and buckets["footwear"])
        can_indian_sherwani = bool(buckets["indian_sherwani"] and (buckets["indian_bottom"] or buckets["western_bottom"]) and buckets["footwear"])

        any_archetype_possible = any([
            can_western_two_piece,
            can_western_dress,
            can_indian_saree,
            can_indian_kurta,
            can_indian_kurti,
            can_indian_lehenga,
            can_indian_sherwani,
        ])

        if not any_archetype_possible:
            # Construct a structured, helpful explanation of what is missing
            missing_parts = []
            if not buckets["footwear"]:
                missing_parts.append("footwear (shoes, sandals, heels, or flats)")
            if not buckets["western_top"] and not buckets["western_dress"] and not buckets["indian_saree"] and not buckets["indian_kurta"] and not buckets["indian_kurti"]:
                missing_parts.append("tops, shirts, kurtas, or dresses")
            if not buckets["western_bottom"] and not buckets["indian_bottom"] and not buckets["western_dress"] and not buckets["indian_saree"]:
                missing_parts.append("bottoms, jeans, or trousers")
            if buckets["indian_saree"] and not buckets["indian_blouse"]:
                missing_parts.append("a matching blouse for your saree")

            detail_msg = (
                f"Insufficient wardrobe items to construct a complete outfit. "
                f"Please add {', '.join(missing_parts) if missing_parts else 'complementary pieces'} "
                f"to enable outfit synthesis."
            )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=detail_msg,
            )

        # 3. WEATHER FETCHING (With Graceful Fallback)
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
            condition = weather.get("condition", "Pleasant")
        except Exception:
            # Engine remains weather-neutral gracefully without error
            temp = 22.0
            feels_like = 22.0
            humidity = 50
            rain_prob = 10
            condition = "Pleasant"
            weather = {"city": city, "temp": temp, "condition": condition}

        if temp >= 25.0:
            target_season = "Summer"
        elif temp <= 12.0:
            target_season = "Winter"
        elif temp <= 18.0:
            target_season = "Autumn"
        else:
            target_season = "Spring"

        # 4. CANDIDATE COMBINATION GENERATOR
        candidates = self._generate_archetype_candidates(
            buckets=buckets,
            outfit_preference=(outfit_preference or "any").lower(),
            temp=temp,
            rain_prob=rain_prob,
        )

        if not candidates:
            # Fallback: assemble any available top + bottom + footwear
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
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Unable to assemble valid outfit combinations from eligible items.",
                )

        # 5. HARD FILTERING
        user_pref = self.user_repo.get_preferences(user_id)
        learned_pref = self.user_repo.get_or_create_learned_preferences(user_id)
        recent_recs = self.rec_repo.list_history(user_id, limit=20)
        recent_outfit_ids = {r.outfit_id for r in recent_recs if r.outfit_id}

        filtered_candidates = []
        avoided_colors_set = set(c.lower().strip() for c in (avoided_colors or []))

        for items in candidates:
            # A. Specific Clothing ID Lock-In
            if specific_clothing_id and not any(i.id == specific_clothing_id for i in items):
                continue

            # B. Avoided Colors Exclusion
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

            # C. Formality Delta Filter: max delta <= 0.40
            formalities = [get_garment_formality(i) for i in items]
            delta_formality = max(formalities) - min(formalities)
            if delta_formality > 0.40:
                continue

            # D. Target Formality Filter (if user requested specific formality level)
            if formality is not None:
                avg_formality = sum(formalities) / len(formalities)
                if abs(avg_formality - formality) > 0.45:
                    continue

            # E. Occasion Clash Hard Filter
            if not self._passes_occasion_hard_filter(items, target_occasion):
                continue

            # F. Weather Suitability Hard Filter
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

            # G. Strict Indian Saree rule: NO western pants/jeans paired with a Saree!
            is_saree = any(classify_garment(i) == "indian_saree" for i in items)
            if is_saree:
                has_western_pants = any(classify_garment(i) in ("western_bottom", "western_top") for i in items)
                if has_western_pants:
                    continue

            filtered_candidates.append(items)

        if not filtered_candidates:
            # If hard filters removed everything, relax formality delta slightly or fallback to top candidates
            filtered_candidates = candidates[:3]
            # If hard filters removed all candidates, check if any candidate can pass with a slight relaxation (delta <= 0.45)
            # while still strictly respecting avoided colors and Indian Saree rules.
            relaxed = []
            for items in candidates:
                # Never relax avoided colors
                if avoided_colors_set and any(
                    (it.color or "").lower().strip() in avoided_colors_set or
                    (it.secondary_color or "").lower().strip() in avoided_colors_set
                    for it in items
                ):
                    continue

                # Never relax Saree rule
                if any(classify_garment(i) == "indian_saree" for i in items) and any(classify_garment(i) in ("western_bottom", "western_top") for i in items):
                    continue

                formalities = [get_garment_formality(i) for i in items]
                delta_formality = max(formalities) - min(formalities)
                if delta_formality <= 0.45:
                    relaxed.append(items)

            if relaxed:
                filtered_candidates = relaxed[:3]
            else:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Wardrobe items violate style, color, or formality constraints. Please add compatible items to receive recommendations.",
                )

        # 6. DETERMINISTIC SCORING & PERSONALIZED RANKING
        personalization_enabled = getattr(user_pref, "personalization_enabled", True) if user_pref else True
        scored_candidates: List[Tuple[List[Clothing], Dict[str, Any]]] = []

        for items in filtered_candidates:
            score_data = self._score_candidate_deterministic(
                items=items,
                target_occasion=target_occasion,
                target_season=target_season,
                temp=temp,
                rain_prob=rain_prob,
                condition=condition,
                user_pref=user_pref,
                learned_pref=learned_pref,
                preferred_colors=preferred_colors or [],
                recent_outfit_ids=recent_outfit_ids,
            )
            compat_score = score_data["total_score"]

            if personalization_enabled:
                s_pref, s_div, p_breakdown, p_rationales = self.personalization_service.score_candidate_personalization(
                    items=items,
                    target_occasion=target_occasion,
                    user_id=user_id,
                    user_pref=user_pref,
                    recent_outfit_ids=recent_outfit_ids,
                )
                conf = float(getattr(learned_pref, "confidence_score", 0.05) or 0.05)
                # Dynamic weighting for cold-start adaptation:
                # As confidence increases, personalization weight scales up to 25%
                w_pref = 0.25 * conf
                w_div = 0.10
                w_compat = 1.0 - w_pref - w_div
                final_score = round(w_compat * compat_score + w_pref * s_pref + w_div * s_div, 3)

                score_data["total_score"] = final_score
                score_data["reasoning"]["compatibility"] = compat_score
                score_data["reasoning"]["personalization"] = s_pref
                score_data["reasoning"]["diversity"] = s_div
                score_data["reasoning"]["confidence"] = conf
                score_data["reasoning"]["is_personalized"] = True
                score_data.setdefault("score_breakdown", {})["personalization"] = p_breakdown

                # If personalized rationales exist, prioritize them
                if p_rationales:
                    combined_reasons = p_rationales + [r for r in score_data["reasons"] if r not in p_rationales]
                    score_data["reasons"] = combined_reasons[:4]
            else:
                score_data["reasoning"]["compatibility"] = compat_score
                score_data["reasoning"]["is_personalized"] = False

            scored_candidates.append((items, score_data))

        # Sort descending by final score
        scored_candidates.sort(key=lambda x: x[1]["total_score"], reverse=True)

        # 7. DEDUPLICATION & PERSISTENCE
        distinct_combinations: List[Tuple[List[Clothing], Dict[str, Any]]] = []
        seen_signatures: Set[frozenset] = set()

        for items, score_data in scored_candidates:
            sig = frozenset(i.id for i in items)
            if sig not in seen_signatures:
                seen_signatures.add(sig)
                distinct_combinations.append((items, score_data))
                if len(distinct_combinations) >= limit:
                    break

        created_recommendations: List[Recommendation] = []

        for idx, (selected_items, s_data) in enumerate(distinct_combinations):
            outfit_name = f"{target_occasion} Look {idx + 1}"
            clothing_ids = [i.id for i in selected_items]

            # Create or reuse persistent Outfit in Neon PostgreSQL
            outfit = self.outfit_repo.create(
                user_id=user_id,
                clothing_item_ids=clothing_ids,
                name=outfit_name,
                description=s_data["explanations"]["overall_rationale"],
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
            rec._custom_reasoning = s_data["reasoning"]
            rec._custom_context = s_data["context"]
            rec._custom_reasons = s_data["reasons"]
            rec.outfit = outfit
            rec.outfit.clothing_items = selected_items

            created_recommendations.append(rec)

        return created_recommendations

    # ---------------------------------------------------------------------
    # Archetype Combination Generators
    # ---------------------------------------------------------------------
    def _generate_archetype_candidates(
        self,
        buckets: Dict[str, List[Clothing]],
        outfit_preference: str,
        temp: float,
        rain_prob: int,
    ) -> List[List[Clothing]]:
        candidates = []

        # 1. Western Two-Piece Archetype: Top + Bottom + Footwear (+ Optional Outerwear / Accessory)
        if outfit_preference in ("any", "western"):
            for top in buckets["western_top"][:4]:
                for btm in buckets["western_bottom"][:4]:
                    for shoe in buckets["footwear"][:3]:
                        base_combo = [top, btm, shoe]
                        if buckets["accessory"]:
                            base_combo.append(buckets["accessory"][0])
                        candidates.append(base_combo)

                        if buckets["outerwear"]:
                            for out in buckets["outerwear"][:2]:
                                layered_combo = [top, btm, shoe, out]
                                if buckets["accessory"]:
                                    layered_combo.append(buckets["accessory"][0])
                                candidates.append(layered_combo)

        # 2. Western Dress Archetype: Dress + Footwear (+ Optional Outerwear / Accessory)
        if outfit_preference in ("any", "western"):
            for dress in buckets["western_dress"][:3]:
                for shoe in buckets["footwear"][:3]:
                    base_combo = [dress, shoe]
                    if buckets["accessory"]:
                        base_combo.append(buckets["accessory"][0])
                    candidates.append(base_combo)

                    if buckets["outerwear"]:
                        for out in buckets["outerwear"][:2]:
                            layered_combo = [dress, shoe, out]
                            if buckets["accessory"]:
                                layered_combo.append(buckets["accessory"][0])
                            candidates.append(layered_combo)

        # 3. Western Formal Suit Archetype: Blazer + Top + Trousers + Footwear
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
                for blz in blazers[:2]:
                    for top in buckets["western_top"][:3]:
                        for tr in trousers[:2]:
                            for shoe in buckets["footwear"][:2]:
                                candidates.append([blz, top, tr, shoe])

        # 4. Indian Saree Archetype: Saree + Blouse + Footwear (+ Accessory)
        # STRICT RULE: Saree must pair ONLY with Blouse and elegant Footwear (Sandals/Heels/Flats).
        # STRICTLY NO western bottoms or jeans!
        if outfit_preference in ("any", "indian"):
            for saree in buckets["indian_saree"][:4]:
                for blouse in buckets["indian_blouse"][:3]:
                    saree_shoes = [
                        i for i in buckets["footwear"]
                        if classify_garment(i) == "footwear" and not ("sneakers" in (i.name or "").lower() or "boots" in (i.name or "").lower())
                    ] or buckets["footwear"]
                    for shoe in saree_shoes[:2]:
                        combo = [saree, blouse, shoe]
                        if buckets["accessory"]:
                            combo.append(buckets["accessory"][0])
                        candidates.append(combo)

        # 5. Indian Kurta Archetype: Kurta + Bottom (Indian or Western) + Footwear (+ Dupatta)
        if outfit_preference in ("any", "indian"):
            k_bottoms = buckets["indian_bottom"] or buckets["western_bottom"]
            for kurta in buckets["indian_kurta"][:3]:
                for btm in k_bottoms[:3]:
                    for shoe in buckets["footwear"][:2]:
                        combo = [kurta, btm, shoe]
                        if buckets["indian_dupatta"]:
                            combo.append(buckets["indian_dupatta"][0])
                        candidates.append(combo)

        # 6. Indian Kurti Archetype: Kurti + Bottom + Footwear (+ Dupatta)
        if outfit_preference in ("any", "indian"):
            k_bottoms = buckets["indian_bottom"] or buckets["western_bottom"]
            for kurti in buckets["indian_kurti"][:3]:
                for btm in k_bottoms[:3]:
                    for shoe in buckets["footwear"][:2]:
                        combo = [kurti, btm, shoe]
                        if buckets["indian_dupatta"]:
                            combo.append(buckets["indian_dupatta"][0])
                        candidates.append(combo)

        # 7. Indian Lehenga Archetype: Lehenga + Blouse + Dupatta + Footwear
        if outfit_preference in ("any", "indian"):
            for leh in buckets["indian_lehenga"][:2]:
                for blz in buckets["indian_blouse"][:2]:
                    for dup in (buckets["indian_dupatta"][:2] or [leh]):
                        for shoe in buckets["footwear"][:2]:
                            combo = [leh, blz, shoe]
                            if dup != leh:
                                combo.append(dup)
                            candidates.append(combo)

        # 8. Indian Sherwani Archetype: Sherwani + Bottom + Formal Footwear
        if outfit_preference in ("any", "indian"):
            s_bottoms = buckets["indian_bottom"] or buckets["western_bottom"]
            for sher in buckets["indian_sherwani"][:2]:
                for btm in s_bottoms[:2]:
                    for shoe in buckets["footwear"][:2]:
                        candidates.append([sher, btm, shoe])

        # 9. Fusion Kurti + Denim Archetype: Kurti + Jeans + Flats/Sneakers
        if outfit_preference in ("any", "fusion"):
            jeans = [i for i in buckets["western_bottom"] if "jeans" in (i.name or "").lower() or "jeans" in (i.category or "").lower()]
            for kurti in (buckets["indian_kurti"] or buckets["indian_kurta"])[:3]:
                for jn in jeans[:2]:
                    for shoe in buckets["footwear"][:2]:
                        candidates.append([kurti, jn, shoe])

        # 10. Fusion Blazer + Kurta Archetype: Blazer + Kurta + Trousers + Footwear
        if outfit_preference in ("any", "fusion"):
            blazers = [
                i for i in buckets["outerwear"]
                if "blazer" in (i.name or "").lower() or "blazer" in (i.category or "").lower()
            ]
            for blz in blazers[:2]:
                for kurta in buckets["indian_kurta"][:2]:
                    for btm in (buckets["indian_bottom"] or buckets["western_bottom"])[:2]:
                        for shoe in buckets["footwear"][:2]:
                            candidates.append([blz, kurta, btm, shoe])

        return candidates

    # ---------------------------------------------------------------------
    # Occasion Hard Filtering
    # ---------------------------------------------------------------------
    def _passes_occasion_hard_filter(self, items: List[Clothing], occasion: str) -> bool:
        occ = occasion.lower()

        # Formal / Work settings reject purely athletic or beachwear
        if any(k in occ for k in ["work", "office", "formal", "business"]):
            for i in items:
                style = (i.style or "").lower()
                name = (i.name or "").lower()
                cat = (i.category or "").lower()
                if "gym" in name or "athletic" in style or "sport" in style:
                    return False
                if "distressed" in name or "ripped" in name:
                    return False
                if cat == "shorts" or "shorts" in name:
                    return False

        # Wedding / Festive settings prefer ethnic or high formality; reject pure gym wear
        if any(k in occ for k in ["wedding", "festive", "traditional"]):
            for i in items:
                name = (i.name or "").lower()
                style = (i.style or "").lower()
                if "gym" in name or "sport" in style or "shorts" in name:
                    return False

        # Casual Daily settings reject heavy bridal lehengas or black-tie sherwanis
        if "casual" in occ:
            for i in items:
                c_type = classify_garment(i)
                if c_type in ("indian_sherwani", "indian_lehenga"):
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

        # 6. Season Suitability (Weight: 5% / 0.05)
        score_season = self._compute_season_score(items, target_season)

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
    def _compute_occasion_score(self, items: List[Clothing], occasion: str) -> float:
        occ = occasion.lower()
        scores = []
        for i in items:
            it_occ = (i.occasion or "").lower()
            it_style = (i.style or "").lower()
            c_type = classify_garment(i)

            if "work" in occ or "office" in occ:
                if c_type in ("outerwear", "western_top", "western_bottom") and ("shirt" in (i.name or "").lower() or "pants" in (i.name or "").lower() or "blazer" in (i.name or "").lower()):
                    scores.append(0.98)
                elif c_type in ("indian_kurti", "indian_kurta"):
                    scores.append(0.92)
                else:
                    scores.append(0.85)
            elif "wedding" in occ or "festive" in occ:
                if c_type in ("indian_saree", "indian_lehenga", "indian_sherwani", "indian_blouse", "indian_dupatta"):
                    scores.append(0.98)
                elif c_type in ("indian_kurta", "indian_kurti"):
                    scores.append(0.92)
                elif c_type == "outerwear" and "blazer" in (i.name or "").lower():
                    scores.append(0.88)
                else:
                    scores.append(0.70)
            elif "date" in occ:
                if "chic" in it_style or "elegant" in it_style or c_type in ("western_dress", "indian_saree"):
                    scores.append(0.96)
                else:
                    scores.append(0.88)
            else:
                # Casual daily
                scores.append(0.92)

        return sum(scores) / len(scores) if scores else 0.90

    def _compute_category_balance_score(self, items: List[Clothing]) -> float:
        types = set(classify_garment(i) for i in items)
        # Saree ensemble
        if "indian_saree" in types and "indian_blouse" in types and "footwear" in types:
            return 0.98 if "accessory" in types else 0.95
        # Lehenga ensemble
        if "indian_lehenga" in types and "indian_blouse" in types and "indian_dupatta" in types and "footwear" in types:
            return 0.98
        # Western formal suit
        if "outerwear" in types and "western_top" in types and "western_bottom" in types and "footwear" in types:
            return 0.98
        # Western two-piece
        if "western_top" in types and "western_bottom" in types and "footwear" in types:
            return 0.96 if "outerwear" in types or "accessory" in types else 0.92
        # Western dress
        if "western_dress" in types and "footwear" in types:
            return 0.96 if "outerwear" in types or "accessory" in types else 0.92
        # Kurta / Kurti
        if ("indian_kurta" in types or "indian_kurti" in types) and ("indian_bottom" in types or "western_bottom" in types) and "footwear" in types:
            return 0.96 if "indian_dupatta" in types else 0.92
        return 0.85

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

    def _compute_season_score(self, items: List[Clothing], target_season: str) -> float:
        tgt = target_season.lower()
        matches = 0
        for i in items:
            season = (i.season or "All-Season").lower()
            if "all" in season or tgt in season:
                matches += 1
        return matches / len(items) if items else 0.90

    def _compute_preference_rotation_bonus(
        self,
        items: List[Clothing],
        preferred_colors: List[str],
        user_pref: Any,
    ) -> float:
        bonus = 0.80

        # Preferred colors match
        pref_set = set(c.lower().strip() for c in preferred_colors)
        if user_pref and getattr(user_pref, "preferred_colors", None):
            for c in user_pref.preferred_colors:
                pref_set.add(c.lower().strip())

        if pref_set:
            has_pref = any((i.color or "").lower().strip() in pref_set for i in items)
            if has_pref:
                bonus += 0.10

        # Underused wear rotation bonus: reward unworn pieces (wear_count == 0)
        unworn_count = sum(1 for i in items if (getattr(i, "wear_count", 0) or 0) <= 1)
        if unworn_count > 0:
            bonus += 0.08  # Encourages capsule wardrobe rotation!

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
            limit=5,
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

        item_ids = [item.id for item in (outfit.clothing_items or [])]
        return {
            "success": True,
            "outfit_id": outfit.id,
            "user_id": user_id,
            "worn_at": wear_entry.worn_at if wear_entry else datetime.now(timezone.utc),
            "wear_count_updated": is_new,
            "clothing_items_updated": item_ids if is_new else [],
            "message": "Outfit marked as worn. Wear history and personalization updated." if is_new else "Outfit was already marked as worn today.",
        }

    def get_feedback_history(self, user_id: UUID, limit: int = 50) -> List[Any]:
        return self.rec_repo.get_feedback_for_user(user_id=user_id, limit=limit)
