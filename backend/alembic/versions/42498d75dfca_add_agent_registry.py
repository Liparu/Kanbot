"""add_agent_registry

Revision ID: 42498d75dfca
Revises: add_card_column_entered_at
Create Date: 2026-02-07 11:32:26.424451

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '42498d75dfca'
down_revision: Union[str, None] = 'add_card_column_entered_at'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create agents table
    op.create_table('agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('space_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=False, server_default='openrouter/moonshotai/kimi-k2.5'),
        sa.Column('schedule_type', sa.String(length=50), nullable=True),
        sa.Column('schedule_value', sa.String(length=100), nullable=True),
        sa.Column('cron_job_id', sa.String(length=100), nullable=True),
        sa.Column('card_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('agent_files_path', sa.String(length=500), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='healthy'),
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_run_status', sa.String(length=50), nullable=True),
        sa.Column('last_run_duration_ms', sa.Integer(), nullable=True),
        sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('run_count_24h', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_count_24h', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('settings', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['card_id'], ['cards.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['space_id'], ['spaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_agents_space_id', 'agents', ['space_id'], unique=False)
    op.create_index('ix_agents_cron_job_id', 'agents', ['cron_job_id'], unique=False)
    
    # Create agent_runs table
    op.create_table('agent_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('session_key', sa.String(length=100), nullable=True),
        sa.Column('model_used', sa.String(length=100), nullable=True),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_agent_runs_agent_id', 'agent_runs', ['agent_id'], unique=False)
    op.create_index('ix_agent_runs_started_at', 'agent_runs', ['started_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_agent_runs_started_at', table_name='agent_runs')
    op.drop_index('ix_agent_runs_agent_id', table_name='agent_runs')
    op.drop_table('agent_runs')
    op.drop_index('ix_agents_cron_job_id', table_name='agents')
    op.drop_index('ix_agents_space_id', table_name='agents')
    op.drop_table('agents')
