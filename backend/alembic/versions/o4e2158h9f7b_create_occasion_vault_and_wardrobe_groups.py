"""create occasion vault and wardrobe groups columns on clothing

Revision ID: o4e2158h9f7b
Revises: n3d1047g8e6a
Create Date: 2026-11-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'o4e2158h9f7b'
down_revision: Union[str, None] = 'n3d1047g8e6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'clothing' in tables:
        clothing_cols = [c['name'] for c in insp.get_columns('clothing')]

        if 'wear_tier' not in clothing_cols:
            op.add_column('clothing', sa.Column('wear_tier', sa.String(length=50), nullable=False, server_default='daily'))
        if 'is_luxury' not in clothing_cols:
            op.add_column('clothing', sa.Column('is_luxury', sa.Boolean(), nullable=False, server_default='false'))
        if 'formality_score' not in clothing_cols:
            op.add_column('clothing', sa.Column('formality_score', sa.Float(), nullable=False, server_default='0.50'))
        if 'purchase_price' not in clothing_cols:
            op.add_column('clothing', sa.Column('purchase_price', sa.Numeric(precision=10, scale=2), nullable=True))
        if 'purchase_date' not in clothing_cols:
            op.add_column('clothing', sa.Column('purchase_date', sa.Date(), nullable=True))
        if 'care_type' not in clothing_cols:
            op.add_column('clothing', sa.Column('care_type', sa.String(length=50), nullable=False, server_default='machine_wash'))
        if 'special_use_restriction' not in clothing_cols:
            op.add_column('clothing', sa.Column('special_use_restriction', sa.String(length=50), nullable=False, server_default='none'))
        if 'reserved_status' not in clothing_cols:
            op.add_column('clothing', sa.Column('reserved_status', sa.String(length=50), nullable=False, server_default='available'))
        if 'notes' not in clothing_cols:
            op.add_column('clothing', sa.Column('notes', sa.Text(), nullable=True))
        if 'wardrobe_groups' not in clothing_cols:
            op.add_column('clothing', sa.Column('wardrobe_groups', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='["daily_work"]'))
        if 'suitable_occasions' not in clothing_cols:
            op.add_column('clothing', sa.Column('suitable_occasions', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'))
        if 'provenance' not in clothing_cols:
            op.add_column('clothing', sa.Column('provenance', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'))

        # Add index for fast group and tier queries
        indexes = [ix['name'] for ix in insp.get_indexes('clothing')]
        if 'ix_clothing_wear_tier' not in indexes:
            op.create_index('ix_clothing_wear_tier', 'clothing', ['wear_tier'])
        if 'ix_clothing_is_luxury' not in indexes:
            op.create_index('ix_clothing_is_luxury', 'clothing', ['is_luxury'])

        # Deliberate Backfill:
        # 1. Backfill special/luxury items: Suits, Blazers, Sherwanis, Sarees, Lehengas, or Formal/Wedding occasions
        conn.execute(sa.text("""
            UPDATE clothing 
            SET wear_tier = 'luxury_special', 
                wardrobe_groups = '["luxury_special"]'::jsonb,
                formality_score = 0.85
            WHERE LOWER(COALESCE(category, '')) IN ('sherwani', 'lehenga', 'saree', 'tuxedo')
               OR LOWER(COALESCE(subcategory, '')) IN ('sherwani', 'lehenga', 'saree', 'tuxedo', 'ballgown')
               OR LOWER(COALESCE(name, '')) LIKE '%tuxedo%'
               OR LOWER(COALESCE(name, '')) LIKE '%sherwani%'
               OR LOWER(COALESCE(name, '')) LIKE '%lehenga%'
               OR LOWER(COALESCE(name, '')) LIKE '%bridal%'
        """))

        # 2. Backfill party & evening wear
        conn.execute(sa.text("""
            UPDATE clothing 
            SET wardrobe_groups = '["party_evening"]'::jsonb
            WHERE (LOWER(COALESCE(occasion, '')) IN ('party', 'party & evening', 'date', 'date night')
               OR LOWER(COALESCE(name, '')) LIKE '%party%'
               OR LOWER(COALESCE(name, '')) LIKE '%cocktail%')
              AND wear_tier != 'luxury_special'
        """))

        # 3. Backfill elevated items: blazers, formal trousers, formal shirts
        conn.execute(sa.text("""
            UPDATE clothing 
            SET wear_tier = 'elevated',
                formality_score = 0.75
            WHERE (LOWER(COALESCE(subcategory, '')) IN ('blazer', 'suit', 'formal_shoes', 'oxford')
               OR LOWER(COALESCE(name, '')) LIKE '%blazer%'
               OR LOWER(COALESCE(name, '')) LIKE '%suit%'
               OR LOWER(COALESCE(name, '')) LIKE '%oxford%')
              AND wear_tier = 'daily'
        """))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if 'clothing' in insp.get_table_names():
        clothing_cols = [c['name'] for c in insp.get_columns('clothing')]
        for col in [
            'provenance', 'suitable_occasions', 'wardrobe_groups', 'notes',
            'reserved_status', 'special_use_restriction', 'care_type',
            'purchase_date', 'purchase_price', 'formality_score',
            'is_luxury', 'wear_tier'
        ]:
            if col in clothing_cols:
                op.drop_column('clothing', col)
