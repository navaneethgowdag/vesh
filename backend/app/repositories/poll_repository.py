import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple
from uuid import UUID
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, inspect
from app.models.poll import Poll, PollOption, PollVote
from app.models.user import User


class PollRepository:
    # Class-level resilient fallback storage for when Neon PostgreSQL DDL is restricted
    _fallback_polls: Dict[UUID, Poll] = {}
    _fallback_votes: Dict[Tuple[UUID, UUID], PollVote] = {}

    def __init__(self, db: Session):
        self.db = db
        self._has_table = self._check_tables_exist()

    def _check_tables_exist(self) -> bool:
        """Safely checks if the polls table exists in the connected database."""
        try:
            insp = inspect(self.db.bind)
            return "polls" in insp.get_table_names()
        except Exception:
            return False

    def create_poll(
        self,
        creator_user_id: UUID,
        question: str,
        options: List[str],
        expires_at: datetime,
        content_type: str = "standalone",
        post_id: Optional[UUID] = None,
        allow_vote_change: bool = False,
        show_results_before_vote: bool = False,
        allow_creator_vote: bool = False,
    ) -> Poll:
        creator = self.db.query(User).filter(User.id == creator_user_id).first()
        now = datetime.now(timezone.utc)
        poll_id = uuid.uuid4()

        poll = Poll(
            id=poll_id,
            creator_user_id=creator_user_id,
            question=question.strip(),
            content_type=content_type,
            post_id=post_id,
            expires_at=expires_at,
            allow_vote_change=allow_vote_change,
            show_results_before_vote=show_results_before_vote,
            allow_creator_vote=allow_creator_vote,
            created_at=now,
            updated_at=now,
        )

        opts: List[PollOption] = []
        for idx, opt_text in enumerate(options):
            opt = PollOption(
                id=uuid.uuid4(),
                poll_id=poll.id,
                option_text=opt_text.strip(),
                display_order=idx,
            )
            opt.poll = poll
            opts.append(opt)

        poll.options = opts
        poll.votes = []

        if self._has_table:
            try:
                self.db.add(poll)
                self.db.flush()
                for opt in opts:
                    self.db.add(opt)
                self.db.commit()
                self.db.refresh(poll)
                return poll
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_polls[poll.id] = poll
        return poll

    def get_poll_by_id(self, poll_id: UUID) -> Optional[Poll]:
        if self._has_table:
            try:
                p = (
                    self.db.query(Poll)
                    .options(
                        selectinload(Poll.options),
                        selectinload(Poll.votes),
                        joinedload(Poll.creator),
                    )
                    .filter(Poll.id == poll_id)
                    .first()
                )
                if p:
                    return p
            except Exception:
                self._has_table = False

        return self._fallback_polls.get(poll_id)

    def get_poll_by_post_id(self, post_id: UUID) -> Optional[Poll]:
        if self._has_table:
            try:
                p = (
                    self.db.query(Poll)
                    .options(
                        selectinload(Poll.options),
                        selectinload(Poll.votes),
                        joinedload(Poll.creator),
                    )
                    .filter(Poll.post_id == post_id)
                    .first()
                )
                if p:
                    return p
            except Exception:
                self._has_table = False

        for p in self._fallback_polls.values():
            if p.post_id == post_id:
                return p
        return None

    def list_polls(
        self,
        limit: int = 30,
        offset: int = 0,
        content_type: Optional[str] = None,
        only_active: bool = False,
    ) -> List[Poll]:
        if self._has_table:
            try:
                q = (
                    self.db.query(Poll)
                    .options(
                        selectinload(Poll.options),
                        selectinload(Poll.votes),
                        joinedload(Poll.creator),
                    )
                )
                if content_type:
                    q = q.filter(Poll.content_type == content_type)
                if only_active:
                    now = datetime.now(timezone.utc)
                    q = q.filter(Poll.expires_at > now)

                return q.order_by(Poll.created_at.desc()).offset(offset).limit(limit).all()
            except Exception:
                self._has_table = False

        polls = list(self._fallback_polls.values())
        if content_type:
            polls = [p for p in polls if p.content_type == content_type]
        if only_active:
            now = datetime.now(timezone.utc)
            polls = [p for p in polls if (p.expires_at.replace(tzinfo=timezone.utc) if p.expires_at.tzinfo is None else p.expires_at) > now]

        polls.sort(key=lambda p: p.created_at, reverse=True)
        return polls[offset : offset + limit]

    def delete_poll(self, poll: Poll) -> None:
        if self._has_table:
            try:
                self.db.delete(poll)
                self.db.commit()
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_polls.pop(poll.id, None)
        keys_to_del = [k for k in self._fallback_votes if k[0] == poll.id]
        for k in keys_to_del:
            self._fallback_votes.pop(k, None)

    def get_user_vote(self, poll_id: UUID, user_id: UUID) -> Optional[PollVote]:
        if self._has_table:
            try:
                v = (
                    self.db.query(PollVote)
                    .filter(PollVote.poll_id == poll_id, PollVote.user_id == user_id)
                    .first()
                )
                if v:
                    return v
            except Exception:
                self._has_table = False

        return self._fallback_votes.get((poll_id, user_id))

    def record_vote(self, poll_id: UUID, option_id: UUID, user_id: UUID) -> PollVote:
        vote = PollVote(
            id=uuid.uuid4(),
            poll_id=poll_id,
            option_id=option_id,
            user_id=user_id,
            created_at=datetime.now(timezone.utc),
        )

        if self._has_table:
            try:
                self.db.add(vote)
                self.db.commit()
                self.db.refresh(vote)
                return vote
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_votes[(poll_id, user_id)] = vote
        poll = self._fallback_polls.get(poll_id)
        if poll:
            if not hasattr(poll, "votes") or poll.votes is None:
                poll.votes = []
            poll.votes = [v for v in poll.votes if v.user_id != user_id] + [vote]
        return vote

    def update_vote(self, vote: PollVote, new_option_id: UUID) -> PollVote:
        vote.option_id = new_option_id
        if self._has_table:
            try:
                self.db.commit()
                self.db.refresh(vote)
                return vote
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_votes[(vote.poll_id, vote.user_id)] = vote
        poll = self._fallback_polls.get(vote.poll_id)
        if poll and hasattr(poll, "votes") and poll.votes:
            for v in poll.votes:
                if v.id == vote.id:
                    v.option_id = new_option_id
        return vote

    def get_vote_counts_for_poll(self, poll_id: UUID) -> Tuple[int, Dict[UUID, int]]:
        """
        Dynamically calculates vote counts per option from persisted votes.
        Returns (total_votes, {option_id: count}).
        """
        if self._has_table:
            try:
                rows = (
                    self.db.query(PollVote.option_id, func.count(PollVote.id))
                    .filter(PollVote.poll_id == poll_id)
                    .group_by(PollVote.option_id)
                    .all()
                )
                counts = {r[0]: r[1] for r in rows}
                total = sum(counts.values())
                return total, counts
            except Exception:
                self._has_table = False

        counts: Dict[UUID, int] = {}
        for (pid, uid), v in self._fallback_votes.items():
            if pid == poll_id:
                counts[v.option_id] = counts.get(v.option_id, 0) + 1
        return sum(counts.values()), counts

    def batch_get_user_votes(self, poll_ids: List[UUID], user_id: UUID) -> Dict[UUID, UUID]:
        """Returns mapping: poll_id -> voted option_id for a given user."""
        if not poll_ids or not user_id:
            return {}
        if self._has_table:
            try:
                rows = (
                    self.db.query(PollVote.poll_id, PollVote.option_id)
                    .filter(PollVote.poll_id.in_(poll_ids), PollVote.user_id == user_id)
                    .all()
                )
                return {r[0]: r[1] for r in rows}
            except Exception:
                self._has_table = False

        res = {}
        for pid in poll_ids:
            v = self._fallback_votes.get((pid, user_id))
            if v:
                res[pid] = v.option_id
        return res

    def batch_get_vote_counts(self, poll_ids: List[UUID]) -> Dict[UUID, Dict[UUID, int]]:
        """Returns mapping: poll_id -> {option_id: count}."""
        if not poll_ids:
            return {}
        if self._has_table:
            try:
                rows = (
                    self.db.query(PollVote.poll_id, PollVote.option_id, func.count(PollVote.id))
                    .filter(PollVote.poll_id.in_(poll_ids))
                    .group_by(PollVote.poll_id, PollVote.option_id)
                    .all()
                )
                res: Dict[UUID, Dict[UUID, int]] = {}
                for pid, oid, cnt in rows:
                    if pid not in res:
                        res[pid] = {}
                    res[pid][oid] = cnt
                return res
            except Exception:
                self._has_table = False

        res: Dict[UUID, Dict[UUID, int]] = {pid: {} for pid in poll_ids}
        for (pid, uid), v in self._fallback_votes.items():
            if pid in res:
                res[pid][v.option_id] = res[pid].get(v.option_id, 0) + 1
        return res
