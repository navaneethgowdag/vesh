import io
import uuid
import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from PIL import Image

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    HTTPException,
    Response,
    status,
)
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.schemas.wardrobe import (
    ClothingResponse,
    ClothingUploadResponse,
    ClothingProcessingStatusResponse,
    ClothingImageActionResponse,
    ClothingPredictionResponse,
    ClothingAttributesUpdateRequest,
    ClothingAttributesResponse,
    ClothingFinalizeRequest,
    BulkFinalizeRequest,
    BulkFinalizeResponse,
    ClothingReanalyzeResponse,
    ClothingAvatarAttributesResponse,
    BatchUploadResponse,
    BatchStatusResponse,
)
from app.services.clothing_image_service import ClothingImageService
from app.services.job_service import JobService
from app.services.batch_upload_service import BatchUploadService
from app.services.garment_classifier_service import garment_classifier
from app.services.clothing_prediction_service import prediction_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clothing", tags=["clothing"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB limit


@router.post(
    "/upload",
    response_model=ClothingUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_clothing_image(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    category: Optional[str] = Form("Tops"),
    color: Optional[str] = Form("White"),
    secondary_color: Optional[str] = Form(None),
    pattern: Optional[str] = Form("Solid"),
    material: Optional[str] = Form(None),
    fit: Optional[str] = Form("Regular"),
    brand: Optional[str] = Form(None),
    size: Optional[str] = Form(None),
    season: Optional[str] = Form("All-Season"),
    occasion: Optional[str] = Form("Casual Daily"),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts garment photograph (gallery, camera, selfie, worn or flat-lay),
    validates file, stores original binary in Neon PostgreSQL BYTEA,
    creates Clothing item, and dispatches background segmentation & catalog preparation.
    """
    # 1. Validate file format and size
    if not file.content_type or not (
        file.content_type.startswith("image/")
        or file.filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic", ".avif"))
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Supported formats: JPEG, PNG, WebP, HEIC.",
        )

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds 10MB limit (size: {round(len(image_bytes)/(1024*1024), 2)}MB).",
        )

    # Validate image payload can be decoded by PIL
    try:
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            pil_img.verify()
    except Exception as img_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupt or unreadable image data: {img_err}",
        )

    # 2. Create Clothing record in Neon PostgreSQL
    resolved_name = (name or "").strip()
    if not resolved_name:
        if file.filename:
            resolved_name = file.filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()
        else:
            resolved_name = f"{color or 'New'} {category or 'Piece'}"

    clothing = Clothing(
        user_id=current_user.id,
        name=resolved_name,
        category=category or "Tops",
        color=color or "White",
        secondary_color=secondary_color,
        pattern=pattern or "Solid",
        material=material,
        fit=fit or "Regular",
        brand=brand.strip() if brand else None,
        size=size,
        season=season or "All-Season",
        occasion=occasion or "Casual Daily",
        description=description.strip() if description else None,
    )
    db.add(clothing)
    db.flush()  # Generate clothing.id

    # 3. Store original image binary in Neon PostgreSQL BYTEA
    image_service = ClothingImageService(db)
    mime_type = file.content_type or "image/jpeg"
    image_service.store_image(
        clothing_id=clothing.id,
        user_id=current_user.id,
        image_bytes=image_bytes,
        image_type="original",
        mime_type=mime_type,
    )

    # Set default image URL to the binary endpoint
    clothing.image_url = f"/api/v1/clothing/{clothing.id}/image/original"

    # 4. Run AI attribute prediction on the ORIGINAL uploaded image immediately
    from app.services.clothing_processing_service import ClothingProcessingService
    processor = ClothingProcessingService(db)
    pred_res = processor.predict_original_garment(clothing_id=clothing.id, user_id=current_user.id)

    db.refresh(clothing)
    logger.info(f"Clothing {clothing.id} created, original image classified with status={clothing.processing_status}.")

    return ClothingUploadResponse(
        item_id=clothing.id,
        status=clothing.processing_status or "predictions_ready",
        stage=clothing.processing_stage or "predictions_ready",
        original_image_url=f"/api/v1/clothing/{clothing.id}/image/original",
        status_url=f"/api/v1/clothing/{clothing.id}/processing-status",
        prediction=pred_res.get("prediction"),
    )


@router.post(
    "/batch-upload",
    response_model=BatchUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def batch_upload_clothing_images(
    files: List[UploadFile] = File(...),
    category: Optional[str] = Form("Tops"),
    color: Optional[str] = Form("White"),
    season: Optional[str] = Form("All-Season"),
    occasion: Optional[str] = Form("Casual Daily"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts multiple garment photographs in a single request.
    Stores original images in Neon PostgreSQL BYTEA, initializes sequential queue state,
    and enqueues the first item to begin FIFO processing per user.
    """
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided for batch upload.",
        )

    if len(files) > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size exceeds maximum limit of 20 images (received {len(files)}).",
        )

    batch_id = uuid.uuid4()
    batch_svc = BatchUploadService(db)
    batch_svc.create_batch(current_user.id, len(files), batch_id=batch_id)
    image_service = ClothingImageService(db)

    first_valid_clothing_id = None
    seen_hashes_in_batch = set()

    for idx, file in enumerate(files):
        # 1. Format and readability check
        is_valid_format = bool(
            file.content_type
            and (
                file.content_type.startswith("image/")
                or (file.filename and file.filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic", ".avif")))
            )
        )

        image_bytes = await file.read()
        is_valid_size = 0 < len(image_bytes) <= MAX_IMAGE_BYTES

        import hashlib
        img_hash = hashlib.sha256(image_bytes).hexdigest() if image_bytes else None
        is_duplicate = False
        if img_hash:
            if img_hash in seen_hashes_in_batch:
                is_duplicate = True
            else:
                seen_hashes_in_batch.add(img_hash)

        is_readable = False
        if is_valid_format and is_valid_size and not is_duplicate:
            try:
                with Image.open(io.BytesIO(image_bytes)) as pil_img:
                    pil_img.verify()
                is_readable = True
            except Exception:
                is_readable = False

        # Name resolution
        raw_fn = file.filename or f"Item {idx + 1}"
        resolved_name = raw_fn.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()

        clothing = Clothing(
            user_id=current_user.id,
            name=resolved_name,
            category=category or "Tops",
            color=color or "White",
            season=season or "All-Season",
            occasion=occasion or "Casual Daily",
        )
        db.add(clothing)
        db.flush()

        mime_type = file.content_type or "image/jpeg"

        if is_readable:
            # Store original binary into Neon BYTEA
            image_service.store_image(
                clothing_id=clothing.id,
                user_id=current_user.id,
                image_bytes=image_bytes,
                image_type="original",
                mime_type=mime_type,
            )
            clothing.image_url = f"/api/v1/clothing/{clothing.id}/image/original"

            analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
            if not analysis:
                analysis = ClothingAnalysis(
                    clothing_id=clothing.id,
                    detected_category=clothing.category,
                    feature_vector={},
                )
                db.add(analysis)

            fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
            fv.update({
                "batch_id": str(batch_id),
                "sequence_order": idx,
                "filename": raw_fn,
                "image_hash": img_hash,
                "processing_status": "queued",
                "processing_stage": "queued",
                "review_required": False,
                "has_processed": False,
            })
            analysis.feature_vector = fv

            if first_valid_clothing_id is None:
                first_valid_clothing_id = clothing.id
        else:
            if is_duplicate:
                error_reason = "Duplicate image detected in upload batch"
            elif not is_readable and is_valid_size:
                error_reason = "Corrupt or unreadable image file"
            else:
                error_reason = "Image exceeds 10MB limit"

            analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
            if not analysis:
                analysis = ClothingAnalysis(
                    clothing_id=clothing.id,
                    detected_category=clothing.category,
                    feature_vector={},
                )
                db.add(analysis)

            fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
            fv.update({
                "batch_id": str(batch_id),
                "sequence_order": idx,
                "filename": raw_fn,
                "image_hash": img_hash,
                "processing_status": "failed",
                "processing_stage": "failed",
                "error_message": error_reason,
                "review_required": False,
                "has_processed": False,
            })
            analysis.feature_vector = fv

    db.commit()

    # Enqueue only the first valid item to initiate sequential processing
    if first_valid_clothing_id is not None:
        job_service = JobService(db)
        job_service.enqueue_garment_processing(
            user_id=current_user.id,
            clothing_id=first_valid_clothing_id,
            batch_id=batch_id,
            sequence_order=0,
        )
        logger.info(f"[BatchUpload] Batch {batch_id} created with {len(files)} items. Initiated with item {first_valid_clothing_id}.")

    return BatchUploadResponse(
        batch_id=batch_id,
        status="queued",
        total_items=len(files),
        status_url=f"/api/v1/clothing/batches/{batch_id}",
    )


@router.get(
    "/batches/{batch_id}",
    response_model=BatchStatusResponse,
)
def get_batch_processing_status(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Poll overall batch progress and individual item stages.
    Returns calculated progress, current item being processed, and individual item thumbnails.
    """
    batch_svc = BatchUploadService(db)
    try:
        status_dict = batch_svc.get_batch_status(batch_id=batch_id, user_id=current_user.id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this batch.")

    if status_dict.get("status") == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found.")

    return BatchStatusResponse(**status_dict)


@router.post(
    "/batches/{batch_id}/retry-failed",
    response_model=BatchStatusResponse,
)
def retry_failed_batch_items(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retry failed images in a batch without re-uploading.
    Idempotent: resets failed items to queued and re-enqueues the first retried item.
    """
    batch_svc = BatchUploadService(db)
    try:
        retry_res = batch_svc.retry_failed_items(batch_id=batch_id, user_id=current_user.id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this batch.")

    first_clothing_id = retry_res.get("first_clothing_id")
    if first_clothing_id:
        job_service = JobService(db)
        job_service.enqueue_garment_processing(
            user_id=current_user.id,
            clothing_id=first_clothing_id,
            batch_id=batch_id,
        )
        logger.info(f"[BatchUpload] Retrying batch {batch_id}: enqueued item {first_clothing_id}.")

    return BatchStatusResponse(**retry_res["batch_status"])


@router.post(
    "/batches/{batch_id}/cancel",
    response_model=BatchStatusResponse,
)
def cancel_batch_upload(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancel remaining queued items in a batch.
    """
    batch_svc = BatchUploadService(db)
    try:
        status_res = batch_svc.cancel_batch(batch_id=batch_id, user_id=current_user.id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this batch.")

    return BatchStatusResponse(**status_res)


@router.get(
    "/pending-review",
    response_model=List[ClothingResponse],
)
def get_pending_review_clothing(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all garments belonging to the authenticated user that require AI review,
    are actively being processed, or have failed analysis.
    """
    items = (
        db.query(Clothing)
        .options(joinedload(Clothing.analysis))
        .filter(Clothing.user_id == current_user.id)
        .order_by(Clothing.created_at.desc())
        .all()
    )
    # Filter to items requiring review, in progress, or failed (not yet finalized)
    pending_items = [
        item for item in items
        if not item.is_finalized or item.review_required or item.processing_status in ("predictions_ready", "ready_for_review", "manual_review_required", "queued", "processing", "failed")
    ]
    return pending_items


@router.post(
    "/bulk-finalize",
    response_model=BulkFinalizeResponse,
)
def bulk_finalize_clothing(
    req: BulkFinalizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk accept and finalize multiple garments whose AI predictions have completed.
    Enforces strict user ownership verification per item.
    """
    if not req.item_ids:
        return BulkFinalizeResponse(finalized_count=0, message="No item IDs provided.")

    count = 0
    for item_id in req.item_ids:
        clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
        if not clothing or clothing.user_id != current_user.id:
            continue
        try:
            prediction_service.finalize_clothing(db, clothing, current_user.id)
            count += 1
        except Exception as e:
            logger.warning(f"[BulkFinalize] Failed to finalize clothing {item_id}: {e}")

    return BulkFinalizeResponse(
        finalized_count=count,
        message=f"Successfully accepted {count} garment(s) into your wardrobe."
    )


@router.get(
    "/{item_id}/processing-status",
    response_model=ClothingProcessingStatusResponse,
)
def get_processing_status(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Poll processing status, stage, and quality review flag for an uploaded garment.
    Enforces strict user ownership authorization with automatic self-healing for stalled queue items.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    # Auto-heal: if job has been queued for >15s without worker claiming it, trigger fallback processing
    if clothing.processing_status == "queued" and clothing.created_at:
        now = datetime.now(timezone.utc)
        created_time = clothing.created_at.replace(
            tzinfo=timezone.utc if clothing.created_at.tzinfo is None else clothing.created_at.tzinfo
        )
        if (now - created_time).total_seconds() > 15:
            logger.info(
                f"[AutoHeal] Garment {item_id} has been queued for {round((now - created_time).total_seconds(), 1)}s. "
                "Triggering background processing fallback."
            )
            job_service = JobService(db)
            job_service.enqueue_garment_processing(user_id=current_user.id, clothing_id=clothing.id)
            db.refresh(clothing)

    is_proc = clothing.is_processed_available
    return ClothingProcessingStatusResponse(
        item_id=clothing.id,
        status=clothing.processing_status,
        stage=clothing.processing_stage,
        review_required=clothing.review_required,
        is_processed_available=is_proc,
        duration_seconds=clothing.processing_duration,
        error_message=clothing.processing_error or None,
        original_image_url=f"/api/v1/clothing/{clothing.id}/image/original",
        processed_image_url=f"/api/v1/clothing/{clothing.id}/image/processed" if is_proc else None,
    )


@router.post(
    "/{item_id}/remove-background",
    response_model=ClothingProcessingStatusResponse,
)
def remove_garment_background(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute garment segmentation and neutral white catalog image composition
    on the original image after attribute review.
    Decoupled from initial upload and prediction.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    from app.services.clothing_processing_service import ClothingProcessingService
    processor = ClothingProcessingService(db)
    res = processor.remove_garment_background(clothing_id=item_id, user_id=current_user.id)

    db.refresh(clothing)
    is_proc = clothing.is_processed_available
    return ClothingProcessingStatusResponse(
        item_id=clothing.id,
        status=clothing.processing_status or res.get("status", "ready_for_review"),
        stage=clothing.processing_stage or res.get("stage", "image_processing_completed"),
        review_required=clothing.review_required,
        is_processed_available=is_proc,
        duration_seconds=clothing.processing_duration or res.get("duration_seconds", 0.0),
        error_message=clothing.processing_error or res.get("error"),
        original_image_url=f"/api/v1/clothing/{clothing.id}/image/original",
        processed_image_url=f"/api/v1/clothing/{clothing.id}/image/processed" if is_proc else None,
    )


@router.post(
    "/{item_id}/retry-processing",
    response_model=ClothingProcessingStatusResponse,
)
def retry_processing(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Explicitly retry background processing for a garment that failed or was stalled.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    # Reset analysis state
    analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
    if analysis:
        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = "queued"
        fv["processing_stage"] = "queued"
        fv.pop("error_message", None)
        analysis.feature_vector = fv
        clothing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(clothing)

    job_service = JobService(db)
    job_service.enqueue_garment_processing(user_id=current_user.id, clothing_id=clothing.id)
    logger.info(f"[RetryProcessing] Re-enqueued processing for clothing {item_id}")

    return ClothingProcessingStatusResponse(
        item_id=clothing.id,
        status="queued",
        stage="queued",
        review_required=False,
        is_processed_available=False,
        duration_seconds=0.0,
        original_image_url=f"/api/v1/clothing/{clothing.id}/image/original",
        processed_image_url=None,
    )


@router.get("/{item_id}/image/original")
def get_original_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Serve original image binary stream from Neon PostgreSQL BYTEA.
    """
    image_service = ClothingImageService(db)
    user_id = current_user.id if current_user else None
    res = image_service.get_image(clothing_id=item_id, user_id=user_id, image_type="original")
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original image not found")

    image_bytes, mime_type = res
    return Response(
        content=image_bytes,
        media_type=mime_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/{item_id}/image/processed")
def get_processed_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Serve processed catalog image binary stream from Neon PostgreSQL BYTEA.
    """
    image_service = ClothingImageService(db)
    user_id = current_user.id if current_user else None
    res = image_service.get_image(clothing_id=item_id, user_id=user_id, image_type="processed")
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processed catalog image not ready or does not exist",
        )

    image_bytes, mime_type = res
    return Response(
        content=image_bytes,
        media_type=mime_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/{item_id}/image/thumbnail")
def get_thumbnail_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Serve lightweight 360x480 WebP thumbnail binary stream from Neon PostgreSQL BYTEA.
    Generates on-demand and caches to BYTEA if not yet present.
    Includes immutable cache headers and ETag for instant subsequent loads.
    """
    image_service = ClothingImageService(db)
    user_id = current_user.id if current_user else None
    res = image_service.get_or_create_thumbnail(clothing_id=item_id, user_id=user_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnail image not found",
        )

    image_bytes, mime_type = res
    etag = f'"{hashlib.md5(image_bytes).hexdigest()}"'

    return Response(
        content=image_bytes,
        media_type=mime_type,
        headers={
            "Cache-Control": "public, max-age=604800, immutable",
            "ETag": etag,
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post(
    "/{item_id}/image/accept",
    response_model=ClothingImageActionResponse,
)
def accept_processed_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept AI-processed catalog image: sets it as the primary garment image,
    marks processing as completed, and removes the review flag.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    image_service = ClothingImageService(db)
    if not image_service.has_image(item_id, current_user.id, image_type="processed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Processed catalog image is not yet available to accept.",
        )

    # Set processed image as the item's primary image
    clothing.image_url = f"/api/v1/clothing/{item_id}/image/processed"

    # Update metadata in Neon
    analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
    if analysis:
        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = "completed"
        fv["processing_stage"] = "completed"
        fv["review_required"] = False
        analysis.feature_vector = fv

    db.commit()
    db.refresh(clothing)

    return ClothingImageActionResponse(
        status="completed",
        item_id=clothing.id,
        image_url=clothing.image_url,
        message="Catalog-style garment image accepted and set as primary.",
    )


@router.post(
    "/{item_id}/image/reject",
    response_model=ClothingImageActionResponse,
)
def reject_processed_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject AI-processed catalog image: keeps the original uploaded photograph
    as primary and removes the review flag.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    # Revert primary image to original
    clothing.image_url = f"/api/v1/clothing/{item_id}/image/original"

    # Update metadata
    analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
    if analysis:
        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = "rejected_original_kept"
        fv["processing_stage"] = "completed"
        fv["review_required"] = False
        analysis.feature_vector = fv

    db.commit()
    db.refresh(clothing)

    return ClothingImageActionResponse(
        status="rejected_original_kept",
        item_id=clothing.id,
        image_url=clothing.image_url,
        message="Original photograph retained as primary garment image.",
    )


@router.post(
    "/{item_id}/image/retry",
    response_model=ClothingImageActionResponse,
)
def retry_processed_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Re-enqueue garment segmentation and catalog preparation for this item.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    # Reset status
    analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
    if analysis:
        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = "queued"
        fv["processing_stage"] = "queued"
        fv["review_required"] = False
        analysis.feature_vector = fv

    db.commit()

    # Enqueue job
    job_service = JobService(db)
    job_service.enqueue_garment_processing(user_id=current_user.id, clothing_id=clothing.id)

    return ClothingImageActionResponse(
        status="queued",
        item_id=clothing.id,
        image_url=clothing.image_url or f"/api/v1/clothing/{item_id}/image/original",
        message="Garment image processing re-enqueued.",
    )


# ---------------------------------------------------------
# Phase 2: Garment Understanding, Predictions & Attributes
# ---------------------------------------------------------

@router.get(
    "/attribute-options",
    response_model=Dict[str, List[str]],
)
def get_clothing_attribute_options():
    """
    Returns verified clean class options for all 9 model prediction heads:
    article_type, master_category, sub_category, base_colour, gender, season, usage, pattern, age_group.
    """
    from app.ai.fashion_model import fashion_model_service
    return fashion_model_service.get_attribute_options()


@router.get(
    "/{item_id}/predictions",
    response_model=ClothingPredictionResponse,
)
def get_clothing_predictions(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve original AI predictions, confidence scores, and alternatives for a garment.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    pred = prediction_service.get_prediction(db, clothing, current_user.id)
    if not pred:
        # Generate on-demand if image exists
        image_service = ClothingImageService(db)
        img_res = image_service.get_image(clothing.id, current_user.id, "processed")
        source = "processed"
        if not img_res:
            img_res = image_service.get_image(clothing.id, current_user.id, "original")
            source = "original"
        if img_res:
            try:
                from app.ai.fashion_model import fashion_model_service
                m_pred = fashion_model_service.predict(img_res[0])
                res = fashion_model_service.format_wardrobe_payload(m_pred, image_source=source)
            except Exception as me:
                logger.warning(f"Fashion model on-demand prediction fallback: {me}")
                res = garment_classifier.analyze_garment(img_res[0], image_source=source)
            pred = prediction_service.save_prediction(db, clothing, res, current_user.id)
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No predictions available for this clothing item")
    return pred


@router.get(
    "/{item_id}/attributes",
    response_model=ClothingAttributesResponse,
)
def get_clothing_attributes(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve current verified and predicted attributes along with audit trail of user corrections.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    return prediction_service.get_attributes(db, clothing, current_user.id)


@router.patch(
    "/{item_id}/attributes",
    response_model=ClothingAttributesResponse,
)
def update_clothing_attributes(
    item_id: UUID,
    updates: ClothingAttributesUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    User corrects or edits clothing attributes.
    Preserves original AI prediction while logging user corrections and updating verified attributes.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    update_dict = updates.model_dump(exclude_unset=True)
    return prediction_service.update_attributes(db, clothing, current_user.id, update_dict)


@router.post(
    "/{item_id}/finalize",
    response_model=ClothingAttributesResponse,
)
def finalize_clothing_item(
    item_id: UUID,
    finalize_req: Optional[ClothingFinalizeRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Finalize garment after review. Marks item active and ready in user's wardrobe.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    v_attrs = None
    if finalize_req:
        if finalize_req.verified_attributes:
            v_attrs = dict(finalize_req.verified_attributes)
        else:
            extras = finalize_req.model_extra or {}
            if extras:
                v_attrs = dict(extras)
    return prediction_service.finalize_clothing(db, clothing, current_user.id, v_attrs)


@router.post(
    "/{item_id}/reanalyze",
    response_model=ClothingReanalyzeResponse,
)
def reanalyze_clothing_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Re-run AI garment understanding and attribute extraction using catalog image (or original).
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    image_service = ClothingImageService(db)
    proc_res = image_service.get_image(clothing.id, current_user.id, "processed")
    source = "processed"
    if not proc_res:
        proc_res = image_service.get_image(clothing.id, current_user.id, "original")
        source = "original"

    if not proc_res:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No image available for reanalysis")

    prediction_res = garment_classifier.analyze_garment(proc_res[0], image_source=source)
    saved = prediction_service.save_prediction(db, clothing, prediction_res, current_user.id)
    return ClothingReanalyzeResponse(
        status="completed",
        message="Garment reanalyzed successfully.",
        prediction=saved,
    )


@router.get(
    "/{item_id}/avatar-attributes",
    response_model=ClothingAvatarAttributesResponse,
)
def get_clothing_avatar_attributes(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Expose finalized attributes formatted specifically for 2D avatar sprite selection and configuration.
    Includes category, subcategory, dominant color, secondary colors, pattern,
    silhouette, garment-specific attributes, processed image reference, and sprite key.
    """
    clothing = db.query(Clothing).filter(Clothing.id == item_id).first()
    if not clothing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")
    if clothing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clothing item")

    return prediction_service.get_avatar_attributes(db, clothing, current_user.id)

