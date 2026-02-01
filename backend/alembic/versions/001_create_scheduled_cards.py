"""create scheduled_cards table

Revision ID: 001_scheduled_cards
Revises:
Create Date: 2024-01-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_scheduled_cards'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    recurrence_interval = postgresql.ENUM(
        'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly',
        name='recurrenceinterval'
    )
    recurrence_interval.create(op.get_bind(), checkfirst=True)
    
    op.create_table(
        'scheduled_cards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('space_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('spaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('column_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('columns.id', ondelete='SET NULL'), nullable=True),
        sa.Column('column_name', sa.String(200), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('interval', sa.Enum('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', name='recurrenceinterval'), nullable=False),
        sa.Column('start_date', sa.Date, nullable=False),
        sa.Column('end_date', sa.Date, nullable=True),
        sa.Column('next_run', sa.Date, nullable=False),
        sa.Column('last_run', sa.Date, nullable=True),
        sa.Column('tag_ids', postgresql.JSONB, nullable=True),
        sa.Column('assignee_ids', postgresql.JSONB, nullable=True),
        sa.Column('tasks', postgresql.JSONB, nullable=True),
        sa.Column('location', sa.String(500), nullable=True),
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    
    op.create_index('ix_scheduled_cards_space_id', 'scheduled_cards', ['space_id'])
    op.create_index('ix_scheduled_cards_next_run', 'scheduled_cards', ['next_run'])


def downgrade() -> None:
    op.drop_index('ix_scheduled_cards_next_run')
    op.drop_index('ix_scheduled_cards_space_id')
    op.drop_table('scheduled_cards')
    
    recurrence_interval = postgresql.ENUM(
        'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly',
        name='recurrenceinterval'
    )
    recurrence_interval.drop(op.get_bind(), checkfirst=True)
