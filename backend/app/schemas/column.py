from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.column import ColumnCategory


class ColumnCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    space_id: UUID
    category: ColumnCategory = ColumnCategory.DEFAULT
    position: Optional[int] = None
    settings: Optional[dict] = None


class ColumnUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[ColumnCategory] = None
    position: Optional[int] = None
    settings: Optional[dict] = None


class ColumnResponse(BaseModel):
    id: UUID
    space_id: UUID
    name: str
    category: ColumnCategory
    position: int = 0
    settings: dict = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True


class ColumnWithCardsResponse(ColumnResponse):
    cards: List["CardWithTasksResponse"] = Field(default_factory=list)


from app.schemas.card import CardWithTasksResponse
ColumnWithCardsResponse.model_rebuild()
