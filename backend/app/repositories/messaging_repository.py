import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple, Set
from uuid import UUID
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import inspect, or_, and_
from app.models.conversation import Conversation, ConversationParticipant, Message, UserBlock
from app.models.user import User


class MessagingRepository:
    _fallback_conversations: Dict[UUID, Conversation] = {}
    _fallback_participants: Dict[Tuple[UUID, UUID], ConversationParticipant] = {}
    _fallback_messages: Dict[UUID, Message] = {}
    _fallback_blocks: Set[Tuple[UUID, UUID]] = set()

    def __init__(self, db: Session):
        self.db = db
        self._has_table = self._check_tables_exist()

    def _check_tables_exist(self) -> bool:
        try:
            insp = inspect(self.db.bind)
            return "conversations" in insp.get_table_names()
        except Exception:
            return False

    def is_blocked(self, user_a_id: UUID, user_b_id: UUID) -> bool:
        """Returns True if user_a blocked user_b or user_b blocked user_a."""
        if self._has_table:
            try:
                block = (
                    self.db.query(UserBlock)
                    .filter(
                        or_(
                            and_(UserBlock.blocker_user_id == user_a_id, UserBlock.blocked_user_id == user_b_id),
                            and_(UserBlock.blocker_user_id == user_b_id, UserBlock.blocked_user_id == user_a_id),
                        )
                    )
                    .first()
                )
                return block is not None
            except Exception:
                self._has_table = False

        return (user_a_id, user_b_id) in self._fallback_blocks or (user_b_id, user_a_id) in self._fallback_blocks

    def block_user(self, blocker_id: UUID, blocked_id: UUID) -> bool:
        if self.is_blocked(blocker_id, blocked_id):
            return True

        now = datetime.now(timezone.utc)
        ub = UserBlock(
            id=uuid.uuid4(),
            blocker_user_id=blocker_id,
            blocked_user_id=blocked_id,
            created_at=now,
        )

        if self._has_table:
            try:
                self.db.add(ub)
                self.db.commit()
                return True
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_blocks.add((blocker_id, blocked_id))
        return True

    def unblock_user(self, blocker_id: UUID, blocked_id: UUID) -> bool:
        if self._has_table:
            try:
                ub = (
                    self.db.query(UserBlock)
                    .filter(UserBlock.blocker_user_id == blocker_id, UserBlock.blocked_user_id == blocked_id)
                    .first()
                )
                if ub:
                    self.db.delete(ub)
                    self.db.commit()
                    return True
            except Exception:
                self.db.rollback()
                self._has_table = False

        if (blocker_id, blocked_id) in self._fallback_blocks:
            self._fallback_blocks.remove((blocker_id, blocked_id))
            return True
        return False

    def get_or_create_direct_conversation(self, user_a_id: UUID, user_b_id: UUID) -> Optional[Conversation]:
        if self.is_blocked(user_a_id, user_b_id):
            return None

        # Check existing direct conversation
        if self._has_table:
            try:
                # Find direct conversation where both user_a and user_b are participants
                conv = (
                    self.db.query(Conversation)
                    .join(ConversationParticipant, Conversation.id == ConversationParticipant.conversation_id)
                    .filter(
                        Conversation.conversation_type == "direct",
                        ConversationParticipant.user_id == user_a_id,
                    )
                    .all()
                )
                for c in conv:
                    other = (
                        self.db.query(ConversationParticipant)
                        .filter(
                            ConversationParticipant.conversation_id == c.id,
                            ConversationParticipant.user_id == user_b_id,
                        )
                        .first()
                    )
                    if other:
                        return self.get_conversation_by_id(c.id)
            except Exception:
                self._has_table = False

        # In fallback store
        for c in self._fallback_conversations.values():
            if c.conversation_type == "direct":
                part_uids = [
                    uid for (cid, uid) in self._fallback_participants.keys() if cid == c.id
                ]
                if user_a_id in part_uids and user_b_id in part_uids:
                    return c

        # Create new direct conversation
        now = datetime.now(timezone.utc)
        conv_id = uuid.uuid4()
        conv = Conversation(
            id=conv_id,
            conversation_type="direct",
            created_by_user_id=user_a_id,
            created_at=now,
            updated_at=now,
        )

        part_a = ConversationParticipant(
            id=uuid.uuid4(),
            conversation_id=conv_id,
            user_id=user_a_id,
            role="member",
            joined_at=now,
            last_read_at=now,
        )

        part_b = ConversationParticipant(
            id=uuid.uuid4(),
            conversation_id=conv_id,
            user_id=user_b_id,
            role="member",
            joined_at=now,
            last_read_at=None,
        )

        conv.participants = [part_a, part_b]
        conv.messages = []

        if self._has_table:
            try:
                self.db.add(conv)
                self.db.flush()
                self.db.add(part_a)
                self.db.add(part_b)
                self.db.commit()
                return self.get_conversation_by_id(conv_id)
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_conversations[conv_id] = conv
        self._fallback_participants[(conv_id, user_a_id)] = part_a
        self._fallback_participants[(conv_id, user_b_id)] = part_b
        return conv

    def create_group_conversation(
        self,
        creator_user_id: UUID,
        participant_user_ids: List[UUID],
        title: str,
        image_url: Optional[str] = None,
    ) -> Conversation:
        now = datetime.now(timezone.utc)
        conv_id = uuid.uuid4()
        conv = Conversation(
            id=conv_id,
            conversation_type="group",
            title=title.strip(),
            image_url=image_url,
            created_by_user_id=creator_user_id,
            created_at=now,
            updated_at=now,
        )

        all_uids = list(dict.fromkeys([creator_user_id] + participant_user_ids))
        parts = []
        for uid in all_uids:
            p = ConversationParticipant(
                id=uuid.uuid4(),
                conversation_id=conv_id,
                user_id=uid,
                role="creator" if uid == creator_user_id else "member",
                joined_at=now,
                last_read_at=now if uid == creator_user_id else None,
            )
            parts.append(p)

        conv.participants = parts
        conv.messages = []

        if self._has_table:
            try:
                self.db.add(conv)
                self.db.flush()
                for p in parts:
                    self.db.add(p)
                self.db.commit()
                return self.get_conversation_by_id(conv_id)
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_conversations[conv_id] = conv
        for p in parts:
            self._fallback_participants[(conv_id, p.user_id)] = p
        return conv

    def get_conversation_by_id(self, conversation_id: UUID) -> Optional[Conversation]:
        if self._has_table:
            try:
                c = (
                    self.db.query(Conversation)
                    .options(
                        joinedload(Conversation.creator),
                        selectinload(Conversation.participants).joinedload(ConversationParticipant.user),
                        selectinload(Conversation.messages).joinedload(Message.sender),
                    )
                    .filter(Conversation.id == conversation_id)
                    .first()
                )
                if c:
                    return c
            except Exception:
                self._has_table = False

        conv = self._fallback_conversations.get(conversation_id)
        if conv:
            conv.participants = [
                p for (cid, _), p in self._fallback_participants.items() if cid == conversation_id
            ]
            conv.messages = [
                m for m in self._fallback_messages.values() if m.conversation_id == conversation_id
            ]
            conv.messages.sort(key=lambda x: x.created_at)
        return conv

    def list_user_conversations(
        self,
        user_id: UUID,
        conversation_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Conversation]:
        if self._has_table:
            try:
                q = (
                    self.db.query(Conversation)
                    .join(ConversationParticipant, Conversation.id == ConversationParticipant.conversation_id)
                    .options(
                        selectinload(Conversation.participants).joinedload(ConversationParticipant.user),
                        selectinload(Conversation.messages).joinedload(Message.sender),
                    )
                    .filter(
                        ConversationParticipant.user_id == user_id,
                        ConversationParticipant.is_archived.is_(False),
                    )
                )
                if conversation_type:
                    q = q.filter(Conversation.conversation_type == conversation_type)
                return q.order_by(Conversation.updated_at.desc()).offset(offset).limit(limit).all()
            except Exception:
                self._has_table = False

        user_conv_ids = [
            cid for (cid, uid), p in self._fallback_participants.items()
            if uid == user_id and not p.is_archived
        ]
        convs = [self.get_conversation_by_id(cid) for cid in user_conv_ids if cid in self._fallback_conversations]
        convs = [c for c in convs if c is not None]
        if conversation_type:
            convs = [c for c in convs if c.conversation_type == conversation_type]
        convs.sort(key=lambda x: x.updated_at, reverse=True)
        return convs[offset : offset + limit]

    def get_participant(self, conversation_id: UUID, user_id: UUID) -> Optional[ConversationParticipant]:
        if self._has_table:
            try:
                return (
                    self.db.query(ConversationParticipant)
                    .filter(
                        ConversationParticipant.conversation_id == conversation_id,
                        ConversationParticipant.user_id == user_id,
                    )
                    .first()
                )
            except Exception:
                self._has_table = False

        return self._fallback_participants.get((conversation_id, user_id))

    def add_message(
        self,
        conversation_id: UUID,
        sender_user_id: UUID,
        message_type: str = "text",
        text_content: Optional[str] = None,
        shared_content_type: Optional[str] = None,
        shared_content_id: Optional[UUID] = None,
    ) -> Optional[Message]:
        conv = self.get_conversation_by_id(conversation_id)
        if not conv:
            return None

        # Check block status between participants
        for p in conv.participants:
            if p.user_id != sender_user_id and self.is_blocked(sender_user_id, p.user_id):
                return None

        now = datetime.now(timezone.utc)
        msg_id = uuid.uuid4()
        msg = Message(
            id=msg_id,
            conversation_id=conversation_id,
            sender_user_id=sender_user_id,
            message_type=message_type,
            text_content=text_content,
            shared_content_type=shared_content_type,
            shared_content_id=shared_content_id,
            created_at=now,
            updated_at=now,
        )

        # Update conversation updated_at and sender's last_read_at
        conv.updated_at = now
        part = self.get_participant(conversation_id, sender_user_id)
        if part:
            part.last_read_at = now

        if self._has_table:
            try:
                self.db.add(msg)
                self.db.add(conv)
                if part:
                    self.db.add(part)
                self.db.commit()
                self.db.refresh(msg)
                return msg
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_messages[msg_id] = msg
        self._fallback_conversations[conversation_id] = conv
        if part:
            self._fallback_participants[(conversation_id, sender_user_id)] = part
        return msg

    def list_messages(
        self,
        conversation_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Message]:
        if self._has_table:
            try:
                return (
                    self.db.query(Message)
                    .options(joinedload(Message.sender))
                    .filter(Message.conversation_id == conversation_id)
                    .order_by(Message.created_at.asc())
                    .offset(offset)
                    .limit(limit)
                    .all()
                )
            except Exception:
                self._has_table = False

        msgs = [m for m in self._fallback_messages.values() if m.conversation_id == conversation_id]
        msgs.sort(key=lambda x: x.created_at)
        return msgs[offset : offset + limit]

    def mark_as_read(self, conversation_id: UUID, user_id: UUID) -> bool:
        part = self.get_participant(conversation_id, user_id)
        if not part:
            return False

        now = datetime.now(timezone.utc)
        part.last_read_at = now

        if self._has_table:
            try:
                self.db.add(part)
                self.db.commit()
                return True
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_participants[(conversation_id, user_id)] = part
        return True

    def get_unread_count(self, conversation_id: UUID, user_id: UUID) -> int:
        part = self.get_participant(conversation_id, user_id)
        if not part:
            return 0

        last_read = part.last_read_at

        if self._has_table:
            try:
                q = (
                    self.db.query(Message)
                    .filter(
                        Message.conversation_id == conversation_id,
                        Message.sender_user_id != user_id,
                    )
                )
                if last_read:
                    q = q.filter(Message.created_at > last_read)
                return q.count()
            except Exception:
                self._has_table = False

        msgs = [
            m for m in self._fallback_messages.values()
            if m.conversation_id == conversation_id and m.sender_user_id != user_id
        ]
        if last_read:
            msgs = [m for m in msgs if m.created_at > last_read]
        return len(msgs)

    def get_total_unread_count(self, user_id: UUID) -> int:
        convs = self.list_user_conversations(user_id)
        return sum(self.get_unread_count(c.id, user_id) for c in convs)
