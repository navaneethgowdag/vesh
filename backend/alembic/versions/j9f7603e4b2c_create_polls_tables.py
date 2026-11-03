"""create polls, poll_options, and poll_votes tables

Revision ID: j9f7603e4b2c
Revises: i8e6592d3f1a
Create Date: 2026-11-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'j9f7603e4b2c'
down_revision: Union[str, None] = 'i8e6592d3f1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 1. Create polls table
    if 'polls' not in tables:
        op.create_table(
            'polls',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('creator_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('question', sa.Text(), nullable=False),
            sa.Column('content_type', sa.String(length=20), nullable=False, server_default='standalone'),
            sa.Column('post_id', UUID(as_uuid=True), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('allow_vote_change', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('show_results_before_vote', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('allow_creator_vote', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_polls_creator_user_id', 'polls', ['creator_user_id'])
        op.create_index('ix_polls_post_id', 'polls', ['post_id'])
        op.create_index('ix_polls_expires_at', 'polls', ['expires_at'])

    # 2. Create poll_options table
    if 'poll_options' not in tables:
        op.create_table(
            'poll_options',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('poll_id', UUID(as_uuid=True), sa.ForeignKey('polls.id', ondelete='CASCADE'), nullable=False),
            sa.Column('option_text', sa.String(length=255), nullable=False),
            sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        )
        op.create_index('ix_poll_options_poll_id', 'poll_options', ['poll_id'])

    # 3. Create poll_votes table
    if 'poll_votes' not in tables:
        op.create_table(
            'poll_votes',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('poll_id', UUID(as_uuid=True), sa.ForeignKey('polls.id', ondelete='CASCADE'), nullable=False),
            sa.Column('option_id', UUID(as_uuid=True), sa.ForeignKey('poll_options.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.UniqueConstraint('poll_id', 'user_id', name='uq_poll_user_vote'),
        )
        op.create_index('ix_poll_votes_poll_id', 'poll_votes', ['poll_id'])
        op.create_index('ix_poll_votes_option_id', 'poll_votes', ['option_id'])
        op.create_index('ix_poll_votes_user_id', 'poll_votes', ['user_id'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'poll_votes' in tables:
        op.drop_table('poll_votes')
    if 'poll_options' in tables:
        op.drop_table('poll_options')
    if 'polls' in tables:
        op.drop_table('polls')
