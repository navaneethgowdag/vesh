from typing import Optional, List, Dict, Any
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
    StylingProfileResponse,
    StylingProfileUpdate,
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
    disliked_colors = data.disliked_colors or data.avoided_colors or []
    occasions = data.preferred_occasions or data.lifestyle_occasions or []
    categories = data.preferred_categories or data.wardrobe_staples or []
    fits = data.preferred_fits if data.preferred_fits else ([data.preferred_fit] if data.preferred_fit else [])

    # Extract lifestyle occupation
    lifestyle_data = data.lifestyle_occupation
    if not lifestyle_data and data.occupation_details:
        lifestyle_data = {"occupation": "prefer_not_to_say", "details": data.occupation_details}

    pref_kwargs = {
        "preferred_styles": data.preferred_styles or [],
        "styles": data.preferred_styles or [],
        "disliked_styles": data.disliked_styles or [],
        "preferred_categories": categories,
        "preferred_colors": colors,
        "favorite_colors": colors,
        "avoided_colors": disliked_colors,
        "disliked_colors": disliked_colors,
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
        "lifestyle_occupation": lifestyle_data,
        "weekly_routine": data.weekly_routine,
        "shopping_preferences": data.shopping_preferences,
        "recommendation_settings": data.recommendation_settings,
    }

    service.update_preferences(current_user.id, **pref_kwargs)
    return service.get_by_username(current_user.username, viewer_id=current_user.id)


def _build_styling_profile_response(user: User, pref: Optional[Any]) -> dict:
    fits_dict = pref.preferred_fits if (pref and isinstance(pref.preferred_fits, dict)) else {}
    lifestyle = pref.lifestyle_occupation if pref else {"occupation": "prefer_not_to_say", "details": {}}
    routine = pref.weekly_routine if pref else []
    shopping = pref.shopping_preferences if pref else {
        "budget_tier": "mid_range",
        "budget_per_item": None,
        "shopping_philosophy": "balanced",
        "preferred_categories": [],
        "preferred_platforms": []
    }
    rec_settings = pref.recommendation_settings if pref else {
        "comfort_priority": 0.5,
        "familiar_vs_new": "balanced",
        "repeat_frequency": "moderate",
        "variety_preference": "balanced"
    }

    raw_fits = fits_dict.get("fits", []) if isinstance(fits_dict.get("fits"), list) else (
        pref.preferred_fits if (pref and isinstance(pref.preferred_fits, list)) else []
    )

    return {
        "user_id": user.id,
        "display_name": user.display_name or f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
        "lifestyle_occupation": lifestyle,
        "weekly_routine": routine,
        "fashion_preferences": {
            "styles": pref.preferred_styles if pref else [],
            "disliked_styles": fits_dict.get("disliked_styles", []),
            "preferred_colors": pref.preferred_colors if pref else [],
            "disliked_colors": fits_dict.get("avoided_colors", []),
            "fits": raw_fits,
            "comfort_vs_appearance": fits_dict.get("comfort_vs_appearance", "balanced"),
            "simple_vs_experimental": fits_dict.get("simple_vs_experimental", "balanced"),
        },
        "occasion_preferences": {
            "regular_occasions": pref.preferred_occasions if pref else [],
            "occasion_notes": fits_dict.get("occasion_notes", {}),
        },
        "shopping_preferences": shopping,
        "recommendation_settings": rec_settings,
        "onboarding_completed": pref.onboarding_completed if pref else False,
    }


@router.get("/me/styling-profile", response_model=StylingProfileResponse)
def get_user_styling_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns authenticated user's complete styling profile including lifestyle/occupation,
    7-day weekly routine, fashion aesthetics, regular occasions, shopping habits, and tuning.
    """
    service = UserService(db)
    pref = service.get_preferences(current_user.id)
    return _build_styling_profile_response(current_user, pref)


@router.patch("/me/styling-profile", response_model=StylingProfileResponse)
def update_user_styling_profile(
    profile_data: StylingProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates sections of user's styling profile independently and immediately
    syncs with recommendation generation and wardrobe gap analysis.
    """
    service = UserService(db)
    pref = service.get_preferences(current_user.id)

    if profile_data.display_name and profile_data.display_name.strip():
        service.update_profile(current_user, display_name=profile_data.display_name.strip())

    pref_updates: Dict[str, Any] = {}

    if profile_data.lifestyle_occupation is not None:
        pref_updates["lifestyle_occupation"] = profile_data.lifestyle_occupation.model_dump()

    if profile_data.weekly_routine is not None:
        pref_updates["weekly_routine"] = [
            item.model_dump() for item in profile_data.weekly_routine
        ]

    if profile_data.fashion_preferences is not None:
        f_data = profile_data.fashion_preferences
        if f_data.styles is not None:
            pref_updates["preferred_styles"] = f_data.styles
            pref_updates["styles"] = f_data.styles
        if f_data.disliked_styles is not None:
            pref_updates["disliked_styles"] = f_data.disliked_styles
        if f_data.preferred_colors is not None:
            pref_updates["preferred_colors"] = f_data.preferred_colors
            pref_updates["favorite_colors"] = f_data.preferred_colors
        if f_data.disliked_colors is not None:
            pref_updates["avoided_colors"] = f_data.disliked_colors
            pref_updates["disliked_colors"] = f_data.disliked_colors
        if f_data.fits is not None:
            pref_updates["preferred_fits"] = f_data.fits
        if f_data.comfort_vs_appearance is not None:
            pref_updates["comfort_vs_appearance"] = f_data.comfort_vs_appearance
        if f_data.simple_vs_experimental is not None:
            pref_updates["simple_vs_experimental"] = f_data.simple_vs_experimental

    if profile_data.occasion_preferences is not None:
        o_data = profile_data.occasion_preferences
        if o_data.regular_occasions is not None:
            pref_updates["preferred_occasions"] = o_data.regular_occasions
            pref_updates["favorite_occasions"] = o_data.regular_occasions
        if o_data.occasion_notes is not None:
            pref_updates["occasion_notes"] = o_data.occasion_notes

    if profile_data.shopping_preferences is not None:
        pref_updates["shopping_preferences"] = profile_data.shopping_preferences.model_dump()

    if profile_data.recommendation_settings is not None:
        r_data = profile_data.recommendation_settings
        pref_updates["recommendation_settings"] = r_data.model_dump()
        if r_data.comfort_priority is not None:
            pref_updates["comfort_priority"] = r_data.comfort_priority

    if profile_data.onboarding_completed is not None:
        pref_updates["onboarding_completed"] = profile_data.onboarding_completed

    if pref_updates:
        pref = service.update_preferences(current_user.id, **pref_updates)

    return _build_styling_profile_response(current_user, pref)


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
