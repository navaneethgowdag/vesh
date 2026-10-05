"""initial schema full StyleSphere model set

Revision ID: b401f52afba2
Revises:
Create Date: 2026-10-04

Baseline migration representing the established Neon PostgreSQL schema for StyleSphere:
Tables: users, user_preferences, learned_preferences, clothing, clothing_analysis,
outfits, outfit_clothing, posts, comments, likes, follows, saved, collections,
recommendations, recommendation_feedback, wear_history, notifications.
"""
from typing import Sequence, Union
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b401f52afba2'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline schema is already present and active in Neon PostgreSQL.
    pass


def downgrade() -> None:
    # Baseline downgrade is a no-op to preserve persistent data.
    pass
