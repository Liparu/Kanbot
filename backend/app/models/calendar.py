import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Date, Boolean, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Calendar(Base):
    __tablename__ = "calendars"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), unique=True, nullable=False)
    google_calendar_id: Mapped[str] = mapped_column(String(500), nullable=True)
    google_sync_token: Mapped[str] = mapped_column(String(500), nullable=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    space: Mapped["Space"] = relationship("Space", back_populates="calendar")
    events: Mapped[list["CalendarEvent"]] = relationship("CalendarEvent", back_populates="calendar", cascade="all, delete-orphan")


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calendars.id", ondelete="CASCADE"), nullable=False)
    card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=True)
    google_event_id: Mapped[str] = mapped_column(String(500), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str] = mapped_column(String(500), nullable=True)
    color: Mapped[str] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="events")
    card: Mapped["Card"] = relationship("Card")


from app.models.space import Space
from app.models.card import Card
