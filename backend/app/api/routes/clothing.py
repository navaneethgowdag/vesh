import io
import logging
from datetime import datetime, timezone
from typing import Optional
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
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.schemas.wardrobe import (
    ClothingUploadResponse,
    ClothingProcessingStatusResponse,
    ClothingImageActionResponse,
    ClothingPredictionResponse,
    ClothingAttributesUpdateRequest,
    ClothingAttributesResponse,
    ClothingFinalizeRequest,
    ClothingReanalyzeResponse,
)
from app.services.clothing_image_service import ClothingImageService
from app.services.job_service import JobService
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

    # 4. Initialize analysis record with queued status
    analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
    if not analysis:
        analysis = ClothingAnalysis(
            clothing_id=clothing.id,
            detected_category=clothing.category,
            feature_vector={
                "processing_status": "queued",
                "processing_stage": "queued",
                "review_required": False,
                "has_processed": False,
            },
        )
        db.add(analysis)
    else:
        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = "queued"
        fv["processing_stage"] = "queued"
        analysis.feature_vector = fv

    db.commit()
    db.refresh(clothing)

    # 5. Enqueue background processing job
    job_service = JobService(db)
    job_service.enqueue_garment_processing(user_id=current_user.id, clothing_id=clothing.id)

    logger.info(f"Clothing {clothing.id} created and queued for background processing.")

    return ClothingUploadResponse(
        item_id=clothing.id,
        status="queued",
        stage="queued",
        original_image_url=f"/api/v1/clothing/{clothing.id}/image/original",
        status_url=f"/api/v1/clothing/{clothing.id}/processing-status",
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

    v_attrs = finalize_req.verified_attributes if finalize_req else None
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
