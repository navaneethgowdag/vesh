"""create upload_batches table

Revision ID: g6c4370b1d4e
Revises: f5b3269a0c3d
Create Date: 2026-11-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = 'g6c4370b1d4e'
down_revision: Union[str, None] = 'f5b3269a0c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'upload_batches' not in tables:
        op.create_table(
            'upload_batches',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('status', sa.String(length=30), nullable=False, server_default='queued'),
            sa.Column('total_items', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('completed_items', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('failed_items', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('batch_metadata', JSONB(), nullable=False, server_default='{}'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_upload_batches_user_id', 'upload_batches', ['user_id'])
        op.create_index('ix_upload_batches_status', 'upload_batches', ['status'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'upload_batches' in tables:
        op.drop_index('ix_upload_batches_status', table_name='upload_batches')
        op.drop_index('ix_upload_batches_user_id', table_name='upload_batches')
        op.drop_table('upload_batches')
