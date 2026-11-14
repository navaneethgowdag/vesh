"""
TailorBird Occasion Vault Router & Intelligence Service.
Manages special, premium, ceremonial, and luxury garments reserved for rare occasions.
Provides event preparation, care reminders, and longevity analytics without fabricating data.
"""

import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.clothing import Clothing
from app.models.calendar_event import CalendarEvent
from app.schemas.wardrobe import (
    ClothingResponse,
    VaultSettingsUpdateRequest,
    VaultReserveToggleRequest,
    VaultEventPrepRequest,
    VaultEventPrepResponse,
    VaultAnalyticsResponse,
)
from app.core.taxonomy import normalize_occasion, get_occasion_profile_dict
from app.services.recommendation_service import classify_garment, get_garment_formality

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vault", tags=["occasion_vault"])


def _is_vault_item(item: Clothing) -> bool:
    """Returns True if garment belongs to the Occasion Vault."""
    tier = getattr(item, "wear_tier", "daily")
    if tier in ("luxury_special", "elevated"):
        return True
    if getattr(item, "is_luxury", False):
        return True
    groups = getattr(item, "wardrobe_groups", [])
    if "luxury_special" in [g.lower() for g in groups]:
        return True
    if getattr(item, "reserved_status", "available") != "available":
        return True
    return False


@router.get("/items", response_model=List[ClothingResponse])
def list_vault_items(
    wear_tier: Optional[str] = Query(None, description="'luxury_special', 'elevated', or 'all'"),
    reserved_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists all garments reserved in user's Occasion Vault.
    Strictly isolated to current authenticated user.
    """
    items = (
        db.query(Clothing)
        .filter(Clothing.user_id == current_user.id)
        .order_by(Clothing.created_at.desc())
        .all()
    )

    vault_items = [i for i in items if _is_vault_item(i)]

    if wear_tier and wear_tier.lower() != "all":
        vault_items = [i for i in vault_items if getattr(i, "wear_tier", "daily").lower() == wear_tier.lower()]

    if reserved_only:
        vault_items = [i for i in vault_items if getattr(i, "reserved_status", "available") == "reserved"]

    return vault_items


@router.put("/items/{item_id}/settings", response_model=ClothingResponse)
@router.post("/items/{item_id}/settings", response_model=ClothingResponse)
def update_vault_settings(
    item_id: UUID,
    settings_in: VaultSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates Occasion Vault settings, restrictions, wear tier, or pricing for a garment.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    data = settings_in.model_dump(exclude_unset=True)
    for field, val in data.items():
        if val is not None:
            setattr(clothing, field, val)
            clothing.set_provenance(field, "user_confirmed")

    clothing.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(clothing)
    return clothing


@router.post("/items/{item_id}/reserve", response_model=ClothingResponse)
def toggle_item_reservation(
    item_id: UUID,
    req: VaultReserveToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Quickly reserves or frees a garment for an upcoming special date.
    Reserved items are excluded from general daily recommendations.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    clothing.reserved_status = req.reserved_status
    if req.notes:
        clothing.notes = req.notes
    clothing.set_provenance("reserved_status", "user_confirmed")

    clothing.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(clothing)
    return clothing


@router.post("/event-prep", response_model=VaultEventPrepResponse)
def prepare_event_outfit(
    req: VaultEventPrepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Occasion Vault Event Preparation Intelligence (Part 7.1):
    When user has a wedding, gala, or important celebration:
    - Identifies suitable vault garments.
    - Evaluates combinations.
    - Checks availability and wear history.
    - Flags missing components (e.g., traditional shoes or formal trousers).
    - Surfaces garment care reminders (dry cleaning, ironing).
    """
    target_occasion_str = req.occasion or "Wedding"
    target_date = req.event_date or date.today()

    if req.event_id:
        cal_ev = (
            db.query(CalendarEvent)
            .filter(CalendarEvent.id == req.event_id, CalendarEvent.user_id == current_user.id)
            .first()
        )
        if cal_ev:
            target_occasion_str = cal_ev.occasion or cal_ev.title or target_occasion_str
            target_date = cal_ev.event_date or target_date

    # Resolve occasion in canonical taxonomy
    canon = normalize_occasion(target_occasion_str)
    if not canon:
        canon = normalize_occasion("wedding")  # default ceremonial fallback

    target_formality = canon.target_formality
    if req.attendee_role == "groom_bride":
        target_formality = min(1.0, target_formality + 0.08)
    elif req.attendee_role == "close_family":
        target_formality = min(1.0, target_formality + 0.04)

    # Fetch user clothes
    all_clothes = (
        db.query(Clothing)
        .filter(Clothing.user_id == current_user.id)
        .order_by(Clothing.created_at.desc())
        .all()
    )

    # Filter eligible vault garments for this occasion
    eligible_vault: List[Clothing] = []
    care_reminders: List[str] = []

    for item in all_clothes:
        # Availability
        if getattr(item, "laundry_status", "clean") == "in_laundry":
            continue
        if getattr(item, "review_required", False) or not getattr(item, "is_finalized", True):
            continue

        c_type = classify_garment(item)
        f = get_garment_formality(item)

        # Check suitability for ceremonial/special occasion
        is_suitable = False
        if c_type in canon.preferred_categories or f >= (canon.min_formality - 0.10):
            is_suitable = True

        # Check suitable_occasions whitelist if set
        so = [s.lower() for s in getattr(item, "suitable_occasions", [])]
        if so and not any(canon.id in s or s in canon.id for s in so):
            is_suitable = False

        if is_suitable and _is_vault_item(item):
            eligible_vault.append(item)
            c_type_care = getattr(item, "care_type", "machine_wash")
            if c_type_care in ("dry_clean_only", "delicate"):
                care_reminders.append(f"{item.name} requires {c_type_care.replace('_', ' ')} before the event.")

    # Deduplicate care reminders
    care_reminders = list(dict.fromkeys(care_reminders))

    # Evaluate combinations & missing components
    has_top_or_dress = any(classify_garment(i) in ("western_top", "western_dress", "indian_saree", "indian_kurta", "indian_kurti", "indian_sherwani", "indian_lehenga") for i in (eligible_vault or all_clothes))
    has_bottom = any(classify_garment(i) in ("western_bottom", "indian_bottom", "indian_blouse") for i in (eligible_vault or all_clothes))
    has_formal_shoes = any(
        classify_garment(i) == "footwear" and get_garment_formality(i) >= 0.60
        for i in all_clothes
    )

    missing_components: List[Dict[str, Any]] = []
    if not has_top_or_dress:
        missing_components.append({
            "slot": "top_or_dress",
            "severity": "critical",
            "message": f"No suitable special/formal top, dress, or traditional wear found for {canon.display_name}."
        })
    if not has_bottom and not any(classify_garment(i) in ("western_dress", "indian_saree", "indian_lehenga") for i in (eligible_vault or all_clothes)):
        missing_components.append({
            "slot": "bottom",
            "severity": "critical",
            "message": f"No compatible formal trousers or ethnic bottoms found."
        })
    if not has_formal_shoes:
        missing_components.append({
            "slot": "footwear",
            "severity": "important",
            "message": f"No matching formal footwear (oxfords, heels, or mojaris) found in your wardrobe."
        })

    # Recommended combinations
    recommended_combos: List[Dict[str, Any]] = []
    tops = [i for i in eligible_vault if classify_garment(i) in ("western_top", "indian_kurta", "indian_sherwani", "outerwear")]
    bottoms = [i for i in all_clothes if classify_garment(i) in ("western_bottom", "indian_bottom") and get_garment_formality(i) >= 0.60]
    one_pieces = [i for i in eligible_vault if classify_garment(i) in ("western_dress", "indian_saree", "indian_lehenga")]

    for op in one_pieces[:2]:
        p_data = [{"id": str(op.id), "name": op.name, "category": op.category, "color": op.color, "image": op.preferred_image_url, "image_url": op.preferred_image_url}]
        recommended_combos.append({
            "style": "One-Piece / Traditional",
            "style_notes": "One-Piece / Traditional",
            "items": p_data,
            "pieces": p_data,
            "ready": True,
        })
    for t in tops[:2]:
        for b in bottoms[:2]:
            p_data = [
                {"id": str(t.id), "name": t.name, "category": t.category, "color": t.color, "image": t.preferred_image_url, "image_url": t.preferred_image_url},
                {"id": str(b.id), "name": b.name, "category": b.category, "color": b.color, "image": b.preferred_image_url, "image_url": b.preferred_image_url},
            ]
            recommended_combos.append({
                "style": "Coordinated Two-Piece",
                "style_notes": "Coordinated Two-Piece",
                "items": p_data,
                "pieces": p_data,
                "ready": True,
            })

    status_readiness = "ready"
    if missing_components:
        status_readiness = "needs_attention" if any(m["severity"] == "critical" for m in missing_components) else "partial"

    readiness_score = 100 if status_readiness == "ready" else (65 if status_readiness == "partial" else 35)

    return VaultEventPrepResponse(
        occasion=canon.display_name,
        event_name=req.event_name or f"{canon.display_name} Event",
        event_date=target_date,
        attendee_role=req.attendee_role or "guest",
        target_formality=round(target_formality, 2),
        readiness_score=readiness_score,
        status=status_readiness,
        readiness_status=status_readiness,
        eligible_vault_items=eligible_vault[:15],
        recommended_combinations=recommended_combos[:3],
        missing_components=missing_components,
        care_reminders=care_reminders[:5],
        weather_note=f"Targeting formal elevation {round(target_formality, 2)} for {canon.display_name}.",
    )


@router.get("/analytics", response_model=VaultAnalyticsResponse)
def get_vault_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Occasion Vault Longevity & Usage Analytics (Part 7.3):
    Cost per wear, wear frequency, care breakdown, and un-worn inventory insights.
    """
    items = (
        db.query(Clothing)
        .filter(Clothing.user_id == current_user.id)
        .all()
    )

    vault_items = [i for i in items if _is_vault_item(i)]

    luxury_count = sum(1 for i in vault_items if getattr(i, "wear_tier", "daily") == "luxury_special" or getattr(i, "is_luxury", False))
    elevated_count = sum(1 for i in vault_items if getattr(i, "wear_tier", "daily") == "elevated")
    reserved_count = sum(1 for i in vault_items if getattr(i, "reserved_status", "available") == "reserved")
    in_care_count = sum(1 for i in vault_items if getattr(i, "reserved_status", "available") == "in_care")

    # Valuation & CPW
    prices = [float(i.purchase_price) for i in vault_items if getattr(i, "purchase_price", None) is not None]
    total_val = sum(prices) if prices else 0.0

    cpw_list = [i.cost_per_wear for i in vault_items if i.cost_per_wear is not None]
    avg_cpw = round(sum(cpw_list) / len(cpw_list), 2) if cpw_list else 0.0

    # Most worn & never worn
    worn_items = sorted(vault_items, key=lambda x: x.wear_count, reverse=True)
    most_used = [
        {"id": str(i.id), "name": i.name, "times_worn": i.wear_count, "wear_count": i.wear_count, "cost_per_wear": i.cost_per_wear or 0.0, "image_url": i.preferred_image_url}
        for i in worn_items if i.wear_count > 0
    ][:5]

    never_worn = [
        {"id": str(i.id), "name": i.name, "purchase_date": getattr(i, "purchase_date", None), "care_type": getattr(i, "care_type", "machine_wash"), "image_url": i.preferred_image_url}
        for i in vault_items if i.wear_count == 0
    ][:5]

    # Care type breakdown
    care_breakdown: Dict[str, int] = {}
    for i in vault_items:
        ct = getattr(i, "care_type", "machine_wash")
        care_breakdown[ct] = care_breakdown.get(ct, 0) + 1

    return VaultAnalyticsResponse(
        total_vault_items=len(vault_items),
        luxury_items_count=luxury_count,
        elevated_items_count=elevated_count,
        reserved_items_count=reserved_count,
        reserved_count=reserved_count,
        in_care_count=in_care_count,
        most_worn_luxury=most_used,
        most_used_special_items=most_used,
        never_worn_special_items=never_worn,
        total_valuation=total_val,
        total_vault_valuation=total_val,
        items_with_price_count=len(prices),
        average_cost_per_wear=avg_cpw,
        care_type_breakdown=care_breakdown,
        care_breakdown=care_breakdown,
    )
