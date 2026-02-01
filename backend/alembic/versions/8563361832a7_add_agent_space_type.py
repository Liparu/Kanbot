"""add_agent_space_type

Revision ID: 8563361832a7
Revises: 004_scheduled_cards_datetime
Create Date: 2026-01-31 09:53:02.392030

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8563361832a7'
down_revision: Union[str, None] = '004_scheduled_cards_datetime'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE spacetype ADD VALUE IF NOT EXISTS 'AGENT'")


def downgrade() -> None:
    pass
