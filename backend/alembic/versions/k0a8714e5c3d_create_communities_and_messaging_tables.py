"""create communities and messaging tables

Revision ID: k0a8714e5c3d
Revises: j9f7603e4b2c
Create Date: 2026-11-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'k0a8714e5c3d'
down_revision: Union[str, None] = 'j9f7603e4b2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 1. Create communities
    if 'communities' not in tables:
        op.create_table(
            'communities',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('name', sa.String(length=100), nullable=False, unique=True),
            sa.Column('slug', sa.String(length=120), nullable=False, unique=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('cover_image_url', sa.Text(), nullable=True),
            sa.Column('category', sa.String(length=50), nullable=False, server_default='Fashion'),
            sa.Column('rules', sa.Text(), nullable=True),
            sa.Column('visibility', sa.String(length=20), nullable=False, server_default='public'),
            sa.Column('owner_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_communities_name', 'communities', ['name'])
        op.create_index('ix_communities_slug', 'communities', ['slug'])
        op.create_index('ix_communities_owner_user_id', 'communities', ['owner_user_id'])

    # 2. Create community_members
    if 'community_members' not in tables:
        op.create_table(
            'community_members',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('community_id', UUID(as_uuid=True), sa.ForeignKey('communities.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('role', sa.String(length=20), nullable=False, server_default='member'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
            sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.UniqueConstraint('community_id', 'user_id', name='uq_community_member'),
        )
        op.create_index('ix_community_members_community_id', 'community_members', ['community_id'])
        op.create_index('ix_community_members_user_id', 'community_members', ['user_id'])

    # 3. Create community_posts
    if 'community_posts' not in tables:
        op.create_table(
            'community_posts',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('community_id', UUID(as_uuid=True), sa.ForeignKey('communities.id', ondelete='CASCADE'), nullable=False),
            sa.Column('post_id', UUID(as_uuid=True), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=True),
            sa.Column('poll_id', UUID(as_uuid=True), sa.ForeignKey('polls.id', ondelete='CASCADE'), nullable=True),
            sa.Column('shared_by_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=True),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_community_posts_community_id', 'community_posts', ['community_id'])
        op.create_index('ix_community_posts_post_id', 'community_posts', ['post_id'])
        op.create_index('ix_community_posts_poll_id', 'community_posts', ['poll_id'])
        op.create_index('ix_community_posts_shared_by_user_id', 'community_posts', ['shared_by_user_id'])

    # 4. Create conversations
    if 'conversations' not in tables:
        op.create_table(
            'conversations',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('conversation_type', sa.String(length=20), nullable=False, server_default='direct'),
            sa.Column('title', sa.String(length=100), nullable=True),
            sa.Column('image_url', sa.Text(), nullable=True),
            sa.Column('created_by_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_conversations_created_by_user_id', 'conversations', ['created_by_user_id'])

    # 5. Create conversation_participants
    if 'conversation_participants' not in tables:
        op.create_table(
            'conversation_participants',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('conversation_id', UUID(as_uuid=True), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('role', sa.String(length=20), nullable=False, server_default='member'),
            sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('is_muted', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'),
            sa.UniqueConstraint('conversation_id', 'user_id', name='uq_conversation_participant'),
        )
        op.create_index('ix_conversation_participants_conversation_id', 'conversation_participants', ['conversation_id'])
        op.create_index('ix_conversation_participants_user_id', 'conversation_participants', ['user_id'])

    # 6. Create messages
    if 'messages' not in tables:
        op.create_table(
            'messages',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('conversation_id', UUID(as_uuid=True), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('sender_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('message_type', sa.String(length=30), nullable=False, server_default='text'),
            sa.Column('text_content', sa.Text(), nullable=True),
            sa.Column('shared_content_type', sa.String(length=30), nullable=True),
            sa.Column('shared_content_id', UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_messages_conversation_id', 'messages', ['conversation_id'])
        op.create_index('ix_messages_sender_user_id', 'messages', ['sender_user_id'])
        op.create_index('ix_messages_shared_content_id', 'messages', ['shared_content_id'])

    # 7. Create user_blocks
    if 'user_blocks' not in tables:
        op.create_table(
            'user_blocks',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('blocker_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('blocked_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.UniqueConstraint('blocker_user_id', 'blocked_user_id', name='uq_user_block'),
        )
        op.create_index('ix_user_blocks_blocker_user_id', 'user_blocks', ['blocker_user_id'])
        op.create_index('ix_user_blocks_blocked_user_id', 'user_blocks', ['blocked_user_id'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'user_blocks' in tables:
        op.drop_table('user_blocks')
    if 'messages' in tables:
        op.drop_table('messages')
    if 'conversation_participants' in tables:
        op.drop_table('conversation_participants')
    if 'conversations' in tables:
        op.drop_table('conversations')
    if 'community_posts' in tables:
        op.drop_table('community_posts')
    if 'community_members' in tables:
        op.drop_table('community_members')
    if 'communities' in tables:
        op.drop_table('communities')
