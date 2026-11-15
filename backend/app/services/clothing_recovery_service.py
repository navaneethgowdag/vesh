import logging
import uuid
from typing import Dict, Any, List
from app.core.database import SessionLocal
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.jobs.clothing_jobs import process_garment_image_job

logger = logging.getLogger("tailorbird.recovery")


def recover_stuck_clothing_analyses(max_items: int = 50) -> int:
    """
    Scans for orphaned or stuck clothing analyses in 'queued' or 'processing' states
    and executes them sequentially to guarantee no upload is left unanalyzed.
    Safe: idempotent, skips items already processed or finalized.
    """
    db = SessionLocal()
    processed_count = 0
    try:
        analyses = (
            db.query(ClothingAnalysis)
            .filter(
                ClothingAnalysis.feature_vector["processing_status"].astext.in_([
                    "queued",
                    "processing",
                    "claimed_by_worker",
                    "analyzing_clothing",
                ])
            )
            .limit(max_items)
            .all()
        )

        stuck_items: List[Dict[str, Any]] = []
        for a in analyses:
            fv = a.feature_vector or {}
            # If it already has AI predictions, transition it to ready_for_review directly
            if fv.get("ai_predictions"):
                fv["processing_status"] = "ready_for_review"
                fv["processing_stage"] = "analysis_completed"
                fv["review_required"] = True
                a.feature_vector = fv
                db.commit()
                processed_count += 1
                continue

            clothing = db.query(Clothing).filter(Clothing.id == a.clothing_id).first()
            if not clothing:
                fv["processing_status"] = "failed"
                fv["error_message"] = "Parent clothing record missing"
                a.feature_vector = fv
                db.commit()
                continue

            stuck_items.append({
                "clothing_id": str(a.clothing_id),
                "user_id": str(clothing.user_id),
            })

        db.close()

        if not stuck_items:
            logger.info("[Recovery] No stuck clothing analyses found.")
            return processed_count

        logger.info(f"[Recovery] Found {len(stuck_items)} stuck clothing analyses. Processing sequentially...")
        for item in stuck_items:
            cid = item["clothing_id"]
            uid = item["user_id"]
            jid = str(uuid.uuid4())
            try:
                logger.info(f"[Recovery] Processing stuck clothing {cid} for user {uid}...")
                process_garment_image_job(
                    job_id=jid,
                    user_id=uid,
                    clothing_id=cid,
                )
                processed_count += 1
            except Exception as e:
                logger.warning(f"[Recovery] Failed to process stuck clothing {cid}: {e}")

        logger.info(f"[Recovery] Completed recovery. Processed {processed_count} clothing items.")
        return processed_count

    except Exception as exc:
        logger.warning(f"[Recovery] Error scanning for stuck items: {exc}")
        return processed_count
    finally:
        try:
            db.close()
        except Exception:
            pass
