from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.schemas.user import (
    UserResponse,
    UserUpdate,
    UserPreferenceBase,
    UserPreferenceResponse,
    LearnedPreferenceResponse,
    PersonalizationResetResponse,
    UserSearchResponse,
    OnboardingRequest,
)
from app.services.user_service import UserService
from app.services.profile_image_service import ProfileImageService
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=List[UserSearchResponse])
def search_users(
    q: str = Query("", description="Search query for username or display name"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Search users by username or display name."""
    service = UserService(db)
    viewer_id = current_user.id if current_user else None
    return service.search_users(query=q, viewer_id=viewer_id, limit=limit)


@router.patch("/me", response_model=UserResponse)
def update_profile(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserService(db)
    data = update_data.model_dump(exclude_unset=True)
    # If avatar_url was passed as a URL string or None, ignore external URLs
    # Profile photos must be uploaded directly via /me/avatar
    if "avatar_url" in data and data["avatar_url"] and data["avatar_url"].startswith("http"):
        data.pop("avatar_url")
    if "profile_image_url" in data and data["profile_image_url"] and data["profile_image_url"].startswith("http"):
        data.pop("profile_image_url")
    service.update_profile(current_user, **data)
    return service.get_by_username(current_user.username, viewer_id=current_user.id)


@router.post("/me/avatar")
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Direct profile photo upload from user's device.
    Validates content, normalizes dimensions to 512x512, and stores in PostgreSQL BYTEA.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload a valid image file (JPG, PNG, or WebP).",
        )

    file_bytes = await file.read()
    image_service = ProfileImageService(db)
    avatar_url = image_service.store_avatar(current_user.id, file_bytes, file.content_type)

    return {
        "success": True,
        "avatar_url": avatar_url,
        "message": "Profile photo updated successfully.",
    }


@router.delete("/me/avatar")
def remove_profile_photo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove user's uploaded profile photo and revert to faceless illustrated avatar.
    """
    image_service = ProfileImageService(db)
    image_service.delete_avatar(current_user.id)
    return {
        "success": True,
        "avatar_url": None,
        "message": "Profile photo removed successfully.",
    }


@router.get("/me/avatar")
def get_my_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve current authenticated user's profile image binary stream.
    """
    image_service = ProfileImageService(db)
    res = image_service.get_avatar(current_user.id)
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No uploaded profile image found.")
    image_bytes, mime_type = res
    return Response(
        content=image_bytes,
        media_type=mime_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/{user_id}/avatar")
def get_user_avatar(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Public profile photo retrieval endpoint for avatars across feed, explore, and comments.
    """
    image_service = ProfileImageService(db)
    res = image_service.get_avatar(user_id)
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile image not found.")
    image_bytes, mime_type = res
    return Response(
        content=image_bytes,
        media_type=mime_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/me/onboarding", response_model=UserResponse)
def complete_onboarding(
    data: OnboardingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Persist first-time user onboarding answers and activate personalized recommendations.
    """
    service = UserService(db)

    # 1. Update display name if provided
    if data.display_name and data.display_name.strip():
        service.update_profile(current_user, display_name=data.display_name.strip())

    # 2. Update preferences
    gender_input = data.gender_preference or data.gender or "prefer-not-to-say"
    gender_clean = gender_input.strip() if isinstance(gender_input, str) else "prefer-not-to-say"
    
    # Map avatar_style based on gender if avatar_style not explicitly provided
    resolved_avatar = data.avatar_style
    if not resolved_avatar:
        g_low = gender_clean.lower()
        if "male" in g_low and "female" not in g_low:
            resolved_avatar = "masculine"
        elif "female" in g_low:
            resolved_avatar = "feminine"
        elif "non-binary" in g_low or "androgynous" in g_low:
            resolved_avatar = "androgynous"
        else:
            resolved_avatar = "neutral"

    colors = data.preferred_colors or data.favorite_colors or []
    occasions = data.preferred_occasions or data.lifestyle_occasions or []
    categories = data.preferred_categories or data.wardrobe_staples or []
    fits = data.preferred_fits if data.preferred_fits else ([data.preferred_fit] if data.preferred_fit else [])

    pref_kwargs = {
        "preferred_styles": data.preferred_styles or [],
        "styles": data.preferred_styles or [],
        "preferred_categories": categories,
        "preferred_colors": colors,
        "favorite_colors": colors,
        "preferred_occasions": occasions,
        "favorite_occasions": occasions,
        "preferred_fits": fits,
        "gender": gender_clean,
        "avatar_style": resolved_avatar,
        "styling_preference": data.styling_preference,
        "budget_preference": data.budget_preference,
        "country": data.country,
        "preferred_language": data.preferred_language or "English",
        "date_of_birth": data.date_of_birth,
        "onboarding_completed": True,
    }

    service.update_preferences(current_user.id, **pref_kwargs)
    return service.get_by_username(current_user.username, viewer_id=current_user.id)


@router.get("/me/preferences", response_model=UserPreferenceResponse)
def get_user_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserService(db)
    return service.get_preferences(current_user.id)


@router.put("/me/preferences", response_model=UserPreferenceResponse)
def update_user_preferences(
    pref_data: UserPreferenceBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserService(db)
    data = pref_data.model_dump()
    return service.update_preferences(current_user.id, **data)


@router.get("/me/learned-preferences", response_model=LearnedPreferenceResponse)
def get_learned_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the derived learned-preference profile for the current user."""
    service = UserService(db)
    lp = service.get_learned_preferences(current_user.id)
    
    top_styles = [
        {"name": k, "style": k, "score": round(v, 2)}
        for k, v in sorted((lp.style_scores or {}).items(), key=lambda x: x[1], reverse=True)
        if v > 0.1
    ][:5]
    top_colors = [
        {"name": k, "color": k, "score": round(v, 2)}
        for k, v in sorted((lp.color_scores or {}).items(), key=lambda x: x[1], reverse=True)
        if v > 0.1
    ][:6]

    return {
        "id": lp.id,
        "user_id": lp.user_id,
        "style_scores": lp.style_scores or {},
        "color_scores": lp.color_scores or {},
        "category_scores": lp.category_scores or {},
        "fit_scores": lp.fit_scores or {},
        "pattern_scores": lp.pattern_scores or {},
        "material_scores": lp.material_scores or {},
        "occasion_scores": lp.occasion_scores or {},
        "season_scores": lp.season_scores or {},
        "weather_scores": lp.weather_scores or {},
        "confidence_score": lp.confidence_score,
        "confidence": lp.confidence_score,
        "interaction_count": lp.interaction_count,
        "total_interactions": lp.interaction_count,
        "top_styles": top_styles,
        "top_colors": top_colors,
        "created_at": lp.created_at,
        "updated_at": lp.updated_at,
    }


@router.post("/me/personalization/reset", response_model=PersonalizationResetResponse)
def reset_personalization_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resets all learned preference scores back to initial cold-start baseline."""
    service = UserService(db)
    lp = service.reset_learned_preferences(current_user.id)
    return {
        "user_id": current_user.id,
        "success": True,
        "message": "Learned personalization preferences have been reset to baseline.",
        "confidence_score": lp.confidence_score,
        "interaction_count": lp.interaction_count,
    }


@router.get("/{username}", response_model=UserResponse)
def get_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = UserService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_by_username(username, viewer_id=viewer_id)
