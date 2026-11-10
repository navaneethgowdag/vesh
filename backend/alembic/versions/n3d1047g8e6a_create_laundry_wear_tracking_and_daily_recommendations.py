"""create laundry, wear tracking and daily recommendations tables

Revision ID: n3d1047g8e6a
Revises: m2c0936f7e5f
Create Date: 2026-11-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'n3d1047g8e6a'
down_revision: Union[str, None] = 'm2c0936f7e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 1. Additive columns on clothing
    if 'clothing' in tables:
        clothing_cols = [c['name'] for c in insp.get_columns('clothing')]
        
        if 'wear_count_since_wash' not in clothing_cols:
            op.add_column('clothing', sa.Column('wear_count_since_wash', sa.Integer(), nullable=False, server_default='0'))
        if 'last_worn_on' not in clothing_cols:
            op.add_column('clothing', sa.Column('last_worn_on', sa.Date(), nullable=True))
        if 'laundry_status' not in clothing_cols:
            op.add_column('clothing', sa.Column('laundry_status', sa.String(length=50), nullable=False, server_default='clean'))
        if 'laundry_started_on' not in clothing_cols:
            op.add_column('clothing', sa.Column('laundry_started_on', sa.Date(), nullable=True))
        if 'available_from' not in clothing_cols:
            op.add_column('clothing', sa.Column('available_from', sa.Date(), nullable=True))
        if 'max_wears_override' not in clothing_cols:
            op.add_column('clothing', sa.Column('max_wears_override', sa.Integer(), nullable=True))
        if 'wash_days_override' not in clothing_cols:
            op.add_column('clothing', sa.Column('wash_days_override', sa.Integer(), nullable=True))
        if 'track_laundry' not in clothing_cols:
            op.add_column('clothing', sa.Column('track_laundry', sa.Boolean(), nullable=False, server_default='true'))
            
            # Backfill non-launderable categories to track_laundry = false
            non_launderable = ("'footwear'", "'shoes'", "'bag'", "'bags'", "'belt'", "'belts'", "'watch'", "'watches'", "'jewellery'", "'jewelry'", "'accessories'", "'sunglasses'", "'glasses'")
            conn.execute(sa.text(f"UPDATE clothing SET track_laundry = FALSE WHERE LOWER(category) IN ({','.join(non_launderable)})"))

    # 2. Table: wear_log
    if 'wear_log' not in tables:
        op.create_table(
            'wear_log',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clothing.id', ondelete='CASCADE'), nullable=False),
            sa.Column('outfit_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('outfits.id', ondelete='SET NULL'), nullable=True),
            sa.Column('worn_on', sa.Date(), nullable=False),
            sa.Column('source', sa.String(length=50), nullable=False, server_default='daily_fit'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('undone_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_wear_log_user_id', 'wear_log', ['user_id'])
        op.create_index('ix_wear_log_item_id', 'wear_log', ['item_id'])
        op.create_index('ix_wear_log_worn_on', 'wear_log', ['worn_on'])
        op.create_index('ix_wear_log_user_item_date', 'wear_log', ['user_id', 'item_id', 'worn_on'])

    # 3. Table: user_laundry_settings
    if 'user_laundry_settings' not in tables:
        op.create_table(
            'user_laundry_settings',
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('default_max_wears', sa.Integer(), nullable=False, server_default='2'),
            sa.Column('default_wash_days', sa.Integer(), nullable=False, server_default='4'),
            sa.Column('category_overrides', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
            sa.Column('same_item_cooldown_days', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('auto_return_from_laundry', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    # 4. Table: daily_recommendations
    if 'daily_recommendations' not in tables:
        op.create_table(
            'daily_recommendations',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('occasion', sa.String(length=100), nullable=False),
            sa.Column('context_hash', sa.String(length=64), nullable=True),
            sa.Column('item_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
            sa.Column('outfit_hash', sa.String(length=64), nullable=True),
            sa.Column('regenerate_counter', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='active'),
            sa.Column('empty_reason', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('recommendation_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_unique_constraint('uq_daily_rec_user_date_occ', 'daily_recommendations', ['user_id', 'date', 'occasion'])
        op.create_index('ix_daily_rec_user_date', 'daily_recommendations', ['user_id', 'date'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'daily_recommendations' in tables:
        op.drop_table('daily_recommendations')
    if 'user_laundry_settings' in tables:
        op.drop_table('user_laundry_settings')
    if 'wear_log' in tables:
        op.drop_table('wear_log')

    if 'clothing' in tables:
        clothing_cols = [c['name'] for c in insp.get_columns('clothing')]
        cols_to_drop = [
            'wear_count_since_wash',
            'last_worn_on',
            'laundry_status',
            'laundry_started_on',
            'available_from',
            'max_wears_override',
            'wash_days_override',
            'track_laundry',
        ]
        for col in cols_to_drop:
            if col in clothing_cols:
                op.drop_column('clothing', col)
