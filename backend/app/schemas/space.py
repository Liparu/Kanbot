from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import re
from app.models.space import SpaceType, MemberRole


class SpaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: SpaceType = SpaceType.PERSONAL
    settings: Optional[dict] = None
    calendar_public: bool = False
    color: Optional[str] = Field(None, max_length=7)
    
    @field_validator('color')
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError('Color must be a valid hex color code (e.g., #3b82f6)')
        return v


class SpaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    type: Optional[SpaceType] = None
    settings: Optional[dict] = None
    calendar_public: Optional[bool] = None
    color: Optional[str] = Field(None, max_length=7)
    
    @field_validator('color')
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError('Color must be a valid hex color code (e.g., #3b82f6)')
        return v


class SpaceMemberResponse(BaseModel):
    user_id: UUID
    username: str
    email: str
    role: MemberRole
    agent_permissions: dict = Field(default_factory=dict)
    joined_at: datetime

    class Config:
        from_attributes = True


class SpaceResponse(BaseModel):
    id: UUID
    name: str
    type: SpaceType
    owner_id: UUID
    color: Optional[str] = None
    settings: dict = Field(default_factory=dict)
    calendar_public: bool
    created_at: datetime
    members: Optional[List[SpaceMemberResponse]] = Field(default_factory=list)

    class Config:
        from_attributes = True


class SpaceWithColumnsResponse(SpaceResponse):
    columns: List["ColumnWithCardsResponse"] = Field(default_factory=list)


class SpaceStatsResponse(BaseModel):
    space_id: UUID
    total_cards: int
    waiting_cards: int
    urgent_cards: int
    inbox_cards: int
    in_progress_cards: int
    review_cards: int
    archive_cards: int


class InviteMember(BaseModel):
    email: EmailStr
    role: MemberRole = MemberRole.MEMBER


from app.schemas.column import ColumnWithCardsResponse
SpaceWithColumnsResponse.model_rebuild()
