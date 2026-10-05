from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.schemas.user import UserResponse, UserUpdate, UserPreferenceBase, UserPreferenceResponse, LearnedPreferenceResponse
from app.services.user_service import UserService
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{username}", response_model=UserResponse)
def get_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = UserService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_by_username(username, viewer_id=viewer_id)


@router.patch("/me", response_model=UserResponse)
def update_profile(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = UserService(db)
    data = update_data.model_dump(exclude_unset=True)
    service.update_profile(current_user, **data)
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
        "interaction_count": lp.interaction_count,
        "created_at": lp.created_at,
        "updated_at": lp.updated_at,
    }
