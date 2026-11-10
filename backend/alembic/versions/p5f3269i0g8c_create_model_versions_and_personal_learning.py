"""create model_versions table and exclude_from_training column

Revision ID: p5f3269i0g8c
Revises: o4e2158h9f7b
Create Date: 2026-11-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'p5f3269i0g8c'
down_revision: Union[str, None] = 'o4e2158h9f7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 1. Create model_versions table if not exists
    if 'model_versions' not in tables:
        op.create_table(
            'model_versions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('version_tag', sa.String(length=50), nullable=False),
            sa.Column('model_name', sa.String(length=100), nullable=False, server_default='efficientnet_b0_multitask'),
            sa.Column('base_version', sa.String(length=50), nullable=True),
            sa.Column('status', sa.String(length=30), nullable=False, server_default='candidate'),
            sa.Column('checkpoint_path', sa.String(length=512), nullable=False),
            sa.Column('architecture_info', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
            sa.Column('class_mapping_version', sa.String(length=50), nullable=False, server_default='1.0.0'),
            sa.Column('preprocessing_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
            sa.Column('dataset_manifest_path', sa.String(length=512), nullable=True),
            sa.Column('training_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
            sa.Column('evaluation_metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
            sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('promoted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
        )
        op.create_index('ix_model_versions_version_tag', 'model_versions', ['version_tag'], unique=True)
        op.create_index('ix_model_versions_status', 'model_versions', ['status'])

    # 2. Add exclude_from_training column to clothing table if present
    if 'clothing' in tables:
        clothing_cols = [c['name'] for c in insp.get_columns('clothing')]
        if 'exclude_from_training' not in clothing_cols:
            op.add_column('clothing', sa.Column('exclude_from_training', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'clothing' in tables:
        clothing_cols = [c['name'] for c in insp.get_columns('clothing')]
        if 'exclude_from_training' in clothing_cols:
            op.drop_column('clothing', 'exclude_from_training')

    if 'model_versions' in tables:
        op.drop_table('model_versions')
