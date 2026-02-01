import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, JSON, Boolean, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


SPACE_DEFAULT_COLORS = {
    "personal": "#3b82f6",
    "company": "#8b5cf6",
    "agent": "#06b6d4",
}


class SpaceType(str, enum.Enum):
    PERSONAL = "personal"
    COMPANY = "company"
    AGENT = "agent"


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    MEMBER = "member"
    GUEST = "guest"


class Space(Base):
    __tablename__ = "spaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[SpaceType] = mapped_column(Enum(SpaceType), nullable=False, default=SpaceType.PERSONAL)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    calendar_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    owner: Mapped["User"] = relationship("User", back_populates="owned_spaces", foreign_keys=[owner_id])
    members: Mapped[list["SpaceMember"]] = relationship("SpaceMember", back_populates="space", cascade="all, delete-orphan")
    boards: Mapped[list["Board"]] = relationship("Board", back_populates="space", cascade="all, delete-orphan")
    tags: Mapped[list["Tag"]] = relationship("Tag", back_populates="space", cascade="all, delete-orphan")
    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="space", uselist=False, cascade="all, delete-orphan")
    webhooks: Mapped[list["Webhook"]] = relationship("Webhook", back_populates="space", cascade="all, delete-orphan")
    filter_templates: Mapped[list["FilterTemplate"]] = relationship("FilterTemplate", back_populates="space", cascade="all, delete-orphan")
    scheduled_cards: Mapped[list["ScheduledCard"]] = relationship("ScheduledCard", back_populates="space", cascade="all, delete-orphan")
    
    @property
    def effective_color(self) -> str:
        return self.color or SPACE_DEFAULT_COLORS.get(self.type.value, "#3b82f6")


class SpaceMember(Base):
    __tablename__ = "space_members"

    space_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole), nullable=False, default=MemberRole.MEMBER)
    agent_permissions: Mapped[dict] = mapped_column(JSON, default=dict)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    space: Mapped["Space"] = relationship("Space", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="space_memberships")


from app.models.user import User
from app.models.board import Board
from app.models.tag import Tag
from app.models.calendar import Calendar
from app.models.webhook import Webhook
from app.models.filter_template import FilterTemplate
from app.models.scheduled_card import ScheduledCard
