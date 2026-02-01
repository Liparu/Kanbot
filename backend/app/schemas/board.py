from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class BoardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    space_id: UUID


class BoardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    position: Optional[int] = None


class BoardResponse(BaseModel):
    id: UUID
    space_id: UUID
    name: str
    position: int
    created_at: datetime

    class Config:
        from_attributes = True


class BoardWithColumnsResponse(BoardResponse):
    columns: List["ColumnWithCardsResponse"] = Field(default_factory=list)


from app.schemas.column import ColumnWithCardsResponse
BoardWithColumnsResponse.model_rebuild()
