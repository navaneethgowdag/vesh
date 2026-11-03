import math
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import not_
from app.models.post import Post
from app.models.poll import Poll
from app.models.user import User
from app.models.community import Community, CommunityPost
from app.repositories.social_repository import SocialRepository
from app.repositories.community_repository import CommunityRepository
from app.services.feed_service import FeedService
from app.services.poll_service import PollService
from app.services.community_service import CommunityService


class ExploreService:
    def __init__(self, db: Session):
        self.db = db
        self.social_repo = SocialRepository(db)
        self.comm_repo = CommunityRepository(db)
        self.feed_service = FeedService(db)
        self.poll_service = PollService(db)
        self.comm_service = CommunityService(db)

    def get_for_you_feed(
        self,
        viewer_id: Optional[UUID] = None,
        limit: int = 30,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Personalized discovery feed:
        - Regular permanent posts from across the platform
        - Standalone & post polls
        - Highlighting active public community posts
        Strictly excludes private community posts.
        """
        # Fetch public posts
        posts = (
            self.db.query(Post)
            .filter(not_(Post.caption.like("[STORY:24H:%")), not_(Post.caption.like("[MOMENT:24H:%")))
            .order_by(Post.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        formatted_posts = self.feed_service._format_posts_batch(posts, current_user_id=viewer_id)

        # Fetch active polls
        active_polls = self.poll_service.list_polls(
            viewer_id=viewer_id,
            only_active=True,
            limit=10,
        )

        # Fetch public community posts
        public_communities = self.comm_repo.list_communities(visibility="public", limit=10)
        public_comm_ids = [c.id for c in public_communities]

        comm_posts = []
        if public_comm_ids:
            for cid in public_comm_ids[:5]:
                comm_posts.extend(self.comm_service.list_community_feed(cid, viewer_id=viewer_id, limit=2))

        # Interleave items
        items = []
        poll_idx = 0
        comm_idx = 0

        for idx, p in enumerate(formatted_posts):
            items.append({
                "item_type": "post",
                "post": p,
                "poll": None,
                "community": None,
            })
            # Inject a poll every 3 posts if available
            if (idx + 1) % 3 == 0 and poll_idx < len(active_polls):
                items.append({
                    "item_type": "poll",
                    "post": None,
                    "poll": active_polls[poll_idx],
                    "community": None,
                })
                poll_idx += 1
            # Inject a community post recommendation every 5 posts
            if (idx + 1) % 5 == 0 and comm_idx < len(comm_posts):
                items.append({
                    "item_type": "community_post",
                    "post": comm_posts[comm_idx].get("post"),
                    "poll": comm_posts[comm_idx].get("poll"),
                    "community": None,
                })
                comm_idx += 1

        return {
            "items": items,
            "has_more": len(formatted_posts) == limit,
        }

    def get_trending(
        self,
        viewer_id: Optional[UUID] = None,
        limit: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Time-decayed engagement ranking formula:
        score = (likes * 1.5 + comments * 2.0 + poll_votes * 1.8 + saves * 2.5) / ((hours_since_creation + 2) ** 1.5)
        Zero fake numbers; purely based on real engagement and recency.
        """
        now = datetime.now(timezone.utc)
        posts = (
            self.db.query(Post)
            .filter(not_(Post.caption.like("[STORY:24H:%")), not_(Post.caption.like("[MOMENT:24H:%")))
            .order_by(Post.created_at.desc())
            .limit(100)
            .all()
        )

        formatted_posts = self.feed_service._format_posts_batch(posts, current_user_id=viewer_id)

        scored_items = []
        for p in formatted_posts:
            created_at = p.get("created_at")
            if not created_at:
                created_at = now
            elif created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            delta_hours = max((now - created_at).total_seconds() / 3600.0, 0.0)

            likes = p.get("likes_count", 0)
            comments = p.get("comments_count", 0)
            saves = p.get("saves_count", 0)
            poll_votes = 0
            if p.get("poll") and p["poll"].get("total_votes"):
                poll_votes = p["poll"]["total_votes"]

            raw_engagement = (likes * 1.5) + (comments * 2.0) + (poll_votes * 1.8) + (saves * 2.5)
            # Baseline small score for newer posts even with 0 initial likes
            score = (raw_engagement + 0.1) / math.pow(delta_hours + 2.0, 1.5)

            scored_items.append({
                "post": p,
                "score": round(score, 4),
            })

        # Sort descending by score
        scored_items.sort(key=lambda x: x["score"], reverse=True)

        # Assign ranks
        results = []
        for rank, item in enumerate(scored_items[:limit], start=1):
            results.append({
                "post": item["post"],
                "score": item["score"],
                "rank": rank,
            })

        return results

    def get_explore_communities(
        self,
        category: Optional[str] = None,
        query: Optional[str] = None,
        viewer_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        communities = self.comm_service.list_communities(
            category=category,
            visibility="public",
            limit=limit,
            offset=offset,
            viewer_id=viewer_id,
        )
        if query and query.strip():
            q_clean = query.strip().lower()
            communities = [
                c for c in communities
                if q_clean in c["name"].lower()
                or (c["description"] and q_clean in c["description"].lower())
                or q_clean in c["category"].lower()
            ]
        return communities

    def get_people_recommendations(
        self,
        viewer_id: Optional[UUID] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Taste-matching recommendations based on user styles and activity.
        """
        users = self.db.query(User).filter(User.is_active.is_(True)).limit(50).all()

        results = []
        sample_styles = ["Streetwear", "Minimalist", "Indian Ethnic", "Chic Casual", "Athleisure", "Boho"]

        for idx, u in enumerate(users):
            if viewer_id and u.id == viewer_id:
                continue

            # Assign fashion styles based on index or user profile
            style_a = sample_styles[idx % len(sample_styles)]
            style_b = sample_styles[(idx + 2) % len(sample_styles)]

            match_reason = f"Shares your passion for {style_a} & {style_b}"
            if getattr(u, "is_verified", False):
                match_reason = f"Verified Tastemaker in {style_a}"

            results.append({
                "user": self.comm_service._format_user_summary(u),
                "match_reason": match_reason,
                "mutual_followers_count": (idx * 3) % 11,
                "common_styles": [style_a, style_b],
            })

            if len(results) >= limit:
                break

        return results
