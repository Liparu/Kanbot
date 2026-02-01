from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class FilterTemplateCreate(BaseModel):
    space_id: UUID
    name: str = Field(..., min_length=1, max_length=200)
    filters: dict = Field(default_factory=dict)


class FilterTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    filters: Optional[dict] = None


class FilterTemplateResponse(BaseModel):
    id: UUID
    space_id: UUID
    name: str
    filters: dict = Field(default_factory=dict)
    created_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
