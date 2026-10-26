import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.post import Post
from app.models.comment import Comment
from app.models.user import User
from app.models.clothing import Clothing
from app.repositories.social_repository import SocialRepository
from app.repositories.wardrobe_repository import WardrobeRepository
from app.services.cache_service import cache_service, TTL_STORIES
from app.services.image_service import image_service


class FeedService:
    STORY_PREFIX = "[STORY:24H:]"
    def __init__(self, db: Session):
        self.db = db
        self.social_repo = SocialRepository(db)
        self.wardrobe_repo = WardrobeRepository(db)

    def _format_posts_batch(
        self,
        posts: List[Post],
        current_user_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        """
        Format a list of posts in a single pass with batch lookups to avoid N+1 queries.
        """
        if not posts:
            return []

        post_ids = [p.id for p in posts]
        author_ids = [p.user_id for p in posts if p.user_id]
        batch = self.social_repo.get_feed_interactions_batch(current_user_id, post_ids, author_ids)

        likes_count_map = batch["likes_count"]
        saves_count_map = batch["saves_count"]
        liked_post_ids = batch["liked_post_ids"]
        saved_post_ids = batch["saved_post_ids"]
        following_author_ids = batch["following_author_ids"]

        formatted = []
        for p in posts:
            user = p.user
            is_liked = p.id in liked_post_ids
            is_saved = p.id in saved_post_ids
            is_following = user.id in following_author_ids if (user and current_user_id and user.id != current_user_id) else False

            raw_caption = p.caption or ""
            clean_caption = raw_caption
            if raw_caption.startswith(self.STORY_PREFIX):
                clean_caption = raw_caption[len(self.STORY_PREFIX):]
            elif raw_caption.startswith("[STORY:24H:"):
                clean_caption = raw_caption.split("]", 1)[1] if "]" in raw_caption else raw_caption
            elif raw_caption.startswith("[MOMENT:24H:"):
                clean_caption = raw_caption.split("]", 1)[1] if "]" in raw_caption else raw_caption

            comments_data = []
            for c in (p.comments or []):
                c_user = c.user
                comments_data.append({
                    "id": c.id,
                    "post_id": c.post_id,
                    "user": {
                        "id": c_user.id if c_user else UUID(int=0),
                        "username": c_user.username if c_user else "unknown",
                        "name": c_user.display_name if c_user else "Unknown",
                        "avatar": c_user.profile_image_url if c_user else "",
                        "is_verified": c_user.is_verified if c_user else False,
                        "is_following": False,
                    },
                    "text": c.content,
                    "likes_count": 0,
                    "created_at": c.created_at,
                })

            formatted.append({
                "id": p.id,
                "user": {
                    "id": user.id if user else UUID(int=0),
                    "username": user.username if user else "unknown",
                    "name": (user.display_name or user.username) if user else "Unknown",
                    "avatar": user.profile_image_url if user else None,
                    "is_verified": user.is_verified if user else False,
                    "is_following": is_following,
                },
                "image_url": p.image_url,
                "caption": clean_caption,
                "location": None,
                "occasion": "Casual Daily",
                "tags": [],
                "tagged_items": [],
                "likes_count": likes_count_map.get(p.id, 0),
                "comments_count": len(comments_data),
                "saves_count": saves_count_map.get(p.id, 0),
                "is_liked": is_liked,
                "is_saved": is_saved,
                "comments": comments_data,
                "created_at": p.created_at,
            })
        return formatted

    def _format_post(self, p: Post, current_user_id: Optional[UUID] = None) -> Dict[str, Any]:
        return self._format_posts_batch([p], current_user_id)[0]

    def get_feed(
        self,
        current_user_id: Optional[UUID] = None,
        limit: int = 30,
        offset: int = 0,
        feed_type: str = "for_you",
    ) -> List[Dict[str, Any]]:
        if feed_type == "following":
            if not current_user_id:
                return []
            posts = self.social_repo.list_following_feed(user_id=current_user_id, limit=limit, offset=offset)
        else:
            posts = self.social_repo.list_feed(limit=limit, offset=offset, exclude_user_id=current_user_id)
        return self._format_posts_batch(posts, current_user_id)

    def get_stories(self, current_user_id: Optional[UUID] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Instant Stories must display active 24-hour content exclusively from
        accounts the authenticated user currently follows.
        """
        if not current_user_id:
            return []

        cache_key = cache_service.build_key("stories", f"user_{current_user_id}")
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        following_ids = self.social_repo.get_following_user_ids(current_user_id)
        if not following_ids:
            return []

        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        stories = self.social_repo.list_stories(
            user_ids=following_ids,
            cutoff=cutoff,
            limit=limit,
        )
        stories = [s for s in stories if s.user_id != current_user_id]
        formatted = self._format_posts_batch(stories, current_user_id)
        cache_service.set(cache_key, formatted, ttl_seconds=TTL_STORIES)
        return formatted

    def get_my_stories(self, current_user_id: UUID) -> List[Dict[str, Any]]:
        """
        Returns active 24-hour stories published by the current user.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        stories = self.social_repo.list_user_stories(user_id=current_user_id, cutoff=cutoff)
        return self._format_posts_batch(stories, current_user_id)

    def create_story(
        self,
        user_id: UUID,
        image_url: str,
        caption: Optional[str] = "",
    ) -> Dict[str, Any]:
        safe_image_url = image_service.save_from_base64_if_needed(image_url)
        clean_text = (caption or "").strip()
        encoded_caption = f"{self.STORY_PREFIX}{clean_text}"
        post = Post(
            user_id=user_id,
            caption=encoded_caption,
            image_url=safe_image_url,
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        cache_service.invalidate_stories()
        return self._format_post(post, user_id)

    def get_posts_by_user(
        self,
        user_id: UUID,
        current_user_id: Optional[UUID] = None,
        limit: int = 30,
    ) -> List[Dict[str, Any]]:
        posts = self.social_repo.list_posts_by_user(user_id=user_id, limit=limit)
        return self._format_posts_batch(posts, current_user_id)

    def get_post_by_id(self, post_id: UUID, current_user_id: Optional[UUID] = None) -> Dict[str, Any]:
        p = self.social_repo.get_post_by_id(post_id)
        if not p:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        return self._format_post(p, current_user_id)

    def create_post(
        self,
        user_id: UUID,
        caption: str,
        image_url: str,
        is_story: bool = False,
        **extra,
    ) -> Dict[str, Any]:
        if is_story:
            return self.create_story(user_id=user_id, image_url=image_url, caption=caption)
        safe_image_url = image_service.save_from_base64_if_needed(image_url)
        post = self.social_repo.create_post(
            user_id=user_id,
            caption=caption,
            image_url=safe_image_url,
        )
        cache_service.invalidate_stories()
        cache_service.invalidate_feed()
        return self._format_post(post, user_id)

    def delete_post(self, post_id: UUID, user_id: UUID) -> None:
        post = self.social_repo.get_post_by_id(post_id)
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        if post.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        self.social_repo.delete_post(post)
        cache_service.invalidate_stories()
        cache_service.invalidate_feed()

    def toggle_like(self, user_id: UUID, post_id: UUID) -> bool:
        if self.social_repo.is_liked_by_user(user_id, post_id):
            self.social_repo.unlike_post(user_id, post_id)
            return False
        else:
            self.social_repo.like_post(user_id, post_id)
            return True

    def like_post(self, user_id: UUID, post_id: UUID) -> Dict[str, Any]:
        liked = self.toggle_like(user_id, post_id)
        return {"liked": liked}

    def unlike_post(self, user_id: UUID, post_id: UUID) -> Dict[str, Any]:
        if self.social_repo.is_liked_by_user(user_id, post_id):
            self.social_repo.unlike_post(user_id, post_id)
        return {"liked": False}

    def toggle_save(self, user_id: UUID, post_id: UUID) -> bool:
        if self.social_repo.is_saved(user_id, post_id):
            self.social_repo.unsave_item(user_id, post_id)
            return False
        else:
            self.social_repo.save_item(user_id, post_id)
            return True

    def add_comment(self, user_id: UUID, post_id: UUID, text: str) -> Comment:
        return self.social_repo.add_comment(user_id, post_id, text)

    def delete_comment(self, comment_id: UUID, user_id: UUID) -> None:
        comment = self.social_repo.get_comment_by_id(comment_id)
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if comment.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        self.social_repo.delete_comment(comment)

    def toggle_follow(self, follower_id: UUID, target_user_id: UUID) -> bool:
        if self.social_repo.is_following(follower_id, target_user_id):
            self.social_repo.unfollow_user(follower_id, target_user_id)
            return False
        else:
            self.social_repo.follow_user(follower_id, target_user_id)
            return True

