"""create background_jobs table

Revision ID: d2b1049e7a1f
Revises: c1a012d94b8e
Create Date: 2026-10-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = 'd2b1049e7a1f'
down_revision: Union[str, None] = 'c1a012d94b8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'background_jobs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('job_type', sa.String(length=50), server_default='clothing_analysis', nullable=False),
        sa.Column('status', sa.String(length=30), server_default='queued', nullable=False),
        sa.Column('payload_ref', JSONB, server_default='{}', nullable=False),
        sa.Column('result', JSONB, nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_background_jobs_user_id', 'background_jobs', ['user_id'])
    op.create_index('ix_background_jobs_status', 'background_jobs', ['status'])


def downgrade() -> None:
    op.drop_index('ix_background_jobs_status', table_name='background_jobs')
    op.drop_index('ix_background_jobs_user_id', table_name='background_jobs')
    op.drop_table('background_jobs')

