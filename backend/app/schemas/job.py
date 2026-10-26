from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


class JobCreateRequest(BaseModel):
    clothing_id: Optional[UUID] = None
    image_url: Optional[str] = None


class JobResponse(BaseModel):
    id: UUID
    user_id: UUID
    job_type: str
    status: str
    payload_ref: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

