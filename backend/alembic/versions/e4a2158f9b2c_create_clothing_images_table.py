"""create clothing_images table

Revision ID: e4a2158f9b2c
Revises: d2b1049e7a1f
Create Date: 2026-10-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'e4a2158f9b2c'
down_revision: Union[str, None] = 'd2b1049e7a1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'clothing_images' not in tables:
        op.create_table(
            'clothing_images',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('clothing_id', UUID(as_uuid=True), sa.ForeignKey('clothing.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('image_type', sa.String(length=30), nullable=False),
            sa.Column('image_data', sa.LargeBinary(), nullable=False),
            sa.Column('mime_type', sa.String(length=50), server_default='image/webp', nullable=False),
            sa.Column('file_size', sa.Integer(), server_default='0', nullable=False),
            sa.Column('width', sa.Integer(), nullable=True),
            sa.Column('height', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_clothing_images_clothing_id', 'clothing_images', ['clothing_id'])
        op.create_index('ix_clothing_images_user_id', 'clothing_images', ['user_id'])
        op.create_index('ix_clothing_images_clothing_type', 'clothing_images', ['clothing_id', 'image_type'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'clothing_images' in tables:
        op.drop_index('ix_clothing_images_clothing_type', table_name='clothing_images')
        op.drop_index('ix_clothing_images_user_id', table_name='clothing_images')
        op.drop_index('ix_clothing_images_clothing_id', table_name='clothing_images')
        op.drop_table('clothing_images')
