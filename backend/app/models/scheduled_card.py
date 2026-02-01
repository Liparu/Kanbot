import uuid
from datetime import datetime, date, timezone
from enum import Enum
from sqlalchemy import String, DateTime, Date, Boolean, Integer, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class RecurrenceInterval(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class ScheduledCard(Base):
    __tablename__ = "scheduled_cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False)
    column_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("columns.id", ondelete="SET NULL"), nullable=True)
    column_name: Mapped[str] = mapped_column(String(200), nullable=False)
    
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    interval: Mapped[RecurrenceInterval] = mapped_column(SQLEnum(RecurrenceInterval), nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    tag_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    assignee_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    tasks: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    space: Mapped["Space"] = relationship("Space", back_populates="scheduled_cards")
    column: Mapped["Column"] = relationship("Column")
    creator: Mapped["User"] = relationship("User")


from app.models.space import Space
from app.models.column import Column
from app.models.user import User
