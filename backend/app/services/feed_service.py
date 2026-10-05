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


class FeedService:
    def __init__(self, db: Session):
        self.db = db
        self.social_repo = SocialRepository(db)
        self.wardrobe_repo = WardrobeRepository(db)

    def _format_post(self, p: Post, current_user_id: Optional[UUID] = None) -> Dict[str, Any]:
        user = p.user
        is_liked = False
        is_saved = False
        is_following = False

        if current_user_id:
            is_liked = self.social_repo.is_liked_by_user(current_user_id, p.id)
            is_saved = self.social_repo.is_saved(current_user_id, p.id)
            if user and user.id != current_user_id:
                is_following = self.social_repo.is_following(current_user_id, user.id)

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

        likes_cnt = self.social_repo.count_likes(p.id)
        saves_cnt = self.social_repo.count_saves(p.id)

        return {
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
            "caption": p.caption,
            "location": None,
            "occasion": "Casual Daily",
            "tags": [],
            "tagged_items": [],
            "likes_count": likes_cnt,
            "comments_count": len(comments_data),
            "saves_count": saves_cnt,
            "is_liked": is_liked,
            "is_saved": is_saved,
            "comments": comments_data,
            "created_at": p.created_at,
        }

    def get_feed(self, current_user_id: Optional[UUID] = None, limit: int = 30, offset: int = 0) -> List[Dict[str, Any]]:
        posts = self.social_repo.list_feed(limit=limit, offset=offset)
        return [self._format_post(p, current_user_id) for p in posts]

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
        **extra,
    ) -> Dict[str, Any]:
        post = self.social_repo.create_post(
            user_id=user_id,
            caption=caption,
            image_url=image_url,
        )
        return self._format_post(post, user_id)

    def delete_post(self, post_id: UUID, user_id: UUID) -> None:
        post = self.social_repo.get_post_by_id(post_id)
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        if post.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        self.social_repo.delete_post(post)

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
