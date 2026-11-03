from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.poll import Poll, PollOption, PollVote
from app.models.notification import Notification
from app.models.user import User
from app.repositories.poll_repository import PollRepository
from app.schemas.poll import PollCreate


class PollService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PollRepository(db)

    def create_poll(
        self,
        creator_user_id: UUID,
        poll_in: PollCreate,
        default_post_id: Optional[UUID] = None,
        default_expires_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Creates a new poll: standalone, attached to a post, or attached to a moment.
        Enforces 2-6 options, expiration timestamp, and creator settings.
        """
        now = datetime.now(timezone.utc)

        # Expiration determination
        if default_expires_at:
            expires_at = default_expires_at
        elif poll_in.expires_at:
            expires_at = poll_in.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
        else:
            duration_hours = poll_in.duration_hours if poll_in.duration_hours is not None else 24
            expires_at = now + timedelta(hours=duration_hours)

        post_id = default_post_id or poll_in.post_id

        poll = self.repo.create_poll(
            creator_user_id=creator_user_id,
            question=poll_in.question,
            options=poll_in.options,
            expires_at=expires_at,
            content_type=poll_in.content_type,
            post_id=post_id,
            allow_vote_change=poll_in.allow_vote_change,
            show_results_before_vote=poll_in.show_results_before_vote,
            allow_creator_vote=poll_in.allow_creator_vote,
        )

        return self.format_poll(poll, viewer_id=creator_user_id)

    def get_poll(self, poll_id: UUID, viewer_id: Optional[UUID] = None) -> Dict[str, Any]:
        poll = self.repo.get_poll_by_id(poll_id)
        if not poll:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Poll not found",
            )
        return self.format_poll(poll, viewer_id=viewer_id)

    def list_polls(
        self,
        limit: int = 30,
        offset: int = 0,
        content_type: Optional[str] = None,
        only_active: bool = False,
        viewer_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        polls = self.repo.list_polls(
            limit=limit,
            offset=offset,
            content_type=content_type,
            only_active=only_active,
        )
        return self.format_polls_batch(polls, viewer_id=viewer_id)

    def vote_poll(self, poll_id: UUID, option_id: UUID, user_id: UUID) -> Dict[str, Any]:
        poll = self.repo.get_poll_by_id(poll_id)
        if not poll:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Poll not found",
            )

        # 1. Expiration check
        now = datetime.now(timezone.utc)
        poll_exp = poll.expires_at
        if poll_exp.tzinfo is None:
            poll_exp = poll_exp.replace(tzinfo=timezone.utc)
        if now >= poll_exp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This poll has closed",
            )

        # 2. Creator voting rule
        # By default, creator voting is disabled (allow_creator_vote=False) to prevent bias
        if not poll.allow_creator_vote and poll.creator_user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Creator cannot vote on their own poll",
            )

        # 3. Option validity
        valid_opt = next((o for o in poll.options if o.id == option_id), None)
        if not valid_opt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected option does not belong to this poll",
            )

        # 4. Existing vote check & vote change policy
        existing_vote = self.repo.get_user_vote(poll_id=poll_id, user_id=user_id)
        if existing_vote:
            if not poll.allow_vote_change:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Vote changing is not allowed for this poll",
                )
            self.repo.update_vote(existing_vote, new_option_id=option_id)
        else:
            self.repo.record_vote(poll_id=poll_id, option_id=option_id, user_id=user_id)
            self._notify_creator_of_vote(poll, voter_user_id=user_id)

        # Invalidate/refresh view
        return self.get_poll(poll_id, viewer_id=user_id)

    def delete_poll(self, poll_id: UUID, user_id: UUID) -> None:
        poll = self.repo.get_poll_by_id(poll_id)
        if not poll:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Poll not found",
            )
        if poll.creator_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the poll creator can delete this poll",
            )
        self.repo.delete_poll(poll)

    def _notify_creator_of_vote(self, poll: Poll, voter_user_id: UUID) -> None:
        """Sends a notification to the poll creator when a vote is cast."""
        if poll.creator_user_id == voter_user_id:
            return
        try:
            voter = self.db.query(User).filter(User.id == voter_user_id).first()
            voter_name = (voter.display_name or voter.username) if voter else "Someone"
            trunc_q = poll.question[:40] + ("..." if len(poll.question) > 40 else "")
            notif = Notification(
                user_id=poll.creator_user_id,
                type="poll_vote",
                title="New Poll Vote",
                message=f"{voter_name} voted on your poll: \"{trunc_q}\"",
            )
            self.db.add(notif)
            self.db.commit()
        except Exception:
            pass

    def format_poll(
        self,
        poll: Poll,
        viewer_id: Optional[UUID] = None,
        user_voted_option_id: Optional[UUID] = None,
        vote_counts: Optional[Dict[UUID, int]] = None,
    ) -> Dict[str, Any]:
        """
        Formats a poll adhering to results visibility rules:
        - If show_results_before_vote=False:
          Only users who have already voted, or the creator, or if the poll is expired
          can see vote tallies and percentages.
        """
        now = datetime.now(timezone.utc)
        poll_exp = poll.expires_at
        if poll_exp.tzinfo is None:
            poll_exp = poll_exp.replace(tzinfo=timezone.utc)
        is_expired = now >= poll_exp
        time_remaining = max(0, int((poll_exp - now).total_seconds()))

        # Determine user vote if not supplied
        if user_voted_option_id is None and viewer_id:
            vote = self.repo.get_user_vote(poll_id=poll.id, user_id=viewer_id)
            user_voted_option_id = vote.option_id if vote else None

        has_voted = user_voted_option_id is not None
        is_creator = viewer_id is not None and viewer_id == poll.creator_user_id

        # Vote counts
        if vote_counts is None:
            total_votes, counts_map = self.repo.get_vote_counts_for_poll(poll.id)
        else:
            counts_map = vote_counts
            total_votes = sum(counts_map.values())

        # Results visibility rule
        can_see_results = poll.show_results_before_vote or is_expired or has_voted or is_creator

        options_data = []
        for opt in poll.options:
            cnt = counts_map.get(opt.id, 0)
            pct = round((cnt / total_votes * 100), 1) if (total_votes > 0) else 0.0
            options_data.append({
                "id": opt.id,
                "poll_id": poll.id,
                "option_text": opt.option_text,
                "display_order": opt.display_order,
                "vote_count": cnt if can_see_results else None,
                "percentage": pct if can_see_results else None,
            })

        creator = self.db.query(User).filter(User.id == poll.creator_user_id).first()
        creator_summary = {
            "id": creator.id if creator else poll.creator_user_id,
            "username": creator.username if creator else "unknown",
            "name": (creator.display_name or creator.username) if creator else "Unknown",
            "avatar": creator.profile_image_url if creator else None,
            "is_verified": creator.is_verified if creator else False,
        } if creator else None

        return {
            "id": poll.id,
            "creator_user_id": poll.creator_user_id,
            "question": poll.question,
            "content_type": poll.content_type,
            "parent_post_id": poll.parent_post_id,
            "parent_moment_id": poll.parent_moment_id,
            "post_id": poll.post_id,
            "expires_at": poll_exp,
            "is_expired": is_expired,
            "time_remaining_seconds": time_remaining,
            "allow_vote_change": poll.allow_vote_change,
            "show_results_before_vote": poll.show_results_before_vote,
            "allow_creator_vote": poll.allow_creator_vote,
            "total_votes": total_votes if can_see_results else None,
            "has_voted": has_voted,
            "user_voted_option_id": user_voted_option_id,
            "options": options_data,
            "created_at": poll.created_at,
            "creator": creator_summary,
        }

    def format_polls_batch(
        self,
        polls: List[Poll],
        viewer_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Batch format polls with O(1) bulk queries to prevent N+1 overhead."""
        if not polls:
            return []

        poll_ids = [p.id for p in polls]
        user_votes_map = self.repo.batch_get_user_votes(poll_ids, viewer_id) if viewer_id else {}
        batch_counts = self.repo.batch_get_vote_counts(poll_ids)

        return [
            self.format_poll(
                p,
                viewer_id=viewer_id,
                user_voted_option_id=user_votes_map.get(p.id),
                vote_counts=batch_counts.get(p.id, {}),
            )
            for p in polls
        ]
