from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.learned_preference import LearnedPreference
from app.repositories.user_repository import UserRepository
from app.repositories.social_repository import SocialRepository


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.social_repo = SocialRepository(db)

    def get_by_id(self, user_id: UUID) -> User:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    def get_by_username(self, username: str, viewer_id: Optional[UUID] = None) -> dict:
        user = self.user_repo.get_by_username(username)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        is_following = False
        if viewer_id and viewer_id != user.id:
            is_following = self.social_repo.is_following(viewer_id, user.id)

        followers_count = self.social_repo.count_followers(user.id)
        following_count = self.social_repo.count_following(user.id)
        posts_count = len(user.posts)
        wardrobe_count = len(user.clothing_items)

        pref = user.preference
        pref_data = None
        if pref:
            pref_data = {
                "styles": pref.preferred_styles or [],
                "favorite_colors": pref.preferred_colors or [],
                "disliked_colors": [],
                "preferred_categories": pref.preferred_categories or [],
                "preferred_fits": pref.preferred_fits or [],
                "preferred_brands": [],
                "favorite_occasions": pref.preferred_occasions or [],
                "preferred_seasons": pref.preferred_seasons or [],
                "fashion_goals": [],
                "climate_preference": "Moderate",
            }

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "display_name": user.display_name,
            "bio": user.bio or "",
            "avatar_url": user.avatar_url,
            "profile_image_url": user.profile_image_url,
            "location": "",
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "followers_count": followers_count,
            "following_count": following_count,
            "posts_count": posts_count,
            "wardrobe_count": wardrobe_count,
            "is_following": is_following,
            "preferences": pref_data,
            "created_at": user.created_at,
        }

    def update_profile(self, user: User, **kwargs) -> User:
        return self.user_repo.update(user, **kwargs)

    def get_preferences(self, user_id: UUID) -> UserPreference:
        pref = self.user_repo.get_preferences(user_id)
        if not pref:
            pref = self.user_repo.update_preferences(user_id)
        return pref

    def update_preferences(self, user_id: UUID, **kwargs) -> UserPreference:
        return self.user_repo.update_preferences(user_id, **kwargs)

    def get_learned_preferences(self, user_id: UUID) -> LearnedPreference:
        return self.user_repo.get_or_create_learned_preferences(user_id)
