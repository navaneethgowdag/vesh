from typing import Optional, List
from uuid import UUID
import json
from fastapi import APIRouter, Depends, Query, status, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.moment import MomentCreate, MomentResponse, MomentActionResponse
from app.schemas.poll import PollCreate
from app.services.moment_service import MomentService
from app.services.image_service import image_service

router = APIRouter(prefix="/moments", tags=["moments"])


@router.get("/feed", response_model=List[MomentResponse])
def get_discovery_feed(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get active 24-hour outfit moments for For You discovery.
    Excludes expired moments, own moments, and previously seen/liked/skipped moments.
    """
    service = MomentService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_discovery_feed(current_user_id=viewer_id, limit=limit, offset=offset)


@router.get("/me", response_model=List[MomentResponse])
def get_my_active_moments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the authenticated creator's active (unexpired) 24-hour moments.
    """
    service = MomentService(db)
    return service.get_user_moments(user_id=current_user.id)


@router.get("/user/{user_id}", response_model=List[MomentResponse])
def get_user_active_moments(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get all active 24-hour outfit moments for a specific creator.
    Enforces following-only audience rule (or viewer is creator).
    """
    service = MomentService(db)
    viewer_id = current_user.id if current_user else None
    if not service.is_viewer_eligible(user_id, viewer_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view moments from this creator.",
        )
    return service.get_user_moments_for_viewer(creator_id=user_id, viewer_id=viewer_id)


@router.post("/upload", response_model=MomentResponse, status_code=status.HTTP_201_CREATED)
async def upload_moment(
    file: UploadFile = File(...),
    caption: Optional[str] = Form(""),
    occasion: Optional[str] = Form("Casual Daily"),
    tags: Optional[str] = Form(""),
    poll_question: Optional[str] = Form(None),
    poll_options: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Direct multipart/form-data upload for 24-hour outfit moments.
    Supports images (.jpg, .jpeg, .png, .webp) and short videos (.mp4, .webm, .mov).
    Avoids Base64 encoding bloat in JSON payloads and stores optimized static assets.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A media file (image or video) is required.",
        )

    media_bytes = await file.read()
    if not media_bytes or len(media_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        saved_media = image_service.save_media(
            media_bytes=media_bytes,
            filename=file.filename,
            content_type=file.content_type,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process media file: {e}",
        )

    # Process tags
    parsed_tags: List[str] = []
    if tags:
        parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    # Process poll if provided
    poll_in = None
    if poll_question and poll_options:
        options_list = []
        try:
            options_list = json.loads(poll_options)
        except Exception:
            options_list = [opt.strip() for opt in poll_options.split(",") if opt.strip()]

        if len(options_list) >= 2:
            poll_in = PollCreate(
                question=poll_question.strip(),
                options=options_list[:4],
                duration_hours=24,
            )

    service = MomentService(db)
    return service.create_moment(
        user_id=current_user.id,
        image_url=saved_media["image_url"],
        caption=caption or "",
        occasion=occasion or "Casual Daily",
        tags=parsed_tags,
        poll=poll_in,
    )


@router.post("", response_model=MomentResponse, status_code=status.HTTP_201_CREATED)
def publish_moment(
    moment_in: MomentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Publish a short-lived 24-hour outfit moment for For You discovery.
    Server calculates created_at and expires_at (+24h).
    """
    service = MomentService(db)
    return service.create_moment(
        user_id=current_user.id,
        image_url=moment_in.image_url,
        caption=moment_in.caption,
        occasion=moment_in.occasion,
        tags=moment_in.tags,
        poll=moment_in.poll,
    )


@router.get("/{moment_id}", response_model=MomentResponse)
def get_moment(
    moment_id: UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get a single 24-hour outfit moment by ID.
    Enforces expiration check and following-only audience authorization rule.
    """
    service = MomentService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_moment_by_id(moment_id=moment_id, viewer_id=viewer_id)


@router.delete("/{moment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_moment(
    moment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete own 24-hour outfit moment before expiration.
    """
    service = MomentService(db)
    service.delete_moment(moment_id=moment_id, user_id=current_user.id)
    return None


@router.post("/{moment_id}/like", response_model=MomentActionResponse)
def like_moment(
    moment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Like an outfit moment. Persists like, notifies creator, and marks as seen.
    """
    service = MomentService(db)
    return service.like_moment(moment_id=moment_id, user_id=current_user.id)


@router.post("/{moment_id}/skip", response_model=MomentActionResponse)
def skip_moment(
    moment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Skip an outfit moment. Does not create like or notification; marks as seen.
    """
    service = MomentService(db)
    return service.skip_moment(moment_id=moment_id, user_id=current_user.id)
