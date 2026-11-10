from datetime import date
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.laundry_service import LaundryService

router = APIRouter(prefix="", tags=["laundry_and_wear"])


class WearRequest(BaseModel):
    item_ids: Optional[List[UUID]] = None
    outfit_id: Optional[UUID] = None
    date: Optional[date] = None
    source: Optional[str] = "daily_fit"


class WearUndoRequest(BaseModel):
    item_ids: Optional[List[UUID]] = None
    outfit_id: Optional[UUID] = None
    date: Optional[date] = None


class ItemLaundryActionRequest(BaseModel):
    action: str = Field(..., description="wash_now | send_to_laundry | mark_unavailable | restore")
    return_date: Optional[date] = None


class LaundrySettingsUpdate(BaseModel):
    default_max_wears: Optional[int] = Field(None, ge=1, le=30)
    default_wash_days: Optional[int] = Field(None, ge=0, le=14)
    category_overrides: Optional[Dict[str, Any]] = None
    same_item_cooldown_days: Optional[int] = Field(None, ge=0, le=7)
    auto_return_from_laundry: Optional[bool] = None


@router.post("/wear", status_code=status.HTTP_200_OK)
def record_wear(
    payload: WearRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = LaundryService(db)
    result = service.record_wear(
        user_id=current_user.id,
        item_ids=payload.item_ids,
        outfit_id=payload.outfit_id,
        target_date=payload.date,
        source=payload.source or "daily_fit",
    )
    return result


@router.post("/wear/undo", status_code=status.HTTP_200_OK)
def undo_wear(
    payload: WearUndoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = LaundryService(db)
    result = service.undo_wear(
        user_id=current_user.id,
        item_ids=payload.item_ids,
        outfit_id=payload.outfit_id,
        target_date=payload.date,
    )
    return result


@router.post("/clothing/{clothing_id}/laundry", status_code=status.HTTP_200_OK)
@router.post("/items/{clothing_id}/laundry", status_code=status.HTTP_200_OK)
def item_laundry_action(
    clothing_id: UUID,
    payload: ItemLaundryActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = LaundryService(db)
    try:
        updated = service.manual_laundry_action(
            user_id=current_user.id,
            item_id=clothing_id,
            action=payload.action,
            return_date=payload.return_date,
        )
        return {
            "success": True,
            "id": str(updated.id),
            "name": updated.name,
            "laundry_status": updated.laundry_status,
            "wear_count_since_wash": updated.wear_count_since_wash,
            "available_from": updated.available_from.isoformat() if updated.available_from else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/settings/laundry", status_code=status.HTTP_200_OK)
def get_laundry_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = LaundryService(db)
    settings = service.get_settings(current_user.id)
    return settings.to_dict()


@router.put("/settings/laundry", status_code=status.HTTP_200_OK)
def update_laundry_settings(
    payload: LaundrySettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = LaundryService(db)
    data = payload.model_dump(exclude_unset=True)
    updated = service.update_settings(current_user.id, data)
    return updated.to_dict()
