"""
TailorBird Wardrobe Gap Analysis Service.
Analyzes user's actual wardrobe, confirmed AI attributes, wear history, and upcoming calendar
events to identify actionable gaps and underrepresented clothing categories.
Features:
- Deterministic analysis grounded in actual user data.
- User-confirmed attributes take precedence over model predictions.
- Accounts for upcoming calendar formality requirements.
- Zero external LLM or AI inference calls.
- In-memory caching with explicit refresh capability.
- User-level data isolation strictly enforced.
"""

from datetime import datetime, timezone, timedelta, date
import logging
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.clothing import Clothing
from app.models.wear_history import WearHistory
from app.repositories.calendar_repository import CalendarRepository
from app.services.color_coordination_service import ColorCoordinationService
from app.services.recommendation_service import classify_garment, get_garment_formality

logger = logging.getLogger(__name__)


class WardrobeGapService:
    # In-memory cache: user_id -> (timestamp, item_count, result_dict)
    _CACHE: Dict[str, Tuple[datetime, int, Dict[str, Any]]] = {}

    def __init__(self, db: Session):
        self.db = db
        self.calendar_repo = CalendarRepository(db)

    def analyze_wardrobe(self, user_id: UUID, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Performs comprehensive wardrobe gap analysis for authenticated user.
        Uses cached results if wardrobe has not changed and analysis is < 6 hours old.
        """
        user_key = str(user_id)

        # 1. Fetch user's active accepted clothing items (excluding pending AI review items)
        raw_items = (
            self.db.query(Clothing)
            .filter(Clothing.user_id == user_id)
            .all()
        )
        items = [
            i for i in raw_items
            if not getattr(i, "review_required", False)
            and getattr(i, "is_finalized", True) is not False
            and getattr(i, "processing_status", "") != "failed"
        ]
        item_count = len(items)

        # 2. Check cache
        if not force_refresh and user_key in self._CACHE:
            cached_time, cached_count, cached_data = self._CACHE[user_key]
            if cached_count == item_count and (datetime.now(timezone.utc) - cached_time) < timedelta(hours=6):
                return cached_data

        # 3. Handle Empty Wardrobe
        if item_count == 0:
            result = {
                "total_items": 0,
                "category_distribution": {},
                "formality_distribution": {"casual": 0, "smart_casual": 0, "formal": 0},
                "color_distribution": {"neutrals": 0, "accents": 0},
                "wear_stats": {"recently_worn": 0, "never_or_rarely_worn": 0},
                "gaps": [
                    {
                        "category": "Everyday Essentials",
                        "title": "Build Wardrobe Foundation",
                        "priority": "High",
                        "reason": "Your wardrobe is currently empty. Upload everyday staples to unlock AI outfit recommendations.",
                        "evidence": "0 clothing items cataloged in your wardrobe.",
                        "occasions": ["Casual Daily", "Work & Office"],
                        "suggested_garments": [
                            "Solid White or Black Cotton T-Shirt",
                            "Dark Indigo or Black Denim Jeans",
                            "Everyday Neutral Sneakers",
                            "Versatile Button-Down Shirt",
                        ],
                        "confidence": 1.0,
                    }
                ],
                "last_analyzed_at": datetime.now(timezone.utc).isoformat(),
                "is_balanced": False,
            }
            self._CACHE[user_key] = (datetime.now(timezone.utc), item_count, result)
            return result

        # 4. Attribute Breakdown & Taxonomy Counting
        categories: Dict[str, int] = {}
        colors: Dict[str, int] = {}
        formalities = {"casual": 0, "smart_casual": 0, "formal": 0}
        occasions: Dict[str, int] = {}
        neutral_count = 0
        accent_count = 0

        tops_count = 0
        bottoms_count = 0
        outerwear_count = 0
        footwear_count = 0
        formal_count = 0

        for item in items:
            # Archetype classification
            arch = classify_garment(item)
            cat_name = (item.category or "Other").title()
            categories[cat_name] = categories.get(cat_name, 0) + 1

            if arch in ("western_top", "indian_kurti", "indian_kurta", "indian_blouse"):
                tops_count += 1
            elif arch in ("western_bottom", "indian_bottom"):
                bottoms_count += 1
            elif arch == "outerwear":
                outerwear_count += 1
            elif arch == "footwear":
                footwear_count += 1

            # Formality
            f_val = get_garment_formality(item)
            if f_val < 0.45:
                formalities["casual"] += 1
            elif f_val <= 0.70:
                formalities["smart_casual"] += 1
            else:
                formalities["formal"] += 1
                formal_count += 1

            # Occasion
            occ = item.occasion or "Casual Daily"
            occasions[occ] = occasions.get(occ, 0) + 1

            # Color
            c_name = ColorCoordinationService.normalize_color_name(item.color or "Gray")
            colors[c_name.title()] = colors.get(c_name.title(), 0) + 1
            if ColorCoordinationService.is_neutral(c_name):
                neutral_count += 1
            else:
                accent_count += 1

        # 5. Wear History Analysis
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
        recent_wears = (
            self.db.query(WearHistory)
            .filter(WearHistory.user_id == user_id, WearHistory.worn_at >= cutoff_date)
            .count()
        )
        never_worn = sum(1 for i in items if (i.wear_count or 0) == 0)

        # 6. Upcoming Calendar Context
        upcoming_events = self.calendar_repo.list_by_user_and_date_range(
            user_id=user_id,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=14),
        )
        formal_events_count = sum(
            1 for e in upcoming_events
            if any(k in (e.event_type or "").lower() for k in ["interview", "meeting", "wedding", "formal", "business"])
            or any(k in (e.notes or "").lower() for k in ["formal", "black tie", "suit", "business"])
        )

        # 7. Identify Gaps
        gaps: List[Dict[str, Any]] = []

        # Gap A: Ratio of Tops to Bottoms
        if tops_count >= 3 and bottoms_count < 2:
            gaps.append({
                "category": "Everyday Essentials",
                "title": "Limited Bottoms for Rotation",
                "priority": "High" if bottoms_count == 0 else "Medium",
                "reason": f"Your wardrobe has {tops_count} tops but only {bottoms_count} bottoms, restricting outfit variety.",
                "evidence": f"{tops_count} tops vs {bottoms_count} bottoms in active wardrobe.",
                "occasions": ["Casual Daily", "Work & Office"],
                "suggested_garments": [
                    "Tailored Dark Chinos (Navy or Charcoal)",
                    "Classic Slim / Straight Dark Jeans",
                    "Versatile Neutral Trousers",
                ],
                "confidence": 0.95,
            })

        # Gap B: Missing Formal Attire for Calendar Events
        if formal_events_count > 0 and formal_count < 2:
            gaps.append({
                "category": "Formal & Occasion Wear",
                "title": "Insufficient Formal Attire for Upcoming Events",
                "priority": "High",
                "reason": f"You have {formal_events_count} professional/formal event(s) in your upcoming schedule, but only {formal_count} formal pieces.",
                "evidence": f"{formal_events_count} upcoming calendar event(s) require formal/business attire, but wardrobe has {formal_count} formal items.",
                "occasions": ["Work & Office", "Formal Event"],
                "suggested_garments": [
                    "Structured Tailored Blazer",
                    "Crisp White or Light Blue Oxford Shirt",
                    "Formal Pressed Dress Trousers",
                    "Classic Leather Dress Shoes or Loafers",
                ],
                "confidence": 0.96,
            })
        elif formal_count == 0 and item_count >= 5:
            gaps.append({
                "category": "Formal & Occasion Wear",
                "title": "Missing Formal Capsule",
                "priority": "Medium",
                "reason": "Your wardrobe is entirely casual. Adding 1-2 formal staples ensures readiness for unexpected meetings or dinners.",
                "evidence": f"0 of {item_count} items are classified as formal.",
                "occasions": ["Work & Office", "Formal Event"],
                "suggested_garments": [
                    "Dark Navy or Charcoal Blazer",
                    "Tailored Formal Pants",
                ],
                "confidence": 0.88,
            })

        # Gap C: Missing Layering / Outerwear
        if outerwear_count == 0 and item_count >= 4:
            gaps.append({
                "category": "Outerwear & Layering",
                "title": "No Layering or Outerwear Pieces",
                "priority": "Medium",
                "reason": "Outerwear expands outfit combinations significantly and provides weather adaptability.",
                "evidence": f"{item_count} items cataloged with 0 jackets, coats, or cardigans.",
                "occasions": ["Casual Daily", "Travel & Airport"],
                "suggested_garments": [
                    "Lightweight Denim or Utility Overshirt",
                    "Tailored Wool Blend Coat or Trench",
                    "Neutral Cardigan or Zip Bomber",
                ],
                "confidence": 0.92,
            })

        # Gap D: Missing Footwear
        if footwear_count == 0:
            gaps.append({
                "category": "Footwear",
                "title": "Wardrobe Missing Cataloged Footwear",
                "priority": "Medium",
                "reason": "No shoes are currently in your digital wardrobe, limiting full-look recommendations.",
                "evidence": "0 pairs of shoes found in wardrobe.",
                "occasions": ["Casual Daily", "Work & Office"],
                "suggested_garments": [
                    "Clean Minimalist White Sneakers",
                    "Dark Leather Loafers or Boots",
                ],
                "confidence": 0.94,
            })

        # Gap E: Color Balance & Neutral Saturation
        if item_count >= 6 and (neutral_count / item_count) >= 0.90:
            gaps.append({
                "category": "Color Balance",
                "title": "High Concentration of Neutrals",
                "priority": "Low",
                "reason": "Over 90% of your wardrobe consists of dark neutrals. Introducing subtle color accents can invigorate daily styling.",
                "evidence": f"{neutral_count} of {item_count} items are neutral shades.",
                "occasions": ["Casual Daily", "Weekend Outing"],
                "suggested_garments": [
                    "Olive, Sage, or Terracotta Accent Shirt",
                    "Mustard or Burgundy Layering Piece",
                ],
                "confidence": 0.82,
            })

        # Gap F: Underutilized Garments
        if never_worn >= 4 and item_count >= 8:
            gaps.append({
                "category": "Wardrobe Utilization",
                "title": "Multiple Unworn Garments",
                "priority": "Low",
                "reason": f"You have {never_worn} items that have never been logged in wear history. Consider styling them or adding versatile companions.",
                "evidence": f"{never_worn} of {item_count} garments have 0 logged wears.",
                "occasions": ["Casual Daily"],
                "suggested_garments": [
                    "Neutral Base T-Shirts to pair with unworn statement pieces",
                ],
                "confidence": 0.80,
            })

        # Sort gaps by priority: High -> Medium -> Low
        priority_order = {"High": 0, "Medium": 1, "Low": 2}
        gaps.sort(key=lambda x: priority_order.get(x["priority"], 3))

        result = {
            "total_items": item_count,
            "category_distribution": categories,
            "formality_distribution": formalities,
            "color_distribution": {
                "neutrals": neutral_count,
                "accents": accent_count,
                "breakdown": colors,
            },
            "occasions_distribution": occasions,
            "wear_stats": {
                "recently_worn_30_days": recent_wears,
                "unworn_garments": never_worn,
            },
            "gaps": gaps,
            "last_analyzed_at": datetime.now(timezone.utc).isoformat(),
            "is_balanced": len(gaps) == 0,
        }

        self._CACHE[user_key] = (datetime.now(timezone.utc), item_count, result)
        return result
