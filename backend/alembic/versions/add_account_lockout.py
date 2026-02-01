"""add account lockout fields

Revision ID: add_account_lockout
Revises: add_space_color
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa


revision = 'add_account_lockout'
down_revision = 'add_space_color'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('failed_login_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_count')
