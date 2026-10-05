from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from app.schemas.social import UserSummary


class NotificationResponse(BaseModel):
    id: UUID
    type: str  # like, comment, follow, daily_fit, milestone, collection_save
    title: str
    message: str
    is_read: bool = False
    target_id: Optional[str] = None
    target_image: Optional[str] = None
    link: Optional[str] = None
    time_ago: Optional[str] = None
    action_user: Optional[UserSummary] = None
    created_at: datetime

    model_config = {"from_attributes": True}

