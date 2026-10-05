from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.social import CommentCreate, CommentResponse
from app.services.feed_service import FeedService
from app.models.user import User

router = APIRouter(tags=["comments"])


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def add_comment(
    post_id: UUID,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FeedService(db)
    comment = service.add_comment(user_id=current_user.id, post_id=post_id, text=comment_in.text)
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "name": current_user.display_name or current_user.username,
            "avatar": current_user.profile_image_url,
            "is_verified": current_user.is_verified,
            "is_following": False,
        },
        "text": comment.text,
        "likes_count": 0,
        "created_at": comment.created_at,
    }


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FeedService(db)
    service.delete_comment(comment_id=comment_id, user_id=current_user.id)
    return None

