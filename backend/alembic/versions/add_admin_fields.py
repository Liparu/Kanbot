"""add_admin_fields

Revision ID: add_admin_fields
Revises: 8563361832a7
Create Date: 2026-02-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_admin_fields'
down_revision: Union[str, None] = '8563361832a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('is_banned', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('banned_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'banned_at')
    op.drop_column('users', 'is_banned')
    op.drop_column('users', 'is_admin')
