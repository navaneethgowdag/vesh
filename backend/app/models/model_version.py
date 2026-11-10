import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_tag = Column(String(50), nullable=False, unique=True, index=True)
    model_name = Column(String(100), nullable=False, default="efficientnet_b0_multitask")
    base_version = Column(String(50), nullable=True)
    status = Column(String(30), nullable=False, default="candidate", index=True)  # "production", "candidate", "rejected", "archived"
    checkpoint_path = Column(String(512), nullable=False)
    architecture_info = Column(JSONB, default=dict, nullable=False)
    class_mapping_version = Column(String(50), default="1.0.0", nullable=False)
    preprocessing_config = Column(JSONB, default=dict, nullable=False)
    dataset_manifest_path = Column(String(512), nullable=True)
    training_config = Column(JSONB, default=dict, nullable=False)
    evaluation_metrics = Column(JSONB, default=dict, nullable=False)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    promoted_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    created_by = relationship("User")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "version_tag": self.version_tag,
            "model_name": self.model_name,
            "base_version": self.base_version,
            "status": self.status,
            "checkpoint_path": self.checkpoint_path,
            "architecture_info": self.architecture_info or {},
            "class_mapping_version": self.class_mapping_version,
            "preprocessing_config": self.preprocessing_config or {},
            "dataset_manifest_path": self.dataset_manifest_path,
            "training_config": self.training_config or {},
            "evaluation_metrics": self.evaluation_metrics or {},
            "created_by_user_id": str(self.created_by_user_id) if self.created_by_user_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "promoted_at": self.promoted_at.isoformat() if self.promoted_at else None,
            "notes": self.notes,
        }
