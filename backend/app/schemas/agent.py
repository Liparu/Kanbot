from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class AgentCreate(BaseModel):
    """Create a new agent in a space."""
    space_id: UUID
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    model: str = Field(default="openrouter/moonshotai/kimi-k2.5", max_length=100)
    schedule_type: Optional[str] = Field(None, max_length=50)  # cron, interval, manual
    schedule_value: Optional[str] = Field(None, max_length=100)  # cron expr or interval
    agent_files_path: Optional[str] = Field(None, max_length=500)
    settings: dict = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    """Update an existing agent."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    model: Optional[str] = Field(None, max_length=100)
    schedule_type: Optional[str] = Field(None, max_length=50)
    schedule_value: Optional[str] = Field(None, max_length=100)
    cron_job_id: Optional[str] = Field(None, max_length=100)
    card_id: Optional[UUID] = None
    agent_files_path: Optional[str] = Field(None, max_length=500)
    enabled: Optional[bool] = None
    status: Optional[str] = Field(None, max_length=50)
    settings: Optional[dict] = None


class AgentResponse(BaseModel):
    """Agent response with full details."""
    id: UUID
    space_id: UUID
    name: str
    description: Optional[str] = None
    model: str
    schedule_type: Optional[str] = None
    schedule_value: Optional[str] = None
    cron_job_id: Optional[str] = None
    card_id: Optional[UUID] = None
    agent_files_path: Optional[str] = None
    enabled: bool
    status: str
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    last_run_duration_ms: Optional[int] = None
    next_run_at: Optional[datetime] = None
    run_count_24h: int
    error_count_24h: int
    settings: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    """Lightweight agent response for lists."""
    id: UUID
    name: str
    model: str
    enabled: bool
    status: str
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    next_run_at: Optional[datetime] = None
    run_count_24h: int
    error_count_24h: int

    class Config:
        from_attributes = True


class AgentRunResponse(BaseModel):
    """Agent run history entry."""
    id: UUID
    agent_id: UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    session_key: Optional[str] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    summary: Optional[str] = None

    class Config:
        from_attributes = True


class AgentStatsResponse(BaseModel):
    """Agent statistics for dashboard."""
    total_agents: int
    active_agents: int
    healthy_agents: int
    warning_agents: int
    error_agents: int
    total_runs_24h: int
    total_errors_24h: int
