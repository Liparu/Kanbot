"""add space color field

Revision ID: add_space_color
Revises: add_admin_fields
Create Date: 2026-02-01 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_space_color'
down_revision: Union[str, None] = 'add_admin_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('spaces', sa.Column('color', sa.String(7), nullable=True))


def downgrade() -> None:
    op.drop_column('spaces', 'color')
