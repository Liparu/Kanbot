"""change_scheduled_cards_to_datetime

Revision ID: 004_scheduled_cards_datetime
Revises: 003_change_card_dates
Create Date: 2026-01-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '004_scheduled_cards_datetime'
down_revision: Union[str, None] = '003_change_card_dates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Change start_date from Date to DateTime with timezone
    op.alter_column(
        'scheduled_cards',
        'start_date',
        existing_type=sa.Date(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using='start_date::timestamp with time zone'
    )
    
    # Change end_date from Date to DateTime with timezone
    op.alter_column(
        'scheduled_cards',
        'end_date',
        existing_type=sa.Date(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using='end_date::timestamp with time zone'
    )
    
    # Change next_run from Date to DateTime with timezone
    op.alter_column(
        'scheduled_cards',
        'next_run',
        existing_type=sa.Date(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using='next_run::timestamp with time zone'
    )
    
    # Change last_run from Date to DateTime with timezone
    op.alter_column(
        'scheduled_cards',
        'last_run',
        existing_type=sa.Date(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using='last_run::timestamp with time zone'
    )


def downgrade() -> None:
    # Revert start_date back to Date
    op.alter_column(
        'scheduled_cards',
        'start_date',
        existing_type=sa.DateTime(timezone=True),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using='start_date::date'
    )
    
    # Revert end_date back to Date
    op.alter_column(
        'scheduled_cards',
        'end_date',
        existing_type=sa.DateTime(timezone=True),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using='end_date::date'
    )
    
    # Revert next_run back to Date
    op.alter_column(
        'scheduled_cards',
        'next_run',
        existing_type=sa.DateTime(timezone=True),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using='next_run::date'
    )
    
    # Revert last_run back to Date
    op.alter_column(
        'scheduled_cards',
        'last_run',
        existing_type=sa.DateTime(timezone=True),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using='last_run::date'
    )
