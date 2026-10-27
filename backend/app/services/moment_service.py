import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Set
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from fastapi import HTTPException, status
from app.models.post import Post
from app.models.like import Like
from app.models.follow import Follow
from app.models.user import User
from app.models.notification import Notification
from app.repositories.social_repository import SocialRepository
from app.services.image_service import image_service
from app.services.cache_service import cache_service
from app.core.redis import get_redis_client


class MomentService:
    """
    Service managing 24-Hour Ephemeral Outfit Moments for the For You Discovery Experience.
    Decoupled from permanent posts. All moments strictly expire after 24 hours.
    """

    MOMENT_PREFIX = "[MOMENT:24H:"

    def __init__(self, db: Session):
        self.db = db
        self.social_repo = SocialRepository(db)
        self.redis = get_redis_client()

    @classmethod
    def encode_moment_caption(cls, caption: Optional[str], occasion: Optional[str]) -> str:
        occ = (occasion or "Casual Daily").strip()
        body = (caption or "").strip()
        return f"{cls.MOMENT_PREFIX}{occ}]{body}"

    @classmethod
    def decode_moment_caption(cls, raw: str) -> tuple[str, str]:
        """Returns (clean_caption, occasion)."""
        if not raw or not raw.startswith(cls.MOMENT_PREFIX):
            return raw or "", "Casual Daily"
        match = re.match(r"^\[MOMENT:24H:(.*?)\](.*)$", raw)
        if match:
            return match.group(2), match.group(1)
        return raw, "Casual Daily"

    def _get_skipped_ids(self, user_id: Optional[UUID]) -> Set[UUID]:
        if not user_id or not self.redis:
            return set()
        try:
            raw = self.redis.smembers(f"user:{user_id}:skipped_moments")
            return {UUID(r.decode("utf-8") if isinstance(r, bytes) else str(r)) for r in raw}
        except Exception:
            return set()

    def _record_skipped(self, user_id: UUID, moment_id: UUID) -> None:
        if self.redis:
            try:
                key = f"user:{user_id}:skipped_moments"
                self.redis.sadd(key, str(moment_id))
                self.redis.expire(key, 86400)  # 24-hour retention
            except Exception:
                pass

    def _format_moment(self, post: Post, current_user_id: Optional[UUID] = None) -> Dict[str, Any]:
        clean_caption, occasion = self.decode_moment_caption(post.caption or "")
        created_at = post.created_at
        expires_at = created_at + timedelta(hours=24)
        now = datetime.now(timezone.utc)
        remaining = max(0, int((expires_at - now).total_seconds()))

        likes_count = len(post.likes) if post.likes else 0
        is_liked = False
        if current_user_id and post.likes:
            is_liked = any(l.user_id == current_user_id for l in post.likes)

        user = post.user
        return {
            "id": post.id,
            "user": {
                "id": user.id if user else UUID(int=0),
                "username": user.username if user else "unknown",
                "name": (user.display_name or user.username) if user else "Unknown",
                "avatar": user.profile_image_url if user else None,
                "is_verified": user.is_verified if user else False,
                "is_following": False,
            },
            "image_url": post.image_url,
            "caption": clean_caption,
            "occasion": occasion,
            "tags": [f"#{occasion.replace(' ', '')}"] if occasion else [],
            "created_at": created_at,
            "expires_at": expires_at,
            "time_remaining_seconds": remaining,
            "likes_count": likes_count,
            "is_liked": is_liked,
        }

    def create_moment(
        self,
        user_id: UUID,
        image_url: str,
        caption: Optional[str] = "",
        occasion: Optional[str] = "Casual Daily",
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        safe_image_url = image_service.save_from_base64_if_needed(image_url)
        encoded_caption = self.encode_moment_caption(caption, occasion)

        post = Post(
            user_id=user_id,
            image_url=safe_image_url,
            caption=encoded_caption,
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        cache_service.invalidate_moments()
        return self._format_moment(post, user_id)

    def is_viewer_eligible(self, creator_id: UUID, viewer_id: Optional[UUID]) -> bool:
        """
        Following-Only Audience Rule:
        A moment created by creator A is visible to viewer V if and only if:
        V follows A.
        The creator themselves is always eligible to view their own moment.
        Unauthenticated viewers (viewer_id is None) are not eligible.
        """
        if not viewer_id:
            return False
        if creator_id == viewer_id:
            return True
        is_following = (
            self.db.query(Follow.id)
            .filter(Follow.follower_id == viewer_id, Follow.following_id == creator_id)
            .first()
        )
        return is_following is not None

    def get_discovery_feed(
        self,
        current_user_id: Optional[UUID] = None,
        limit: int = 30,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Returns active unexpired 24-hour outfit moments for For You discovery.
        Following-Only Audience Rule:
        Only shows moments from creators where:
        current_user follows creator.
        Excludes current user's own moments, already liked moments, and skipped moments.
        Unauthenticated requests receive [].
        """
        if not current_user_id:
            return []

        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

        following_subq = (
            self.db.query(Follow.following_id)
            .filter(Follow.follower_id == current_user_id)
            .scalar_subquery()
        )

        q = (
            self.db.query(Post)
            .options(joinedload(Post.user), joinedload(Post.likes))
            .filter(
                Post.caption.like(f"{self.MOMENT_PREFIX}%"),
                Post.created_at >= cutoff,
                Post.user_id != current_user_id,
                Post.user_id.in_(following_subq),
            )
        )

        # Exclude already liked moments
        liked_subq = self.db.query(Like.post_id).filter(Like.user_id == current_user_id).scalar_subquery()
        q = q.filter(~Post.id.in_(liked_subq))

        # Exclude skipped moments
        skipped_ids = self._get_skipped_ids(current_user_id)
        if skipped_ids:
            q = q.filter(~Post.id.in_(skipped_ids))

        moments = (
            q.order_by(Post.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [self._format_moment(m, current_user_id) for m in moments]

    def get_moment_by_id(self, moment_id: UUID, viewer_id: Optional[UUID]) -> Dict[str, Any]:
        """
        Retrieves a single moment by ID.
        Strictly enforces:
        1. Moment exists and has not expired (within 24h).
        2. Viewer satisfies the mutual-union audience rule (or is creator).
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        post = (
            self.db.query(Post)
            .options(joinedload(Post.user), joinedload(Post.likes))
            .filter(
                Post.id == moment_id,
                Post.caption.like(f"{self.MOMENT_PREFIX}%"),
                Post.created_at >= cutoff,
            )
            .first()
        )
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outfit moment not found or expired",
            )

        if not self.is_viewer_eligible(post.user_id, viewer_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to view this outfit moment",
            )

        return self._format_moment(post, viewer_id)

    def get_user_moments(self, user_id: UUID) -> List[Dict[str, Any]]:
        """Returns the authenticated creator's active (unexpired) 24-hour moments."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        moments = (
            self.db.query(Post)
            .options(joinedload(Post.user), joinedload(Post.likes))
            .filter(
                Post.user_id == user_id,
                Post.caption.like(f"{self.MOMENT_PREFIX}%"),
                Post.created_at >= cutoff,
            )
            .order_by(Post.created_at.desc())
            .all()
        )
        return [self._format_moment(m, user_id) for m in moments]

    def like_moment(self, moment_id: UUID, user_id: UUID) -> Dict[str, Any]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        post = (
            self.db.query(Post)
            .filter(
                Post.id == moment_id,
                Post.caption.like(f"{self.MOMENT_PREFIX}%"),
                Post.created_at >= cutoff,
            )
            .first()
        )
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outfit moment not found or expired",
            )

        if not self.is_viewer_eligible(post.user_id, user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to interact with this outfit moment",
            )

        # Check existing like (concurrency safe)
        existing_like = self.db.query(Like).filter(Like.post_id == moment_id, Like.user_id == user_id).first()
        if not existing_like:
            like = Like(user_id=user_id, post_id=moment_id)
            self.db.add(like)

            # Notify creator once if not self
            if post.user_id != user_id:
                liker = self.db.query(User).filter(User.id == user_id).first()
                liker_name = liker.display_name if liker else "Someone"
                notif = (
                    self.db.query(Notification)
                    .filter(
                        Notification.user_id == post.user_id,
                        Notification.type == "moment_like",
                        Notification.message.like(f"{liker_name} liked your 24-hour outfit moment%"),
                    )
                    .first()
                )
                if not notif:
                    self.social_repo.create_notification(
                        user_id=post.user_id,
                        type="moment_like",
                        title="New Moment Like",
                        message=f"{liker_name} liked your 24-hour outfit moment in For You",
                    )
            self.db.commit()

        # Mark as seen/liked so it does not repeat
        self._record_skipped(user_id, moment_id)
        return {"moment_id": moment_id, "action": "liked", "success": True}

    def skip_moment(self, moment_id: UUID, user_id: UUID) -> Dict[str, Any]:
        """
        Skip a moment without liking or creating a notification.
        Persists skip to avoid showing the moment again in For You.
        Enforces existence, expiration, and audience eligibility.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        post = (
            self.db.query(Post)
            .filter(
                Post.id == moment_id,
                Post.caption.like(f"{self.MOMENT_PREFIX}%"),
                Post.created_at >= cutoff,
            )
            .first()
        )
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outfit moment not found or expired",
            )

        if not self.is_viewer_eligible(post.user_id, user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to interact with this outfit moment",
            )

        self._record_skipped(user_id, moment_id)
        return {"moment_id": moment_id, "action": "skipped", "success": True}

    def delete_moment(self, moment_id: UUID, user_id: UUID) -> None:
        post = self.db.query(Post).filter(Post.id == moment_id).first()
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit moment not found")
        if post.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this moment",
            )
        self.social_repo.delete_post(post)
        cache_service.invalidate_moments()
