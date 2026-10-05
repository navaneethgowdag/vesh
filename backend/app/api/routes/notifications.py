from typing import List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.services.notification_service import NotificationService
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[Dict[str, Any]])
def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    return service.list_notifications(user_id=current_user.id, limit=limit)


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    success = service.mark_read(notif_id=notification_id, user_id=current_user.id)
    return {"success": success}


@router.post("/mark-all-read")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    service.mark_all_read(user_id=current_user.id)
    return {"success": True}

