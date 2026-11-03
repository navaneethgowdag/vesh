import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple
from uuid import UUID
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import inspect
from app.models.community import Community, CommunityMember, CommunityPost
from app.models.user import User
from app.models.post import Post
from app.models.poll import Poll


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", text.lower().strip())
    slug = re.sub(r"[-\s]+", "-", cleaned)
    return slug or f"community-{uuid.uuid4().hex[:8]}"


class CommunityRepository:
    _fallback_communities: Dict[UUID, Community] = {}
    _fallback_members: Dict[Tuple[UUID, UUID], CommunityMember] = {}
    _fallback_posts: Dict[UUID, CommunityPost] = {}

    def __init__(self, db: Session):
        self.db = db
        self._has_table = self._check_tables_exist()

    def _check_tables_exist(self) -> bool:
        try:
            insp = inspect(self.db.bind)
            return "communities" in insp.get_table_names()
        except Exception:
            return False

    def create_community(
        self,
        owner_id: UUID,
        name: str,
        description: Optional[str] = None,
        category: str = "Fashion",
        rules: Optional[str] = None,
        cover_image_url: Optional[str] = None,
        visibility: str = "public",
    ) -> Community:
        slug = slugify(name)
        now = datetime.now(timezone.utc)
        comm_id = uuid.uuid4()

        owner = self.db.query(User).filter(User.id == owner_id).first()

        community = Community(
            id=comm_id,
            name=name.strip(),
            slug=slug,
            description=description,
            category=category,
            rules=rules,
            cover_image_url=cover_image_url,
            visibility=visibility,
            owner_user_id=owner_id,
            created_at=now,
            updated_at=now,
        )

        # Create owner membership
        member = CommunityMember(
            id=uuid.uuid4(),
            community_id=comm_id,
            user_id=owner_id,
            role="owner",
            status="active",
            joined_at=now,
        )
        community.members = [member]
        community.posts = []

        if self._has_table:
            try:
                self.db.add(community)
                self.db.flush()
                self.db.add(member)
                self.db.commit()
                self.db.refresh(community)
                return community
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_communities[comm_id] = community
        self._fallback_members[(comm_id, owner_id)] = member
        return community

    def get_community_by_id(self, community_id: UUID) -> Optional[Community]:
        if self._has_table:
            try:
                c = (
                    self.db.query(Community)
                    .options(joinedload(Community.owner), selectinload(Community.members))
                    .filter(Community.id == community_id)
                    .first()
                )
                if c:
                    return c
            except Exception:
                self._has_table = False

        return self._fallback_communities.get(community_id)

    def get_community_by_slug(self, slug: str) -> Optional[Community]:
        if self._has_table:
            try:
                c = (
                    self.db.query(Community)
                    .options(joinedload(Community.owner), selectinload(Community.members))
                    .filter(Community.slug == slug)
                    .first()
                )
                if c:
                    return c
            except Exception:
                self._has_table = False

        for c in self._fallback_communities.values():
            if c.slug == slug:
                return c
        return None

    def list_communities(
        self,
        category: Optional[str] = None,
        visibility: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Community]:
        if self._has_table:
            try:
                q = self.db.query(Community).options(joinedload(Community.owner), selectinload(Community.members))
                if category:
                    q = q.filter(Community.category.ilike(f"%{category}%"))
                if visibility:
                    q = q.filter(Community.visibility == visibility)
                return q.order_by(Community.created_at.desc()).offset(offset).limit(limit).all()
            except Exception:
                self._has_table = False

        results = list(self._fallback_communities.values())
        if category:
            results = [c for c in results if category.lower() in (c.category or "").lower()]
        if visibility:
            results = [c for c in results if c.visibility == visibility]
        results.sort(key=lambda x: x.created_at, reverse=True)
        return results[offset : offset + limit]

    def update_community(
        self,
        community_id: UUID,
        description: Optional[str] = None,
        category: Optional[str] = None,
        rules: Optional[str] = None,
        cover_image_url: Optional[str] = None,
        visibility: Optional[str] = None,
    ) -> Optional[Community]:
        c = self.get_community_by_id(community_id)
        if not c:
            return None

        if description is not None:
            c.description = description
        if category is not None:
            c.category = category
        if rules is not None:
            c.rules = rules
        if cover_image_url is not None:
            c.cover_image_url = cover_image_url
        if visibility is not None:
            c.visibility = visibility

        c.updated_at = datetime.now(timezone.utc)

        if self._has_table:
            try:
                self.db.commit()
                self.db.refresh(c)
                return c
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_communities[community_id] = c
        return c

    def get_membership(self, community_id: UUID, user_id: UUID) -> Optional[CommunityMember]:
        if self._has_table:
            try:
                m = (
                    self.db.query(CommunityMember)
                    .options(joinedload(CommunityMember.user))
                    .filter(
                        CommunityMember.community_id == community_id,
                        CommunityMember.user_id == user_id,
                    )
                    .first()
                )
                if m:
                    return m
            except Exception:
                self._has_table = False

        return self._fallback_members.get((community_id, user_id))

    def add_member(
        self,
        community_id: UUID,
        user_id: UUID,
        role: str = "member",
        status: str = "active",
    ) -> CommunityMember:
        existing = self.get_membership(community_id, user_id)
        if existing:
            existing.status = status
            existing.role = role
            if self._has_table:
                try:
                    self.db.commit()
                    self.db.refresh(existing)
                    return existing
                except Exception:
                    self.db.rollback()
            return existing

        user = self.db.query(User).filter(User.id == user_id).first()
        now = datetime.now(timezone.utc)
        member = CommunityMember(
            id=uuid.uuid4(),
            community_id=community_id,
            user_id=user_id,
            role=role,
            status=status,
            joined_at=now,
        )

        if self._has_table:
            try:
                self.db.add(member)
                self.db.commit()
                self.db.refresh(member)
                return member
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_members[(community_id, user_id)] = member
        return member

    def update_membership(
        self,
        community_id: UUID,
        user_id: UUID,
        role: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Optional[CommunityMember]:
        m = self.get_membership(community_id, user_id)
        if not m:
            return None
        if role:
            m.role = role
        if status:
            m.status = status

        if self._has_table:
            try:
                self.db.commit()
                self.db.refresh(m)
                return m
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_members[(community_id, user_id)] = m
        return m

    def remove_member(self, community_id: UUID, user_id: UUID) -> bool:
        m = self.get_membership(community_id, user_id)
        if not m:
            return False

        if self._has_table:
            try:
                self.db.delete(m)
                self.db.commit()
                return True
            except Exception:
                self.db.rollback()
                self._has_table = False

        if (community_id, user_id) in self._fallback_members:
            del self._fallback_members[(community_id, user_id)]
            return True
        return False

    def list_community_members(
        self,
        community_id: UUID,
        status: Optional[str] = "active",
        limit: int = 50,
        offset: int = 0,
    ) -> List[CommunityMember]:
        if self._has_table:
            try:
                q = (
                    self.db.query(CommunityMember)
                    .options(joinedload(CommunityMember.user))
                    .filter(CommunityMember.community_id == community_id)
                )
                if status:
                    q = q.filter(CommunityMember.status == status)
                return q.order_by(CommunityMember.joined_at.asc()).offset(offset).limit(limit).all()
            except Exception:
                self._has_table = False

        members = [
            m for (cid, _), m in self._fallback_members.items()
            if cid == community_id and (status is None or m.status == status)
        ]
        members.sort(key=lambda x: x.joined_at)
        return members[offset : offset + limit]

    def get_member_count(self, community_id: UUID, status: str = "active") -> int:
        if self._has_table:
            try:
                return (
                    self.db.query(CommunityMember)
                    .filter(
                        CommunityMember.community_id == community_id,
                        CommunityMember.status == status,
                    )
                    .count()
                )
            except Exception:
                self._has_table = False

        return len([
            m for (cid, _), m in self._fallback_members.items()
            if cid == community_id and m.status == status
        ])

    def list_user_communities(self, user_id: UUID) -> List[Community]:
        if self._has_table:
            try:
                memberships = (
                    self.db.query(CommunityMember)
                    .filter(
                        CommunityMember.user_id == user_id,
                        CommunityMember.status == "active",
                    )
                    .all()
                )
                comm_ids = [m.community_id for m in memberships]
                if not comm_ids:
                    return []
                return (
                    self.db.query(Community)
                    .options(joinedload(Community.owner), selectinload(Community.members))
                    .filter(Community.id.in_(comm_ids))
                    .all()
                )
            except Exception:
                self._has_table = False

        user_comm_ids = [
            cid for (cid, uid), m in self._fallback_members.items()
            if uid == user_id and m.status == "active"
        ]
        return [c for cid, c in self._fallback_communities.items() if cid in user_comm_ids]

    def create_community_post(
        self,
        community_id: UUID,
        shared_by_user_id: UUID,
        post_id: Optional[UUID] = None,
        poll_id: Optional[UUID] = None,
        title: Optional[str] = None,
        message: Optional[str] = None,
        is_pinned: bool = False,
    ) -> CommunityPost:
        now = datetime.now(timezone.utc)
        post_obj = CommunityPost(
            id=uuid.uuid4(),
            community_id=community_id,
            post_id=post_id,
            poll_id=poll_id,
            shared_by_user_id=shared_by_user_id,
            title=title,
            message=message,
            is_pinned=is_pinned,
            created_at=now,
        )

        if self._has_table:
            try:
                self.db.add(post_obj)
                self.db.commit()
                self.db.refresh(post_obj)
                return post_obj
            except Exception:
                self.db.rollback()
                self._has_table = False

        self._fallback_posts[post_obj.id] = post_obj
        return post_obj

    def get_community_post_by_id(self, post_id: UUID) -> Optional[CommunityPost]:
        if self._has_table:
            try:
                return (
                    self.db.query(CommunityPost)
                    .options(
                        joinedload(CommunityPost.shared_by),
                        joinedload(CommunityPost.post),
                        joinedload(CommunityPost.poll),
                    )
                    .filter(CommunityPost.id == post_id)
                    .first()
                )
            except Exception:
                self._has_table = False

        return self._fallback_posts.get(post_id)

    def list_community_posts(
        self,
        community_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> List[CommunityPost]:
        if self._has_table:
            try:
                return (
                    self.db.query(CommunityPost)
                    .options(
                        joinedload(CommunityPost.shared_by),
                        joinedload(CommunityPost.post),
                        joinedload(CommunityPost.poll),
                    )
                    .filter(CommunityPost.community_id == community_id)
                    .order_by(CommunityPost.is_pinned.desc(), CommunityPost.created_at.desc())
                    .offset(offset)
                    .limit(limit)
                    .all()
                )
            except Exception:
                self._has_table = False

        posts = [p for p in self._fallback_posts.values() if p.community_id == community_id]
        posts.sort(key=lambda x: (not x.is_pinned, -x.created_at.timestamp()))
        return posts[offset : offset + limit]

    def delete_community_post(self, post_id: UUID) -> bool:
        p = self.get_community_post_by_id(post_id)
        if not p:
            return False

        if self._has_table:
            try:
                self.db.delete(p)
                self.db.commit()
                return True
            except Exception:
                self.db.rollback()
                self._has_table = False

        if post_id in self._fallback_posts:
            del self._fallback_posts[post_id]
            return True
        return False
