from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.repositories.social_repository import SocialRepository


class NotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SocialRepository(db)

    def list_notifications(self, user_id: UUID, limit: int = 50) -> List[Dict[str, Any]]:
        notifs = self.repo.list_notifications(user_id=user_id, limit=limit)
        results = []
        now = datetime.now(timezone.utc)

        for n in notifs:
            created = n.created_at
            if created and created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            diff = now - (created or now)
            if diff.days == 0:
                if diff.seconds < 3600:
                    time_ago = f"{max(1, diff.seconds // 60)}m ago"
                else:
                    time_ago = f"{diff.seconds // 3600}h ago"
            elif diff.days == 1:
                time_ago = "Yesterday"
            else:
                time_ago = f"{diff.days}d ago"

            results.append({
                "id": n.id,
                "type": n.type,
                "title": n.title or "Notification",
                "message": n.message or "",
                "is_read": n.is_read,
                "target_id": None,
                "target_image": None,
                "link": None,
                "time_ago": time_ago,
                "action_user": None,
                "created_at": n.created_at,
            })
        return results

    def mark_read(self, notif_id: UUID, user_id: UUID) -> bool:
        return self.repo.mark_notification_read(notif_id, user_id)

    def mark_all_read(self, user_id: UUID) -> None:
        self.repo.mark_all_notifications_read(user_id)
