"""create google_calendar_connections and extend calendar_events

Revision ID: i8e6592d3f1a
Revises: h7d5481c2e5f
Create Date: 2026-11-02

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = 'i8e6592d3f1a'
down_revision: Union[str, None] = 'h7d5481c2e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 1. Create google_calendar_connections if absent
    if 'google_calendar_connections' not in tables:
        op.create_table(
            'google_calendar_connections',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
            sa.Column('encrypted_refresh_token', sa.Text(), nullable=True),
            sa.Column('google_email', sa.String(length=255), nullable=True),
            sa.Column('selected_calendars', JSONB(), nullable=False, server_default='["primary"]'),
            sa.Column('sync_tokens', JSONB(), nullable=False, server_default='{}'),
            sa.Column('last_sync_time', sa.DateTime(timezone=True), nullable=True),
            sa.Column('sync_status', sa.String(length=50), nullable=False, server_default='idle'),
            sa.Column('last_sync_error', sa.Text(), nullable=True),
            sa.Column('is_connected', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_google_cal_conn_user', 'google_calendar_connections', ['user_id'])

    # 2. Check and extend calendar_events table
    if 'calendar_events' in tables:
        cols = [c['name'] for c in insp.get_columns('calendar_events')]
        if 'title' not in cols:
            op.add_column('calendar_events', sa.Column('title', sa.String(length=255), nullable=True))
        if 'description' not in cols:
            op.add_column('calendar_events', sa.Column('description', sa.Text(), nullable=True))
        if 'location' not in cols:
            op.add_column('calendar_events', sa.Column('location', sa.String(length=255), nullable=True))
        if 'timezone' not in cols:
            op.add_column('calendar_events', sa.Column('timezone', sa.String(length=100), nullable=True))
        if 'is_all_day' not in cols:
            op.add_column('calendar_events', sa.Column('is_all_day', sa.Boolean(), server_default='false', nullable=False))
        if 'google_calendar_id' not in cols:
            op.add_column('calendar_events', sa.Column('google_calendar_id', sa.String(length=255), nullable=True))
            op.create_index('ix_calendar_events_gcal_id', 'calendar_events', ['google_calendar_id'])
        if 'google_event_id' not in cols:
            op.add_column('calendar_events', sa.Column('google_event_id', sa.String(length=255), nullable=True))
            op.create_index('ix_calendar_events_gevent_id', 'calendar_events', ['google_event_id'])
        if 'event_source' not in cols:
            op.add_column('calendar_events', sa.Column('event_source', sa.String(length=50), server_default='tailorbird', nullable=False))
            op.create_index('ix_calendar_events_source', 'calendar_events', ['event_source'])
        if 'last_synced_at' not in cols:
            op.add_column('calendar_events', sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True))
        if 'recurrence_rule' not in cols:
            op.add_column('calendar_events', sa.Column('recurrence_rule', sa.String(length=255), nullable=True))
        if 'inferred_occasion' not in cols:
            op.add_column('calendar_events', sa.Column('inferred_occasion', sa.String(length=100), nullable=True))
        if 'inferred_formality' not in cols:
            op.add_column('calendar_events', sa.Column('inferred_formality', sa.Float(), nullable=True))
        if 'inferred_dress_code' not in cols:
            op.add_column('calendar_events', sa.Column('inferred_dress_code', sa.String(length=100), nullable=True))
        if 'inferred_context' not in cols:
            op.add_column('calendar_events', sa.Column('inferred_context', JSONB(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'google_calendar_connections' in tables:
        op.drop_index('ix_google_cal_conn_user', table_name='google_calendar_connections')
        op.drop_table('google_calendar_connections')
