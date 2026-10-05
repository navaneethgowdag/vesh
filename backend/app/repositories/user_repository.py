from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.learned_preference import LearnedPreference
from app.core.security import get_password_hash


def _split_display_name(display_name: Optional[str], username: str) -> tuple[str, str]:
    raw = (display_name or "").strip()
    if not raw:
        return username, ""
    parts = raw.split(maxsplit=1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: UUID) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username.ilike(username.strip())).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email.ilike(email.strip())).first()

    def create(
        self,
        username: str,
        email: str,
        password: str,
        display_name: Optional[str] = None,
        bio: Optional[str] = None,
        profile_image_url: Optional[str] = None,
        avatar_url: Optional[str] = None,
        **extra_fields,
    ) -> User:
        first_name, last_name = _split_display_name(display_name, username.strip())
        final_avatar = avatar_url or profile_image_url

        try:
            user = User(
                username=username.strip(),
                email=email.strip().lower(),
                password_hash=get_password_hash(password),
                first_name=first_name,
                last_name=last_name,
                bio=bio,
                avatar_url=final_avatar,
                is_active=True,
                is_verified=False,
            )
            self.db.add(user)
            self.db.flush()

            # Initialize explicit preferences with defaults using actual Neon column names
            pref = UserPreference(
                user_id=user.id,
                preferred_styles=["Minimal", "Casual"],
                preferred_colors=["Black", "White", "Beige"],
                preferred_categories=["Tops", "Bottoms", "Outerwear", "Shoes"],
                preferred_fits=["Relaxed / Oversized"],
                preferred_patterns=["Solid"],
                preferred_materials=["Cotton"],
                preferred_occasions=["Casual Daily"],
                preferred_seasons=["All-Season"],
            )
            self.db.add(pref)

            # Initialize learned preferences with neutral baseline using actual Neon column names
            learned = LearnedPreference(
                user_id=user.id,
                style_scores={"Minimal": 0.5, "Casual": 0.5},
                color_scores={"Black": 0.5, "White": 0.5, "Beige": 0.5},
                category_scores={"Tops": 0.5, "Bottoms": 0.5, "Outerwear": 0.5, "Shoes": 0.5},
                fit_scores={"Relaxed / Oversized": 0.5},
                pattern_scores={"Solid": 0.5},
                material_scores={"Cotton": 0.5},
                occasion_scores={"Casual Daily": 0.5},
                season_scores={"All-Season": 0.5},
                weather_scores={},
                confidence_score=0.1,
                interaction_count=0,
            )
            self.db.add(learned)
            self.db.commit()
            self.db.refresh(user)
            return user
        except Exception:
            self.db.rollback()
            raise

    def update(self, user: User, **kwargs) -> User:
        if "display_name" in kwargs and kwargs["display_name"] is not None:
            f_name, l_name = _split_display_name(kwargs.pop("display_name"), user.username)
            user.first_name = f_name
            user.last_name = l_name
        if "profile_image_url" in kwargs and kwargs["profile_image_url"] is not None:
            user.avatar_url = kwargs.pop("profile_image_url")

        ALLOWED_FIELDS = {"first_name", "last_name", "bio", "avatar_url", "is_active", "is_verified"}
        for key, value in kwargs.items():
            if value is not None and key in ALLOWED_FIELDS:
                setattr(user, key, value)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_preferences(self, user_id: UUID) -> Optional[UserPreference]:
        return self.db.query(UserPreference).filter(UserPreference.user_id == user_id).first()

    def update_preferences(self, user_id: UUID, **kwargs) -> UserPreference:
        pref = self.get_preferences(user_id)
        if not pref:
            pref = UserPreference(user_id=user_id)
            self.db.add(pref)

        # Mapping dictionary from API names to actual database columns
        field_mapping = {
            "styles": "preferred_styles",
            "preferred_styles": "preferred_styles",
            "favorite_colors": "preferred_colors",
            "preferred_colors": "preferred_colors",
            "preferred_categories": "preferred_categories",
            "preferred_fits": "preferred_fits",
            "preferred_patterns": "preferred_patterns",
            "preferred_materials": "preferred_materials",
            "favorite_occasions": "preferred_occasions",
            "preferred_occasions": "preferred_occasions",
            "preferred_seasons": "preferred_seasons",
        }

        for key, value in kwargs.items():
            db_col = field_mapping.get(key)
            if db_col and value is not None and hasattr(pref, db_col):
                setattr(pref, db_col, value)

        self.db.commit()
        self.db.refresh(pref)
        return pref

    def get_or_create_learned_preferences(self, user_id: UUID) -> LearnedPreference:
        learned = self.db.query(LearnedPreference).filter(LearnedPreference.user_id == user_id).first()
        if not learned:
            learned = LearnedPreference(
                user_id=user_id,
                style_scores={},
                color_scores={},
                category_scores={},
                fit_scores={},
                pattern_scores={},
                material_scores={},
                occasion_scores={},
                season_scores={},
                weather_scores={},
                confidence_score=0.1,
                interaction_count=0,
            )
            self.db.add(learned)
            self.db.commit()
            self.db.refresh(learned)
        return learned

    def update_learned_preferences(self, learned: LearnedPreference) -> LearnedPreference:
        self.db.commit()
        self.db.refresh(learned)
        return learned

    def search_users(self, query: str, limit: int = 20) -> List[User]:
        search_pattern = f"%{query.strip()}%"
        return (
            self.db.query(User)
            .filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern),
                )
            )
            .limit(limit)
            .all()
        )
