"""add provider_subject and verified_email to user_identities

Revision ID: l1b9825f6d4e
Revises: k0a8714e5c3d
Create Date: 2026-11-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'l1b9825f6d4e'
down_revision: Union[str, None] = 'k0a8714e5c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'user_identities' in tables:
        columns = [c['name'] for c in insp.get_columns('user_identities')]
        if 'provider_subject' not in columns:
            op.add_column('user_identities', sa.Column('provider_subject', sa.String(length=255), nullable=True))
            # Backfill provider_subject from provider_user_id
            op.execute("UPDATE user_identities SET provider_subject = provider_user_id WHERE provider_subject IS NULL")
            op.create_index('ix_user_identities_provider_subject', 'user_identities', ['provider', 'provider_subject'], unique=True)
        if 'verified_email' not in columns:
            op.add_column('user_identities', sa.Column('verified_email', sa.String(length=255), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'user_identities' in tables:
        columns = [c['name'] for c in insp.get_columns('user_identities')]
        if 'provider_subject' in columns:
            op.drop_index('ix_user_identities_provider_subject', table_name='user_identities')
            op.drop_column('user_identities', 'provider_subject')
        if 'verified_email' in columns:
            op.drop_column('user_identities', 'verified_email')
