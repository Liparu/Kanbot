import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, ForeignKey, JSON, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


class ColumnCategory(str, enum.Enum):
    DEFAULT = "default"
    INBOX = "inbox"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    REVIEW = "review"
    ARCHIVE = "archive"


class Column(Base):
    __tablename__ = "columns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[ColumnCategory] = mapped_column(Enum(ColumnCategory), nullable=False, default=ColumnCategory.DEFAULT)
    position: Mapped[int] = mapped_column(Integer, default=0)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    space: Mapped["Space"] = relationship("Space", back_populates="columns")
    cards: Mapped[list["Card"]] = relationship("Card", back_populates="column", cascade="all, delete-orphan", order_by="Card.position", foreign_keys="Card.column_id")


from app.models.space import Space
from app.models.card import Card
