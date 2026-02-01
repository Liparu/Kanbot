from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    message: Optional[str] = None
    data: dict = Field(default_factory=dict)
    read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
