import os
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.security import AUTH_COOKIE_NAME
from app.core.rate_limiter import RateLimit
from app.schemas.auth import LoginRequest, RegisterRequest, Token
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_MAX_AGE = 60 * 60 * 24  # 1 day; JWT expiry still governs real validity


def _is_production() -> bool:
    return settings.APP_ENV.lower() in ("production", "prod") or bool(os.getenv("RENDER"))


def _set_session_cookie(response: Response, token: str) -> None:
    """Set the HttpOnly session cookie (browser transport for the JWT)."""
    is_prod = _is_production()
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    is_prod = _is_production()
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
    )


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimit(requests=10, window=3600, scope="register"))])
def register(request: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    service = AuthService(db)
    user, token = service.register(
        username=request.username,
        email=request.email,
        password=request.password,
        display_name=request.display_name,
        bio=request.bio,
        profile_image_url=request.profile_image_url,
        location=request.location,
    )
    _set_session_cookie(response, token)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
    }


@router.post("/login", response_model=Token, dependencies=[Depends(RateLimit(requests=10, window=60, scope="login"))])
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    service = AuthService(db)
    user, token = service.authenticate_user(
        username_or_email=request.username_or_email,
        password=request.password,
    )
    _set_session_cookie(response, token)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = UserService(db)
    return service.get_by_username(current_user.username, viewer_id=current_user.id)


@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user)):
    _clear_session_cookie(response)
    return {"message": "Successfully logged out"}

