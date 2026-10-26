from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from app.api.deps import get_current_user
from app.models.user import User
from app.services.image_service import image_service

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload and optimize an image file.
    Returns persistent static WebP URLs for the main feed asset and thumbnail.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only valid image files (JPEG, PNG, WebP) are accepted.",
        )

    try:
        content = await file.read()
        urls = image_service.process_and_save(content, original_filename=file.filename)
        return urls
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image processing error: {e}",
        )

