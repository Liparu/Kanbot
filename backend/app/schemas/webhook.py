from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class WebhookCreate(BaseModel):
    space_id: UUID
    url: str = Field(..., max_length=2000)
    events: List[str] = Field(default_factory=list)
    secret: Optional[str] = Field(None, max_length=255)


class WebhookUpdate(BaseModel):
    url: Optional[str] = Field(None, max_length=2000)
    events: Optional[List[str]] = None
    secret: Optional[str] = Field(None, max_length=255)
    active: Optional[bool] = None


class WebhookResponse(BaseModel):
    id: UUID
    space_id: UUID
    url: str
    events: List[str] = Field(default_factory=list)
    active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class WebhookLogResponse(BaseModel):
    id: UUID
    webhook_id: UUID
    event: str
    payload: dict = Field(default_factory=dict)
    response_status: Optional[int] = None
    success: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
