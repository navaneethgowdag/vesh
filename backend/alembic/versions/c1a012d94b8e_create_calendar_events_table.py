"""create calendar_events table

Revision ID: c1a012d94b8e
Revises: b401f52afba2
Create Date: 2026-10-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'c1a012d94b8e'
down_revision: Union[str, None] = 'b401f52afba2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'calendar_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='scheduled', nullable=False),
        sa.Column('event_type', sa.String(length=50), server_default='planned_outfit', nullable=False),
        sa.Column('outfit_id', UUID(as_uuid=True), sa.ForeignKey('outfits.id', ondelete='SET NULL'), nullable=True),
        sa.Column('recommendation_id', UUID(as_uuid=True), sa.ForeignKey('recommendations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('occasion', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_calendar_events_user_id', 'calendar_events', ['user_id'])
    op.create_index('ix_calendar_events_event_date', 'calendar_events', ['event_date'])
    op.create_index('ix_calendar_user_date', 'calendar_events', ['user_id', 'event_date'])


def downgrade() -> None:
    op.drop_index('ix_calendar_user_date', table_name='calendar_events')
    op.drop_index('ix_calendar_events_event_date', table_name='calendar_events')
    op.drop_index('ix_calendar_events_user_id', table_name='calendar_events')
    op.drop_table('calendar_events')
