"""Backfill card created_by field

Revision ID: backfill_card_created_by
Revises: 005_remove_board_link_columns_to_spaces
Create Date: 2026-02-04

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'backfill_card_created_by'
down_revision: Union[str, None] = '005_remove_board_link_columns_to_spaces'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Get database connection
    conn = op.get_bind()
    
    # Find the space owner for each card that doesn't have created_by set
    # and set created_by to the first member (owner) of the space
    conn.execute(sa.text("""
        UPDATE cards 
        SET created_by = sub.owner_id
        FROM (
            SELECT c.id as card_id, s.owner_id
            FROM cards c
            JOIN columns col ON c.column_id = col.id
            JOIN spaces s ON col.space_id = s.id
            WHERE c.created_by IS NULL
        ) sub
        WHERE cards.id = sub.card_id
    """))
    
    # For any remaining cards without created_by (edge cases),
    # set to the first admin user or system user
    conn.execute(sa.text("""
        UPDATE cards 
        SET created_by = (
            SELECT id FROM users 
            WHERE is_admin = true 
            ORDER BY created_at ASC 
            LIMIT 1
        )
        WHERE created_by IS NULL
    """))


def downgrade() -> None:
    # No downgrade needed - we don't want to remove created_by values
    pass
