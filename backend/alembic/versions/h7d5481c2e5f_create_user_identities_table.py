"""create user_identities table for OAuth providers

Revision ID: h7d5481c2e5f
Revises: g6c4370b1d4e
Create Date: 2026-11-02

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'h7d5481c2e5f'
down_revision: Union[str, None] = 'g6c4370b1d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'user_identities' not in tables:
        op.create_table(
            'user_identities',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('provider', sa.String(length=50), nullable=False, server_default='google'),
            sa.Column('provider_user_id', sa.String(length=255), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.UniqueConstraint('provider', 'provider_user_id', name='uq_user_identities_provider_user_id'),
        )
        op.create_index('ix_user_identities_user_id', 'user_identities', ['user_id'])
        op.create_index('ix_user_identities_provider', 'user_identities', ['provider'])
        op.create_index('ix_user_identities_provider_user_id', 'user_identities', ['provider_user_id'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'user_identities' in tables:
        op.drop_index('ix_user_identities_provider_user_id', table_name='user_identities')
        op.drop_index('ix_user_identities_provider', table_name='user_identities')
        op.drop_index('ix_user_identities_user_id', table_name='user_identities')
        op.drop_table('user_identities')
