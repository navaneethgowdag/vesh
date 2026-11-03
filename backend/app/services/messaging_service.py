from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.conversation import Conversation, ConversationParticipant, Message
from app.models.user import User
from app.models.post import Post
from app.models.poll import Poll
from app.models.community import Community
from app.repositories.messaging_repository import MessagingRepository
from app.repositories.community_repository import CommunityRepository


class MessagingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MessagingRepository(db)
        self.comm_repo = CommunityRepository(db)

    def get_user_summary(self, user_id: Optional[UUID]) -> Dict[str, Any]:
        if not user_id:
            return {
                "id": UUID(int=0),
                "username": "unknown",
                "name": "Unknown",
                "avatar": None,
                "is_verified": False,
                "is_following": False,
                "is_me": False,
            }
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {
                "id": user_id,
                "username": "unknown",
                "name": "Unknown",
                "avatar": None,
                "is_verified": False,
                "is_following": False,
                "is_me": False,
            }
        return {
            "id": user.id,
            "username": user.username,
            "name": user.display_name or user.username,
            "avatar": getattr(user, "profile_image_url", None),
            "is_verified": getattr(user, "is_verified", False),
            "is_following": False,
            "is_me": False,
        }

    def _format_user_summary(self, user: Optional[User]) -> Dict[str, Any]:
        if not user:
            return self.get_user_summary(None)
        return self.get_user_summary(getattr(user, "id", None))

    def _hydrate_shared_content(
        self,
        shared_type: Optional[str],
        shared_id: Optional[UUID],
    ) -> Optional[Dict[str, Any]]:
        if not shared_type or not shared_id:
            return None

        if shared_type == "post":
            post = self.db.query(Post).filter(Post.id == shared_id).first()
            if post:
                u_summary = self.get_user_summary(post.user_id)
                return {
                    "content_type": "post",
                    "id": post.id,
                    "title_or_caption": post.caption[:150] if post.caption else "Outfit Post",
                    "image_url": post.image_url,
                    "author_name": u_summary["name"],
                }
            return {
                "content_type": "post",
                "id": shared_id,
                "title_or_caption": "Outfit Post (Unavailable)",
                "image_url": None,
                "author_name": None,
            }

        elif shared_type == "poll":
            poll = self.db.query(Poll).filter(Poll.id == shared_id).first()
            if poll:
                u_summary = self.get_user_summary(poll.creator_user_id)
                return {
                    "content_type": "poll",
                    "id": poll.id,
                    "title_or_caption": poll.question,
                    "image_url": None,
                    "author_name": u_summary["name"],
                    "extra": {
                        "options_count": len(poll.options or []),
                        "is_active": poll.is_active,
                    },
                }
            return {
                "content_type": "poll",
                "id": shared_id,
                "title_or_caption": "Fashion Poll (Unavailable)",
                "image_url": None,
                "author_name": None,
            }

        elif shared_type == "community":
            comm = self.comm_repo.get_community_by_id(shared_id)
            if comm:
                return {
                    "content_type": "community",
                    "id": comm.id,
                    "title_or_caption": comm.name,
                    "image_url": comm.cover_image_url,
                    "author_name": comm.category,
                    "extra": {
                        "visibility": comm.visibility,
                        "slug": comm.slug,
                    },
                }
            return {
                "content_type": "community",
                "id": shared_id,
                "title_or_caption": "Community (Unavailable)",
                "image_url": None,
                "author_name": None,
            }

        return None

    def _format_message(self, msg: Message) -> Dict[str, Any]:
        sender_summary = self.get_user_summary(msg.sender_user_id)
        shared_preview = self._hydrate_shared_content(msg.shared_content_type, msg.shared_content_id)

        return {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender": sender_summary,
            "message_type": msg.message_type,
            "text_content": msg.text_content,
            "shared_content": shared_preview,
            "created_at": msg.created_at,
        }

    def format_conversation(self, conv: Conversation, viewer_id: UUID) -> Dict[str, Any]:
        participants_data = []
        other_user = None

        for p in conv.participants or []:
            formatted_u = self.get_user_summary(p.user_id)
            participants_data.append({
                "id": p.id,
                "user": formatted_u,
                "role": p.role,
                "joined_at": p.joined_at,
                "last_read_at": p.last_read_at,
            })
            if p.user_id != viewer_id and other_user is None:
                other_user = formatted_u

        last_msg = None
        if conv.messages:
            last_msg = self._format_message(conv.messages[-1])
        else:
            msgs = self.repo.list_messages(conv.id, limit=1)
            if msgs:
                last_msg = self._format_message(msgs[-1])

        unread_count = self.repo.get_unread_count(conv.id, viewer_id)

        title = conv.title
        image_url = conv.image_url
        if conv.conversation_type == "direct" and other_user:
            if not title:
                title = other_user["name"]
            if not image_url:
                image_url = other_user["avatar"]

        return {
            "id": conv.id,
            "conversation_type": conv.conversation_type,
            "title": title or "Chat",
            "image_url": image_url,
            "participants": participants_data,
            "other_participant": other_user if conv.conversation_type == "direct" else None,
            "last_message": last_msg,
            "unread_count": unread_count,
            "updated_at": conv.updated_at,
            "created_at": conv.created_at,
        }

    def get_or_create_direct_chat(self, user_id: UUID, recipient_id: UUID) -> Dict[str, Any]:
        if user_id == recipient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start a direct conversation with yourself",
            )

        if self.repo.is_blocked(user_id, recipient_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create conversation with a blocked user",
            )

        conv = self.repo.get_or_create_direct_conversation(user_id, recipient_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not create conversation",
            )

        return self.format_conversation(conv, viewer_id=user_id)

    def create_group_chat(
        self,
        creator_id: UUID,
        participant_ids: List[UUID],
        title: str,
        image_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not title or not title.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group title is required",
            )

        valid_uids = [uid for uid in participant_ids if uid != creator_id and not self.repo.is_blocked(creator_id, uid)]
        if not valid_uids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one valid participant is required to create a group",
            )

        conv = self.repo.create_group_conversation(
            creator_user_id=creator_id,
            participant_user_ids=valid_uids,
            title=title.strip(),
            image_url=image_url,
        )
        return self.format_conversation(conv, viewer_id=creator_id)

    def get_conversation(self, conversation_id: UUID, user_id: UUID) -> Dict[str, Any]:
        conv = self.repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        part_uids = [p.user_id for p in conv.participants]
        if user_id not in part_uids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation",
            )

        return self.format_conversation(conv, viewer_id=user_id)

    def list_user_conversations(
        self,
        user_id: UUID,
        conversation_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        convs = self.repo.list_user_conversations(
            user_id=user_id,
            conversation_type=conversation_type,
            limit=limit,
            offset=offset,
        )
        return [self.format_conversation(c, viewer_id=user_id) for c in convs]

    def send_message(
        self,
        conversation_id: UUID,
        sender_id: UUID,
        message_type: str = "text",
        text_content: Optional[str] = None,
        shared_content_type: Optional[str] = None,
        shared_content_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        conv = self.repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        part_uids = [p.user_id for p in conv.participants]
        if sender_id not in part_uids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation",
            )

        if message_type == "text" and (not text_content or not text_content.strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message content cannot be empty",
            )

        msg = self.repo.add_message(
            conversation_id=conversation_id,
            sender_user_id=sender_id,
            message_type=message_type,
            text_content=text_content.strip() if text_content else None,
            shared_content_type=shared_content_type,
            shared_content_id=shared_content_id,
        )
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unable to send message to blocked user or conversation",
            )

        return self._format_message(msg)

    def list_messages(
        self,
        conversation_id: UUID,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conv = self.repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        part_uids = [p.user_id for p in conv.participants]
        if user_id not in part_uids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation",
            )

        self.repo.mark_as_read(conversation_id, user_id)

        msgs = self.repo.list_messages(conversation_id, limit=limit, offset=offset)
        return [self._format_message(m) for m in msgs]

    def mark_as_read(self, conversation_id: UUID, user_id: UUID) -> Dict[str, Any]:
        success = self.repo.mark_as_read(conversation_id, user_id)
        return {"success": success}

    def share_content(
        self,
        user_id: UUID,
        target_type: str,  # "conversation" | "community"
        target_id: UUID,
        content_type: str,  # "post" | "poll" | "community"
        content_id: UUID,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        if target_type == "conversation":
            conv = self.repo.get_conversation_by_id(target_id)
            if not conv:
                conv = self.repo.get_or_create_direct_conversation(user_id, target_id)
                if not conv:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Conversation or recipient user not found",
                    )

            msg_type = f"{content_type}_share"
            msg = self.send_message(
                conversation_id=conv.id,
                sender_id=user_id,
                message_type=msg_type,
                text_content=message,
                shared_content_type=content_type,
                shared_content_id=content_id,
            )
            return {"target_type": "conversation", "message": msg}

        elif target_type == "community":
            from app.services.community_service import CommunityService
            comm_svc = CommunityService(self.db)
            post_id = content_id if content_type == "post" else None
            poll_id = content_id if content_type == "poll" else None
            cp = comm_svc.create_community_post(
                community_id=target_id,
                user_id=user_id,
                post_id=post_id,
                poll_id=poll_id,
                message=message,
            )
            return {"target_type": "community", "community_post": cp}

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported target_type: {target_type}",
        )

    def block_user(self, blocker_id: UUID, blocked_id: UUID) -> Dict[str, Any]:
        if blocker_id == blocked_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot block yourself",
            )
        success = self.repo.block_user(blocker_id, blocked_id)
        return {"success": success, "blocked_user_id": blocked_id}

    def unblock_user(self, blocker_id: UUID, blocked_id: UUID) -> Dict[str, Any]:
        success = self.repo.unblock_user(blocker_id, blocked_id)
        return {"success": success, "unblocked_user_id": blocked_id}
