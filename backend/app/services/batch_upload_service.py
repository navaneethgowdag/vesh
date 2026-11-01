import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import inspect

from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.upload_batch import UploadBatch

logger = logging.getLogger(__name__)


class BatchUploadService:
    """
    Manages multi-image batch uploads and sequential per-user queue tracking.
    Persists batch state, sequential ordering, and item statuses in Neon PostgreSQL,
    with dual-support for physical upload_batches table or ClothingAnalysis JSONB persistence.
    """

    def __init__(self, db: Session):
        self.db = db
        self._has_batch_table = self._check_batch_table_exists()

    def _check_batch_table_exists(self) -> bool:
        try:
            insp = inspect(self.db.bind)
            return "upload_batches" in insp.get_table_names()
        except Exception:
            return False

    def create_batch(
        self,
        user_id: UUID,
        total_items: int,
        batch_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> UUID:
        """Initialize and persist a new batch record."""
        bid = batch_id or uuid.uuid4()
        if self._has_batch_table:
            try:
                batch_rec = UploadBatch(
                    id=bid,
                    user_id=user_id,
                    status="queued",
                    total_items=total_items,
                    completed_items=0,
                    failed_items=0,
                    batch_metadata=metadata or {},
                )
                self.db.add(batch_rec)
                self.db.commit()
                logger.info(f"[BatchUploadService] Created UploadBatch {bid} in database table.")
                return bid
            except Exception as e:
                logger.warning(f"Failed to persist into upload_batches table ({e}). Using JSONB fallback.")
                self.db.rollback()

        logger.info(f"[BatchUploadService] Initialized batch {bid} for user {user_id} with {total_items} items.")
        return bid

    def get_batch_status(self, batch_id: UUID, user_id: UUID) -> Dict[str, Any]:
        """
        Calculate and return real persisted batch state and individual item statuses.
        Source of truth: Neon PostgreSQL records.
        """
        batch_id_str = str(batch_id)

        # Query all clothing analyses belonging to this batch
        analyses = (
            self.db.query(ClothingAnalysis)
            .filter(ClothingAnalysis.feature_vector["batch_id"].astext == batch_id_str)
            .all()
        )

        if not analyses:
            # Check if physical batch table has it
            if self._has_batch_table:
                b_row = self.db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
                if b_row and b_row.user_id == user_id:
                    return {
                        "batch_id": str(b_row.id),
                        "status": b_row.status,
                        "total_items": b_row.total_items,
                        "completed_items": b_row.completed_items,
                        "failed_items": b_row.failed_items,
                        "queued_items": 0,
                        "processing_items": 0,
                        "remaining_items": b_row.remaining_items,
                        "progress_percentage": b_row.progress_percentage,
                        "current_processing_item": None,
                        "items": [],
                    }
            return {
                "batch_id": batch_id_str,
                "status": "not_found",
                "total_items": 0,
                "completed_items": 0,
                "failed_items": 0,
                "queued_items": 0,
                "processing_items": 0,
                "remaining_items": 0,
                "progress_percentage": 0.0,
                "current_processing_item": None,
                "items": [],
            }

        clothing_ids = [a.clothing_id for a in analyses]
        clothing_items = {
            c.id: c
            for c in self.db.query(Clothing).filter(Clothing.id.in_(clothing_ids)).all()
        }

        # Check user ownership
        for c in clothing_items.values():
            if c.user_id != user_id:
                raise PermissionError("Access denied to this batch.")

        items_list: List[Dict[str, Any]] = []
        completed_count = 0
        failed_count = 0
        queued_count = 0
        processing_count = 0
        current_processing_item: Optional[Dict[str, Any]] = None

        for a in analyses:
            fv = dict(a.feature_vector) if isinstance(a.feature_vector, dict) else {}
            cid = a.clothing_id
            clothing = clothing_items.get(cid)
            name = clothing.name if clothing else "Clothing Item"
            seq = int(fv.get("sequence_order", 0))
            proc_status = fv.get("processing_status", "queued")
            stage = fv.get("processing_stage", "queued")
            error_msg = fv.get("error_message")
            duration = fv.get("processing_duration", 0.0)
            has_proc = bool(fv.get("has_processed", False))
            review_req = bool(fv.get("review_required", False))
            quality_info = fv.get("quality_assessment")

            if proc_status in ("ready_for_review", "completed"):
                completed_count += 1
            elif proc_status == "failed":
                failed_count += 1
            elif proc_status == "processing":
                processing_count += 1
            else:
                queued_count += 1

            item_dict = {
                "clothing_id": str(cid),
                "name": name,
                "sequence_order": seq,
                "status": proc_status,
                "stage": stage,
                "has_processed": has_proc,
                "review_required": review_req,
                "original_image_url": f"/api/v1/clothing/{cid}/image/original",
                "processed_image_url": f"/api/v1/clothing/{cid}/image/processed" if has_proc else None,
                "error": error_msg,
                "duration_seconds": duration,
                "quality": quality_info,
            }
            items_list.append(item_dict)

            if proc_status == "processing" and current_processing_item is None:
                current_processing_item = {
                    "clothing_id": str(cid),
                    "name": name,
                    "sequence_order": seq,
                    "stage": stage,
                }

        # Sort items strictly by sequence_order
        items_list.sort(key=lambda x: x["sequence_order"])

        total_items = len(items_list)
        remaining_items = max(0, total_items - (completed_count + failed_count))

        # Determine overall batch status
        if total_items == 0:
            batch_status = "completed"
        elif completed_count + failed_count == total_items:
            if failed_count == 0:
                batch_status = "completed"
            elif completed_count > 0:
                batch_status = "partially_completed"
            else:
                batch_status = "failed"
        elif processing_count > 0:
            batch_status = "processing"
        else:
            batch_status = "queued"

        progress_pct = (
            100.0
            if total_items == 0
            else min(100.0, round(((completed_count + failed_count) / total_items) * 100.0, 1))
        )

        # Sync with physical table if present
        if self._has_batch_table:
            try:
                b_rec = self.db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
                if b_rec:
                    b_rec.status = batch_status
                    b_rec.completed_items = completed_count
                    b_rec.failed_items = failed_count
                    if batch_status in ("completed", "partially_completed", "failed") and not b_rec.completed_at:
                        b_rec.completed_at = datetime.now(timezone.utc)
                    self.db.commit()
            except Exception:
                self.db.rollback()

        return {
            "batch_id": batch_id_str,
            "status": batch_status,
            "total_items": total_items,
            "completed_items": completed_count,
            "failed_items": failed_count,
            "queued_items": queued_count,
            "processing_items": processing_count,
            "remaining_items": remaining_items,
            "progress_percentage": progress_pct,
            "current_processing_item": current_processing_item,
            "items": items_list,
        }

    def get_next_queued_item(self, batch_id: UUID, user_id: UUID) -> Optional[UUID]:
        """
        Find the next item in the batch whose status is 'queued',
        maintaining strict sequence order.
        """
        analyses = (
            self.db.query(ClothingAnalysis)
            .filter(
                ClothingAnalysis.feature_vector["batch_id"].astext == str(batch_id),
                ClothingAnalysis.feature_vector["processing_status"].astext == "queued",
            )
            .all()
        )

        if not analyses:
            return None

        # Sort by sequence_order ASC
        sorted_analyses = sorted(
            analyses,
            key=lambda a: int((a.feature_vector or {}).get("sequence_order", 0)),
        )

        return sorted_analyses[0].clothing_id

    def retry_failed_items(self, batch_id: UUID, user_id: UUID) -> Dict[str, Any]:
        """
        Reset failed items in the batch to 'queued' and return the first clothing_id to resume.
        """
        analyses = (
            self.db.query(ClothingAnalysis)
            .filter(
                ClothingAnalysis.feature_vector["batch_id"].astext == str(batch_id),
                ClothingAnalysis.feature_vector["processing_status"].astext == "failed",
            )
            .all()
        )

        first_retry_id = None
        if analyses:
            # Sort by sequence order
            sorted_failed = sorted(
                analyses,
                key=lambda a: int((a.feature_vector or {}).get("sequence_order", 0)),
            )
            for a in sorted_failed:
                fv = dict(a.feature_vector) if isinstance(a.feature_vector, dict) else {}
                fv["processing_status"] = "queued"
                fv["processing_stage"] = "queued"
                fv["error_message"] = None
                a.feature_vector = fv

            self.db.commit()
            first_retry_id = sorted_failed[0].clothing_id
            logger.info(f"[BatchUploadService] Reset {len(analyses)} failed items to queued in batch {batch_id}.")

        return {
            "retried_count": len(analyses),
            "first_clothing_id": first_retry_id,
            "batch_status": self.get_batch_status(batch_id, user_id),
        }
