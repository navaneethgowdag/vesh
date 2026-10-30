"""create clothing_predictions and clothing_corrections tables

Revision ID: f5b3269a0c3d
Revises: e4a2158f9b2c
Create Date: 2026-10-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = 'f5b3269a0c3d'
down_revision: Union[str, None] = 'e4a2158f9b2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'clothing_predictions' not in tables:
        op.create_table(
            'clothing_predictions',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('clothing_id', UUID(as_uuid=True), sa.ForeignKey('clothing.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('model_name', sa.String(length=100), server_default='clip_vit_b32_quantized', nullable=False),
            sa.Column('model_version', sa.String(length=50), server_default='1.0.0', nullable=False),
            sa.Column('input_image_source', sa.String(length=50), server_default='processed', nullable=False),
            sa.Column('predicted_category', sa.String(length=100), nullable=False),
            sa.Column('category_group', sa.String(length=50), nullable=True),
            sa.Column('predicted_attributes', JSONB, server_default='{}', nullable=False),
            sa.Column('prediction_scores', JSONB, server_default='{}', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_clothing_predictions_clothing_id', 'clothing_predictions', ['clothing_id'])
        op.create_index('ix_clothing_predictions_user_id', 'clothing_predictions', ['user_id'])

    if 'clothing_corrections' not in tables:
        op.create_table(
            'clothing_corrections',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('clothing_id', UUID(as_uuid=True), sa.ForeignKey('clothing.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('attribute_name', sa.String(length=100), nullable=False),
            sa.Column('predicted_value', sa.Text(), nullable=True),
            sa.Column('corrected_value', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_clothing_corrections_clothing_id', 'clothing_corrections', ['clothing_id'])
        op.create_index('ix_clothing_corrections_user_id', 'clothing_corrections', ['user_id'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'clothing_corrections' in tables:
        op.drop_index('ix_clothing_corrections_user_id', table_name='clothing_corrections')
        op.drop_index('ix_clothing_corrections_clothing_id', table_name='clothing_corrections')
        op.drop_table('clothing_corrections')

    if 'clothing_predictions' in tables:
        op.drop_index('ix_clothing_predictions_user_id', table_name='clothing_predictions')
        op.drop_index('ix_clothing_predictions_clothing_id', table_name='clothing_predictions')
        op.drop_table('clothing_predictions')
