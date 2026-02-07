import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean, ForeignKey, JSON, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Agent(Base):
    """
    Agent registry - stores sub-agent configurations for agent spaces.
    Each agent can have a linked cron job, Kanbot card, and agent files directory.
    """
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False, default="openrouter/moonshotai/kimi-k2.5")
    
    # Schedule
    schedule_type: Mapped[str] = mapped_column(String(50), nullable=True)  # cron, interval, manual
    schedule_value: Mapped[str] = mapped_column(String(100), nullable=True)  # cron expr or interval
    
    # External links
    cron_job_id: Mapped[str] = mapped_column(String(100), nullable=True)  # OpenClaw cron job ID
    card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="SET NULL"), nullable=True)
    agent_files_path: Mapped[str] = mapped_column(String(500), nullable=True)  # Path to AGENTS.md etc
    
    # Status
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(50), default="healthy")  # healthy, warning, error
    last_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_status: Mapped[str] = mapped_column(String(50), nullable=True)  # success, error
    last_run_duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Stats
    run_count_24h: Mapped[int] = mapped_column(Integer, default=0)
    error_count_24h: Mapped[int] = mapped_column(Integer, default=0)
    
    # Metadata
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    space: Mapped["Space"] = relationship("Space", back_populates="agents")
    card: Mapped["Card"] = relationship("Card", foreign_keys=[card_id])
    runs: Mapped[list["AgentRun"]] = relationship("AgentRun", back_populates="agent", cascade="all, delete-orphan")


class AgentRun(Base):
    """
    Agent run history - stores recent runs for dashboard display.
    """
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # running, success, error
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Session info
    session_key: Mapped[str] = mapped_column(String(100), nullable=True)
    model_used: Mapped[str] = mapped_column(String(100), nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Output
    summary: Mapped[str] = mapped_column(Text, nullable=True)  # Brief summary of what agent did
    
    agent: Mapped["Agent"] = relationship("Agent", back_populates="runs")


# Import at end to avoid circular imports
from app.models.space import Space
from app.models.card import Card
