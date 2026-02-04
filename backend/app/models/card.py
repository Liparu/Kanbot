import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, DateTime, Date, Integer, ForeignKey, JSON, Boolean, Text, Enum, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


card_assignees = Table(
    "card_assignees",
    Base.metadata,
    Column("card_id", UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    column_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("columns.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    location: Mapped[str] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    task_counter: Mapped[int] = mapped_column(Integer, default=0)
    task_completed_counter: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    last_column_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    waiting_on: Mapped[str] = mapped_column(String(500), nullable=True)
    approver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    column: Mapped["Column"] = relationship("Column", back_populates="cards", foreign_keys=[column_id])
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="card", cascade="all, delete-orphan", order_by="Task.position")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="card", cascade="all, delete-orphan", order_by="Comment.created_at")
    tags: Mapped[list["CardTag"]] = relationship("CardTag", back_populates="card", cascade="all, delete-orphan")
    history: Mapped[list["CardHistory"]] = relationship("CardHistory", back_populates="card", cascade="all, delete-orphan", order_by="CardHistory.created_at.desc()")
    
    assignees: Mapped[list["User"]] = relationship("User", secondary=card_assignees, backref="assigned_cards")
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by], backref="created_cards")
    
    blocked_by: Mapped[list["CardDependency"]] = relationship(
        "CardDependency",
        foreign_keys="CardDependency.card_id",
        back_populates="card",
        cascade="all, delete-orphan"
    )
    blocking: Mapped[list["CardDependency"]] = relationship(
        "CardDependency",
        foreign_keys="CardDependency.blocked_by_id",
        back_populates="blocked_by_card",
        cascade="all, delete-orphan"
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(String(1000), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    card: Mapped["Card"] = relationship("Card", back_populates="tasks")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    actor_type: Mapped[str] = mapped_column(String(20), default="user")
    actor_name: Mapped[str] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    card: Mapped["Card"] = relationship("Card", back_populates="comments")
    user: Mapped["User"] = relationship("User")


class CardTag(Base):
    __tablename__ = "card_tags"

    card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    
    card: Mapped["Card"] = relationship("Card", back_populates="tags")
    tag: Mapped["Tag"] = relationship("Tag", back_populates="cards")


class CardDependency(Base):
    __tablename__ = "card_dependencies"

    card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True)
    blocked_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    card: Mapped["Card"] = relationship("Card", foreign_keys=[card_id], back_populates="blocked_by")
    blocked_by_card: Mapped["Card"] = relationship("Card", foreign_keys=[blocked_by_id], back_populates="blocking")


class ActorType(str, enum.Enum):
    USER = "user"
    AGENT = "agent"


class CardHistory(Base):
    __tablename__ = "card_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    changes: Mapped[dict] = mapped_column(JSON, default=dict)
    actor_type: Mapped[ActorType] = mapped_column(Enum(ActorType), nullable=False, default=ActorType.USER)
    actor_id: Mapped[str] = mapped_column(String(200), nullable=False)
    actor_name: Mapped[str] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    card: Mapped["Card"] = relationship("Card", back_populates="history")


from app.models.column import Column
from app.models.user import User
from app.models.tag import Tag
