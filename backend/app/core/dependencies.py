import uuid
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import AUTH_COOKIE_NAME, decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False
)


def _extract_token(request: Optional[Request], bearer_token: Optional[str]) -> Optional[str]:
    """Token extraction prioritizing explicit Bearer token header, then cookie.

    If an explicit Authorization: Bearer header is provided (e.g. by API clients,
    pytest, mobile apps), use it. Otherwise, fall back to HttpOnly session cookie.
    """
    if bearer_token:
        return bearer_token
    if request is not None:
        cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
        if cookie_token:
            return cookie_token
    return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    bearer_token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = _extract_token(request, bearer_token)
    if not token:
        raise credentials_exception
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
    
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return user


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
    bearer_token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[User]:
    token = _extract_token(request, bearer_token)
    if not token:
        return None
    try:
        return get_current_user(request=request, db=db, bearer_token=token)
    except HTTPException:
        return None

