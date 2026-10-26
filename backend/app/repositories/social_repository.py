from typing import Optional, List, Dict, Set, Any
from uuid import UUID
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc, func
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.follow import Follow
from app.models.saved import SavedItem
from app.models.collection import Collection
from app.models.notification import Notification
from app.models.user import User


class SocialRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- Posts ---
    def create_post(
        self,
        user_id: UUID,
        caption: str,
        image_url: str,
        **extra,
    ) -> Post:
        post = Post(
            user_id=user_id,
            caption=caption,
            image_url=image_url,
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        return post

    def get_post_by_id(self, post_id: UUID) -> Optional[Post]:
        return self.db.query(Post).filter(Post.id == post_id).first()

    def list_feed(self, limit: int = 30, offset: int = 0, exclude_user_id: Optional[UUID] = None) -> List[Post]:
        q = (
            self.db.query(Post)
            .options(
                joinedload(Post.user),
                selectinload(Post.comments).joinedload(Comment.user),
            )
        )
        if exclude_user_id is not None:
            q = q.filter(Post.user_id != exclude_user_id)
        return (
            q.order_by(Post.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def list_following_feed(self, user_id: UUID, limit: int = 30, offset: int = 0) -> List[Post]:
        following_subq = self.db.query(Follow.following_id).filter(Follow.follower_id == user_id).scalar_subquery()
        return (
            self.db.query(Post)
            .options(
                joinedload(Post.user),
                selectinload(Post.comments).joinedload(Comment.user),
            )
            .filter(Post.user_id.in_(following_subq))
            .order_by(Post.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get_feed_interactions_batch(
        self,
        current_user_id: Optional[UUID],
        post_ids: List[UUID],
        author_ids: List[UUID],
    ) -> Dict[str, Any]:
        if not post_ids:
            return {
                'likes_count': {},
                'saves_count': {},
                'liked_post_ids': set(),
                'saved_post_ids': set(),
                'following_author_ids': set(),
            }

        likes_counts_raw = (
            self.db.query(Like.post_id, func.count(Like.id))
            .filter(Like.post_id.in_(post_ids))
            .group_by(Like.post_id)
            .all()
        )
        likes_count_map = {pid: cnt for pid, cnt in likes_counts_raw}

        saves_counts_raw = (
            self.db.query(SavedItem.post_id, func.count(SavedItem.id))
            .filter(SavedItem.post_id.in_(post_ids))
            .group_by(SavedItem.post_id)
            .all()
        )
        saves_count_map = {pid: cnt for pid, cnt in saves_counts_raw}

        liked_post_ids = set()
        saved_post_ids = set()
        following_author_ids = set()

        if current_user_id:
            user_likes = (
                self.db.query(Like.post_id)
                .filter(Like.user_id == current_user_id, Like.post_id.in_(post_ids))
                .all()
            )
            liked_post_ids = {row[0] for row in user_likes}

            user_saves = (
                self.db.query(SavedItem.post_id)
                .filter(SavedItem.user_id == current_user_id, SavedItem.post_id.in_(post_ids))
                .all()
            )
            saved_post_ids = {row[0] for row in user_saves}

            if author_ids:
                distinct_authors = [aid for aid in set(author_ids) if aid != current_user_id]
                if distinct_authors:
                    follows = (
                        self.db.query(Follow.following_id)
                        .filter(Follow.follower_id == current_user_id, Follow.following_id.in_(distinct_authors))
                        .all()
                    )
                    following_author_ids = {row[0] for row in follows}

        return {
            'likes_count': likes_count_map,
            'saves_count': saves_count_map,
            'liked_post_ids': liked_post_ids,
            'saved_post_ids': saved_post_ids,
            'following_author_ids': following_author_ids,
        }

    def list_posts_by_user(self, user_id: UUID, limit: int = 30) -> List[Post]:
        return (
            self.db.query(Post)
            .filter(Post.user_id == user_id)
            .order_by(Post.created_at.desc())
            .limit(limit)
            .all()
        )

    def delete_post(self, post: Post) -> None:
        try:
            self.db.query(Like).filter(Like.post_id == post.id).delete(synchronize_session=False)
            self.db.query(Comment).filter(Comment.post_id == post.id).delete(synchronize_session=False)
            self.db.query(SavedItem).filter(SavedItem.item_id == post.id, SavedItem.item_type == "post").delete(synchronize_session=False)
            self.db.delete(post)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    # --- Likes ---
    def like_post(self, user_id: UUID, post_id: UUID) -> bool:
        existing = self.db.query(Like).filter(Like.user_id == user_id, Like.post_id == post_id).first()
        if existing:
            return False

        like = Like(user_id=user_id, post_id=post_id)
        self.db.add(like)
        post = self.get_post_by_id(post_id)
        if post and post.user_id != user_id:
            liker = self.db.query(User).filter(User.id == user_id).first()
            liker_name = liker.display_name if liker else "Someone"
            existing_notif = (
                self.db.query(Notification)
                .filter(
                    Notification.user_id == post.user_id,
                    Notification.type == "like",
                    Notification.message.like(f"{liker_name} liked%"),
                )
                .first()
            )
            if not existing_notif:
                self.create_notification(
                    user_id=post.user_id,
                    type="like",
                    title="New Like",
                    message=f"{liker_name} liked your outfit post",
                )

        self.db.commit()
        return True

    def unlike_post(self, user_id: UUID, post_id: UUID) -> bool:
        like = self.db.query(Like).filter(Like.user_id == user_id, Like.post_id == post_id).first()
        if not like:
            return False

        self.db.delete(like)
        self.db.commit()
        return True

    def is_liked_by_user(self, user_id: UUID, post_id: UUID) -> bool:
        return self.db.query(Like).filter(Like.user_id == user_id, Like.post_id == post_id).first() is not None

    def count_likes(self, post_id: UUID) -> int:
        return self.db.query(func.count(Like.id)).filter(Like.post_id == post_id).scalar() or 0

    # --- Comments ---
    def add_comment(self, user_id: UUID, post_id: UUID, text: str) -> Comment:
        comment = Comment(user_id=user_id, post_id=post_id, content=text.strip())
        self.db.add(comment)
        post = self.get_post_by_id(post_id)
        if post and post.user_id != user_id:
            commenter = self.db.query(User).filter(User.id == user_id).first()
            name = commenter.display_name if commenter else "Someone"
            self.create_notification(
                user_id=post.user_id,
                type="comment",
                title="New Comment",
                message=f'{name} commented: "{text[:40]}..."',
            )

        self.db.commit()
        self.db.refresh(comment)
        return comment

    def delete_comment(self, comment: Comment) -> None:
        self.db.delete(comment)
        self.db.commit()

    def get_comment_by_id(self, comment_id: UUID) -> Optional[Comment]:
        return self.db.query(Comment).filter(Comment.id == comment_id).first()

    def list_comments_for_post(self, post_id: UUID) -> List[Comment]:
        return (
            self.db.query(Comment)
            .filter(Comment.post_id == post_id)
            .order_by(Comment.created_at.asc())
            .all()
        )

    def count_comments(self, post_id: UUID) -> int:
        return self.db.query(func.count(Comment.id)).filter(Comment.post_id == post_id).scalar() or 0

    # --- Follows ---
    def follow_user(self, follower_id: UUID, following_id: UUID) -> bool:
        if follower_id == following_id:
            return False

        existing = (
            self.db.query(Follow)
            .filter(Follow.follower_id == follower_id, Follow.following_id == following_id)
            .first()
        )
        if existing:
            return False

        follow = Follow(follower_id=follower_id, following_id=following_id)
        self.db.add(follow)

        # Notify followed user
        follower = self.db.query(User).filter(User.id == follower_id).first()
        name = follower.display_name if follower else "Someone"
        self.create_notification(
            user_id=following_id,
            type="follow",
            title="New Follower",
            message=f"{name} started following your style journey",
        )

        self.db.commit()
        return True

    def unfollow_user(self, follower_id: UUID, following_id: UUID) -> bool:
        follow = (
            self.db.query(Follow)
            .filter(Follow.follower_id == follower_id, Follow.following_id == following_id)
            .first()
        )
        if not follow:
            return False

        self.db.delete(follow)
        self.db.commit()
        return True

    def is_following(self, follower_id: UUID, following_id: UUID) -> bool:
        return (
            self.db.query(Follow)
            .filter(Follow.follower_id == follower_id, Follow.following_id == following_id)
            .first()
            is not None
        )

    def count_followers(self, user_id: UUID) -> int:
        return self.db.query(func.count(Follow.id)).filter(Follow.following_id == user_id).scalar() or 0

    def count_following(self, user_id: UUID) -> int:
        return self.db.query(func.count(Follow.id)).filter(Follow.follower_id == user_id).scalar() or 0

    def list_followers(self, user_id: UUID) -> List[User]:
        follows = self.db.query(Follow).filter(Follow.following_id == user_id).all()
        follower_ids = [f.follower_id for f in follows]
        return self.db.query(User).filter(User.id.in_(follower_ids)).all() if follower_ids else []

    def list_following(self, user_id: UUID) -> List[User]:
        follows = self.db.query(Follow).filter(Follow.follower_id == user_id).all()
        following_ids = [f.following_id for f in follows]
        return self.db.query(User).filter(User.id.in_(following_ids)).all() if following_ids else []

    # --- Saved Items ---
    def save_item(self, user_id: UUID, post_id: UUID, **extra) -> Optional[SavedItem]:
        existing = (
            self.db.query(SavedItem)
            .filter(SavedItem.user_id == user_id, SavedItem.post_id == post_id)
            .first()
        )
        if existing:
            return existing

        saved = SavedItem(user_id=user_id, post_id=post_id)
        self.db.add(saved)
        self.db.commit()
        self.db.refresh(saved)
        return saved

    def unsave_item(self, user_id: UUID, post_id: UUID) -> bool:
        saved = (
            self.db.query(SavedItem)
            .filter(SavedItem.user_id == user_id, SavedItem.post_id == post_id)
            .first()
        )
        if not saved:
            return False

        self.db.delete(saved)
        self.db.commit()
        return True

    def delete_saved_by_id(self, saved_id: UUID, user_id: UUID) -> bool:
        saved = self.db.query(SavedItem).filter(SavedItem.id == saved_id, SavedItem.user_id == user_id).first()
        if not saved:
            return False
        self.db.delete(saved)
        self.db.commit()
        return True

    def is_saved(self, user_id: UUID, post_id: UUID) -> bool:
        return (
            self.db.query(SavedItem)
            .filter(SavedItem.user_id == user_id, SavedItem.post_id == post_id)
            .first()
            is not None
        )

    def count_saves(self, post_id: UUID) -> int:
        return self.db.query(func.count(SavedItem.id)).filter(SavedItem.post_id == post_id).scalar() or 0

    def list_saved_items(self, user_id: UUID) -> List[SavedItem]:
        return self.db.query(SavedItem).filter(SavedItem.user_id == user_id).order_by(SavedItem.created_at.desc()).all()

    # --- Collections ---
    def create_collection(
        self,
        user_id: UUID,
        name: str,
        description: Optional[str] = None,
        **extra,
    ) -> Collection:
        collection = Collection(
            user_id=user_id,
            name=name,
            description=description,
        )
        self.db.add(collection)
        self.db.commit()
        self.db.refresh(collection)
        return collection

    def list_collections(self, user_id: UUID) -> List[Collection]:
        return (
            self.db.query(Collection)
            .filter(Collection.user_id == user_id)
            .order_by(Collection.created_at.desc())
            .all()
        )

    def get_collection_by_id(self, col_id: UUID) -> Optional[Collection]:
        return self.db.query(Collection).filter(Collection.id == col_id).first()

    # --- Notifications ---
    def create_notification(
        self,
        user_id: UUID,
        type: str,
        title: Optional[str] = None,
        message: Optional[str] = None,
        **extra,
    ) -> Notification:
        notif = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
        )
        self.db.add(notif)
        self.db.commit()
        self.db.refresh(notif)
        return notif

    def list_notifications(self, user_id: UUID, limit: int = 50) -> List[Notification]:
        return (
            self.db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .all()
        )

    def mark_notification_read(self, notif_id: UUID, user_id: UUID) -> bool:
        notif = (
            self.db.query(Notification)
            .filter(Notification.id == notif_id, Notification.user_id == user_id)
            .first()
        )
        if not notif:
            return False
        notif.is_read = True
        self.db.commit()
        return True

    def mark_all_notifications_read(self, user_id: UUID) -> None:
        self.db.query(Notification).filter(Notification.user_id == user_id).update({"is_read": True})
        self.db.commit()
