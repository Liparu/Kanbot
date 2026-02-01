"""change_card_dates_to_datetime

Revision ID: 003_change_card_dates
Revises: 69afc0502192
Create Date: 2026-01-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '003_change_card_dates'
down_revision: Union[str, None] = '69afc0502192'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Change start_date from Date to DateTime with timezone
    op.alter_column(
        'cards',
        'start_date',
        existing_type=sa.Date(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using='start_date::timestamp with time zone'
    )
    
    # Change end_date from Date to DateTime with timezone
    op.alter_column(
        'cards',
        'end_date',
        existing_type=sa.Date(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using='end_date::timestamp with time zone'
    )


def downgrade() -> None:
    # Revert start_date back to Date
    op.alter_column(
        'cards',
        'start_date',
        existing_type=sa.DateTime(timezone=True),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using='start_date::date'
    )
    
    # Revert end_date back to Date
    op.alter_column(
        'cards',
        'end_date',
        existing_type=sa.DateTime(timezone=True),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using='end_date::date'
    )
