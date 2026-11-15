"""complete database indexing and query optimization

Revision ID: q6g4370j1h9d
Revises: p5f3269i0g8c
Create Date: 2026-11-15

Production-safe indexing and query performance optimization for TailorBird PostgreSQL (Neon).
Covers:
- Unindexed Foreign Keys (comments.post_id, follows.following_id, likes.post_id, notifications.user_id, etc.)
- User-Scoped Composite Indexes with Sorting (posts, clothing, recommendations, wear_history, notifications)
- Partial Indexes for high-frequency filters (notifications unread)
- Functional Indexes for case-insensitive authentication and lookups (users lower email/username)
- Deduplication of redundant index on learned_preferences
"""
from typing import Sequence, Union
import logging
from alembic import op, context
import sqlalchemy as sa
from sqlalchemy import text

logger = logging.getLogger("tailorbird.migration.indexing")

# revision identifiers, used by Alembic.
revision: str = 'q6g4370j1h9d'
down_revision: Union[str, None] = 'p5f3269i0g8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# List of target indexes to create:
# (index_name, table_name, columns, unique, where_clause, raw_sql_for_expressions)
TARGET_INDEXES = [
    # 1. Posts & Moments
    ("idx_posts_user_created", "posts", ["user_id", text("created_at DESC")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts (user_id, created_at DESC)"),
    ("idx_posts_created_at", "posts", [text("created_at DESC")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC)"),

    # 2. Follows
    ("idx_follows_following_id", "follows", ["following_id", "follower_id"], False, None,
     "CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id, follower_id)"),

    # 3. Comments
    ("idx_comments_post_created", "comments", ["post_id", text("created_at ASC")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments (post_id, created_at ASC)"),
    ("idx_comments_user_id", "comments", ["user_id"], False, None,
     "CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments (user_id)"),

    # 4. Likes
    ("idx_likes_post_id", "likes", ["post_id"], False, None,
     "CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes (post_id)"),

    # 5. Notifications
    ("idx_notifications_user_created", "notifications", ["user_id", text("created_at DESC")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC)"),
    ("idx_notifications_user_unread", "notifications", ["user_id"], False, "is_read = false",
     "CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = false"),

    # 6. Collections
    ("idx_collections_user_created", "collections", ["user_id", text("created_at DESC")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_collections_user_created ON public.collections (user_id, created_at DESC)"),

    # 7. Saved
    ("idx_saved_post_id", "saved", ["post_id"], False, None,
     "CREATE INDEX IF NOT EXISTS idx_saved_post_id ON public.saved (post_id)"),

    # 8. Outfit Clothing
    ("idx_outfit_clothing_clothing_id", "outfit_clothing", ["clothing_id", "outfit_id"], False, None,
     "CREATE INDEX IF NOT EXISTS idx_outfit_clothing_clothing_id ON public.outfit_clothing (clothing_id, outfit_id)"),

    # 9. Clothing & Wardrobe
    ("idx_clothing_user_created", "clothing", ["user_id", text("created_at DESC")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_clothing_user_created ON public.clothing (user_id, created_at DESC)"),
    ("idx_clothing_user_category", "clothing", ["user_id", "category"], False, None,
     "CREATE INDEX IF NOT EXISTS idx_clothing_user_category ON public.clothing (user_id, category)"),

    # 10. Recommendations & Outfits
    ("idx_recommendations_user_occasion_created", "recommendations", ["user_id", "occasion", text("created_at DESC")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_recommendations_user_occasion_created ON public.recommendations (user_id, occasion, created_at DESC)"),
    ("idx_recommendations_outfit_id", "recommendations", ["outfit_id"], False, None,
     "CREATE INDEX IF NOT EXISTS idx_recommendations_outfit_id ON public.recommendations (outfit_id)"),

    # 11. Wear History
    ("idx_wear_history_user_worn", "wear_history", ["user_id", text("worn_at DESC")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_wear_history_user_worn ON public.wear_history (user_id, worn_at DESC)"),

    # 12. Users (Functional / Case-Insensitive)
    ("idx_users_lower_email", "users", [text("lower(email)")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_users_lower_email ON public.users (lower(email))"),
    ("idx_users_lower_username", "users", [text("lower(username)")], False, None,
     "CREATE INDEX IF NOT EXISTS idx_users_lower_username ON public.users (lower(username))"),
]


def upgrade() -> None:
    # In offline mode, output pure static SQL statements
    if context.is_offline_mode():
        for item in TARGET_INDEXES:
            op.execute(item[5])
        op.execute("DROP INDEX IF EXISTS public.idx_learned_preferences_user")
        return

    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = set(insp.get_table_names())

    privilege_restricted = False
    sql_instructions = []

    for idx_name, tbl_name, cols, is_unique, where_clause, raw_sql in TARGET_INDEXES:
        if tbl_name not in existing_tables:
            continue

        existing_indexes = {i["name"] for i in insp.get_indexes(tbl_name)}
        if idx_name in existing_indexes:
            continue

        try:
            op.execute(raw_sql)
            logger.info(f"Successfully created index {idx_name} on {tbl_name}.")
        except Exception as exc:
            err_str = str(exc)
            if "must be owner of table" in err_str or "permission denied" in err_str:
                privilege_restricted = True
                sql_instructions.append(raw_sql)
                logger.warning(
                    f"Notice: Table ownership required to create index {idx_name} on {tbl_name}. "
                    "Skipping DDL under current role."
                )
            else:
                logger.warning(f"Notice creating index {idx_name}: {err_str.splitlines()[0]}")

    # Remove redundant duplicate index on learned_preferences if present
    if "learned_preferences" in existing_tables:
        existing_indexes = {i["name"] for i in insp.get_indexes("learned_preferences")}
        if "idx_learned_preferences_user" in existing_indexes and "learned_preferences_user_id_key" in existing_indexes:
            try:
                op.execute("DROP INDEX IF EXISTS public.idx_learned_preferences_user")
                logger.info("Successfully dropped redundant duplicate index idx_learned_preferences_user.")
            except Exception as exc:
                if "must be owner of table" in str(exc):
                    sql_instructions.append("DROP INDEX IF EXISTS public.idx_learned_preferences_user;")
                else:
                    logger.warning(f"Notice dropping idx_learned_preferences_user: {exc}")

    if privilege_restricted:
        logger.info(
            "=========================================================================\n"
            "TAILORBIRD POSTGRESQL PRODUCTION INDEXING NOTICE:\n"
            "The active application connection uses the restricted 'authenticator' role.\n"
            "To apply these recommended indexes to the live Neon cloud cluster,\n"
            "execute the following SQL via the Neon Console SQL Editor (run as neondb_owner):\n\n"
            + ";\n".join(sql_instructions) + ";\n"
            "========================================================================="
        )


def downgrade() -> None:
    if context.is_offline_mode():
        for item in TARGET_INDEXES:
            op.execute(f"DROP INDEX IF EXISTS public.{item[0]}")
        return

    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = set(insp.get_table_names())

    for idx_name, tbl_name, _, _, _, _ in TARGET_INDEXES:
        if tbl_name not in existing_tables:
            continue
        try:
            op.execute(f"DROP INDEX IF EXISTS public.{idx_name}")
        except Exception as exc:
            logger.warning(f"Notice dropping index {idx_name}: {exc}")
