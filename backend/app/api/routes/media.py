import os
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from fastapi.responses import FileResponse
from app.api.deps import get_current_user
from app.models.user import User
from app.services.image_service import image_service, UPLOAD_DIR

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


@router.get("/uploads/{filename}")
@router.get("/{filename}")
async def get_media_file(filename: str):
    """
    Retrieve an uploaded media file with explicit WebP/image headers and CORS support.
    """
    # Sanitize filename to prevent directory traversal
    clean_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, clean_filename)

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")

    content_type = "image/webp"
    if clean_filename.endswith(".png"):
        content_type = "image/png"
    elif clean_filename.endswith((".jpg", ".jpeg")):
        content_type = "image/jpeg"

    return FileResponse(
        file_path,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        },
    )


