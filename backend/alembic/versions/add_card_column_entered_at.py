"""add card column_entered_at field

Revision ID: add_card_column_entered_at
Revises: backfill_card_created_by
Create Date: 2026-02-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'add_card_column_entered_at'
down_revision: Union[str, None] = 'backfill_card_created_by'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column_entered_at field (nullable for existing cards)
    op.add_column('cards', sa.Column('column_entered_at', sa.DateTime(timezone=True), nullable=True))

    # Backfill existing cards: set column_entered_at to created_at
    op.execute("""
        UPDATE cards
        SET column_entered_at = created_at
        WHERE column_entered_at IS NULL
    """)


def downgrade() -> None:
    op.drop_column('cards', 'column_entered_at')
