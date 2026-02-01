"""add location column to scheduled_cards

Revision ID: 002_add_location
Revises: 001_scheduled_cards
Create Date: 2024-01-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '002_add_location'
down_revision: Union[str, None] = '001_scheduled_cards'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('scheduled_cards', sa.Column('location', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('scheduled_cards', 'location')
