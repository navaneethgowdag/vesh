"""create weekly_plans and weekly_plan_days tables

Revision ID: m2c0936f7e5f
Revises: l1b9825f6d4e
Create Date: 2026-11-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'm2c0936f7e5f'
down_revision: Union[str, None] = 'l1b9825f6d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'weekly_plans' not in tables:
        op.create_table(
            'weekly_plans',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('week_start_date', sa.Date(), nullable=False),
            sa.Column('week_end_date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='active'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_weekly_plans_user_id', 'weekly_plans', ['user_id'])
        op.create_index('ix_weekly_plans_week_start_date', 'weekly_plans', ['week_start_date'])

    if 'weekly_plan_days' not in tables:
        op.create_table(
            'weekly_plan_days',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('weekly_plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('weekly_plans.id', ondelete='CASCADE'), nullable=False),
            sa.Column('plan_date', sa.Date(), nullable=False),
            sa.Column('outfit_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('outfits.id', ondelete='SET NULL'), nullable=True),
            sa.Column('calendar_event_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='planned'),
            sa.Column('recommendation_explanation', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_weekly_plan_days_weekly_plan_id', 'weekly_plan_days', ['weekly_plan_id'])
        op.create_index('ix_weekly_plan_days_plan_date', 'weekly_plan_days', ['plan_date'])
        op.create_index('ix_weekly_plan_days_outfit_id', 'weekly_plan_days', ['outfit_id'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'weekly_plan_days' in tables:
        op.drop_table('weekly_plan_days')
    if 'weekly_plans' in tables:
        op.drop_table('weekly_plans')
