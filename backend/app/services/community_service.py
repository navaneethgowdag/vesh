from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.community import Community, CommunityMember, CommunityPost
from app.models.user import User
from app.repositories.community_repository import CommunityRepository
from app.services.feed_service import FeedService
from app.services.poll_service import PollService


class CommunityService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CommunityRepository(db)
        self.feed_service = FeedService(db)
        self.poll_service = PollService(db)

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

    def format_community(self, community: Community, viewer_id: Optional[UUID] = None) -> Dict[str, Any]:
        member_count = self.repo.get_member_count(community.id, status="active")
        membership = self.repo.get_membership(community.id, viewer_id) if viewer_id else None

        owner_summary = self.get_user_summary(community.owner_user_id)

        return {
            "id": community.id,
            "name": community.name,
            "slug": community.slug,
            "description": community.description,
            "cover_image_url": community.cover_image_url,
            "category": community.category,
            "rules": community.rules,
            "visibility": community.visibility,
            "owner": owner_summary,
            "members_count": max(member_count, 1),
            "is_member": membership is not None and membership.status == "active",
            "membership_role": membership.role if membership else None,
            "membership_status": membership.status if membership else None,
            "created_at": community.created_at,
        }

    def create_community(
        self,
        owner_id: UUID,
        name: str,
        description: Optional[str] = None,
        category: str = "Fashion",
        rules: Optional[str] = None,
        cover_image_url: Optional[str] = None,
        visibility: str = "public",
    ) -> Dict[str, Any]:
        existing = self.repo.get_community_by_slug(name.lower().replace(" ", "-"))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A community with this name or slug already exists",
            )

        community = self.repo.create_community(
            owner_id=owner_id,
            name=name,
            description=description,
            category=category,
            rules=rules,
            cover_image_url=cover_image_url,
            visibility=visibility,
        )
        return self.format_community(community, viewer_id=owner_id)

    def get_community(self, identifier: str, viewer_id: Optional[UUID] = None) -> Dict[str, Any]:
        community = None
        try:
            val_uuid = UUID(identifier)
            community = self.repo.get_community_by_id(val_uuid)
        except ValueError:
            pass

        if not community:
            community = self.repo.get_community_by_slug(identifier)

        if not community:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

        return self.format_community(community, viewer_id=viewer_id)

    def list_communities(
        self,
        category: Optional[str] = None,
        visibility: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        viewer_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        communities = self.repo.list_communities(
            category=category,
            visibility=visibility,
            limit=limit,
            offset=offset,
        )
        return [self.format_community(c, viewer_id=viewer_id) for c in communities]

    def update_community(
        self,
        community_id: UUID,
        user_id: UUID,
        description: Optional[str] = None,
        category: Optional[str] = None,
        rules: Optional[str] = None,
        cover_image_url: Optional[str] = None,
        visibility: Optional[str] = None,
    ) -> Dict[str, Any]:
        community = self.repo.get_community_by_id(community_id)
        if not community:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

        membership = self.repo.get_membership(community_id, user_id)
        if not membership or membership.role not in ("owner", "moderator"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only community owners or moderators can update community settings",
            )

        updated = self.repo.update_community(
            community_id=community_id,
            description=description,
            category=category,
            rules=rules,
            cover_image_url=cover_image_url,
            visibility=visibility,
        )
        return self.format_community(updated, viewer_id=user_id)

    def join_community(self, community_id: UUID, user_id: UUID) -> Dict[str, Any]:
        community = self.repo.get_community_by_id(community_id)
        if not community:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

        existing = self.repo.get_membership(community_id, user_id)
        if existing and existing.status == "active":
            return {"status": "already_member", "membership": existing}
        if existing and existing.status == "pending":
            return {"status": "pending_approval", "membership": existing}

        status_value = "active" if community.visibility == "public" else "pending"
        member = self.repo.add_member(community_id, user_id, role="member", status=status_value)
        return {
            "status": "joined" if status_value == "active" else "requested",
            "role": member.role,
            "membership_status": member.status,
        }

    def leave_community(self, community_id: UUID, user_id: UUID) -> Dict[str, Any]:
        community = self.repo.get_community_by_id(community_id)
        if not community:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

        if community.owner_user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Community owner cannot leave their community without transferring ownership",
            )

        removed = self.repo.remove_member(community_id, user_id)
        return {"success": removed}

    def manage_member(
        self,
        community_id: UUID,
        actor_user_id: UUID,
        target_user_id: UUID,
        action: str,  # "approve" | "reject" | "make_moderator" | "remove_moderator"
    ) -> Dict[str, Any]:
        community = self.repo.get_community_by_id(community_id)
        if not community:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

        actor_membership = self.repo.get_membership(community_id, actor_user_id)
        if not actor_membership or actor_membership.role not in ("owner", "moderator"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only community owners or moderators can manage members",
            )

        target_membership = self.repo.get_membership(community_id, target_user_id)
        if not target_membership:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target membership not found")

        if target_membership.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify owner membership",
            )

        if action == "approve":
            self.repo.update_membership(community_id, target_user_id, status="active")
        elif action == "reject":
            self.repo.remove_member(community_id, target_user_id)
        elif action == "make_moderator":
            if actor_membership.role != "owner":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the owner can promote members to moderator",
                )
            self.repo.update_membership(community_id, target_user_id, role="moderator")
        elif action == "remove_moderator":
            if actor_membership.role != "owner":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the owner can demote moderators",
                )
            self.repo.update_membership(community_id, target_user_id, role="member")

        updated = self.repo.get_membership(community_id, target_user_id)
        return {"action": action, "success": True, "status": updated.status if updated else "removed"}

    def list_members(
        self,
        community_id: UUID,
        viewer_id: Optional[UUID] = None,
        status: str = "active",
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        community = self.repo.get_community_by_id(community_id)
        if not community:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

        if community.visibility == "private":
            membership = self.repo.get_membership(community_id, viewer_id) if viewer_id else None
            if not membership or membership.status != "active":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Private community members list is only visible to active members",
                )

        members = self.repo.list_community_members(community_id, status=status, limit=limit, offset=offset)
        res = []
        for m in members:
            user_summary = self.get_user_summary(m.user_id)
            res.append({
                "id": m.id,
                "community_id": m.community_id,
                "user": user_summary,
                "role": m.role,
                "status": m.status,
                "joined_at": m.joined_at,
            })
        return res

    def create_community_post(
        self,
        community_id: UUID,
        user_id: UUID,
        post_id: Optional[UUID] = None,
        poll_id: Optional[UUID] = None,
        title: Optional[str] = None,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        community = self.repo.get_community_by_id(community_id)
        if not community:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

        membership = self.repo.get_membership(community_id, user_id)
        if not membership or membership.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be an active member to post in this community",
            )

        cp = self.repo.create_community_post(
            community_id=community_id,
            shared_by_user_id=user_id,
            post_id=post_id,
            poll_id=poll_id,
            title=title,
            message=message,
        )
        return self._format_community_post(cp, viewer_id=user_id)

    def _format_community_post(self, cp: CommunityPost, viewer_id: Optional[UUID] = None) -> Dict[str, Any]:
        shared_by_summary = self.get_user_summary(cp.shared_by_user_id)
        formatted_post = None
        if cp.post_id:
            p = self.feed_service.social_repo.get_post_by_id(cp.post_id)
            if p:
                formatted_post = self.feed_service._format_post(p, current_user_id=viewer_id)

        formatted_poll = None
        if cp.poll_id:
            poll_obj = self.poll_service.repo.get_poll_by_id(cp.poll_id)
            if poll_obj:
                formatted_poll = self.poll_service.format_poll(poll_obj, viewer_id=viewer_id)

        return {
            "id": cp.id,
            "community_id": cp.community_id,
            "shared_by": shared_by_summary,
            "title": cp.title,
            "message": cp.message,
            "post": formatted_post,
            "poll": formatted_poll,
            "is_pinned": cp.is_pinned,
            "created_at": cp.created_at,
        }

    def list_community_feed(
        self,
        community_id: UUID,
        viewer_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        community = self.repo.get_community_by_id(community_id)
        if not community:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

        if community.visibility == "private":
            membership = self.repo.get_membership(community_id, viewer_id) if viewer_id else None
            if not membership or membership.status != "active":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Private community content is only accessible to active members",
                )

        posts = self.repo.list_community_posts(community_id, limit=limit, offset=offset)
        return [self._format_community_post(p, viewer_id=viewer_id) for p in posts]

    def delete_community_post(self, community_id: UUID, post_id: UUID, user_id: UUID) -> bool:
        cp = self.repo.get_community_post_by_id(post_id)
        if not cp or cp.community_id != community_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found in community")

        membership = self.repo.get_membership(community_id, user_id)
        is_mod_or_owner = membership and membership.role in ("owner", "moderator")
        is_author = cp.shared_by_user_id == user_id

        if not (is_mod_or_owner or is_author):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this community post",
            )

        return self.repo.delete_community_post(post_id)
