from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, create_access_token


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def register(
        self,
        username: str,
        email: str,
        password: str,
        display_name: Optional[str] = None,
        bio: Optional[str] = None,
        profile_image_url: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Tuple[User, str]:
        if self.user_repo.get_by_username(username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{username}' is already taken",
            )
        if self.user_repo.get_by_email(email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{email}' is already registered",
            )

        user = self.user_repo.create(
            username=username,
            email=email,
            password=password,
            display_name=display_name,
            bio=bio,
            profile_image_url=profile_image_url,
            location=location,
        )

        token = create_access_token(subject=str(user.id))
        return user, token

    def authenticate_user(self, username_or_email: str, password: str) -> Tuple[User, str]:
        user = self.user_repo.get_by_username(username_or_email)
        if not user:
            user = self.user_repo.get_by_email(username_or_email)

        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username/email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated",
            )

        token = create_access_token(subject=str(user.id))
        return user, token

