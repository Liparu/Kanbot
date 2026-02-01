from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#6366f1", max_length=20)
    is_predefined: bool = False


class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, max_length=20)
    is_predefined: Optional[bool] = None


class TagResponse(BaseModel):
    id: UUID
    space_id: UUID
    name: str
    color: str
    is_predefined: bool
    created_at: datetime

    class Config:
        from_attributes = True
