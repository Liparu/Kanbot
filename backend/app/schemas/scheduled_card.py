from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from app.models.scheduled_card import RecurrenceInterval


class ScheduledCardCreate(BaseModel):
    space_id: UUID
    column_id: Optional[UUID] = None
    column_name: str
    name: str
    description: Optional[str] = None
    interval: RecurrenceInterval
    start_date: datetime
    end_date: Optional[datetime] = None
    tag_ids: Optional[List[UUID]] = None
    assignee_ids: Optional[List[UUID]] = None
    tasks: Optional[List[str]] = None
    location: Optional[str] = None


class ScheduledCardUpdate(BaseModel):
    column_id: Optional[UUID] = None
    column_name: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    interval: Optional[RecurrenceInterval] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    tag_ids: Optional[List[UUID]] = None
    assignee_ids: Optional[List[UUID]] = None
    tasks: Optional[List[str]] = None
    location: Optional[str] = None
    active: Optional[bool] = None


class ScheduledCardResponse(BaseModel):
    id: UUID
    space_id: UUID
    column_id: Optional[UUID]
    column_name: str
    name: str
    description: Optional[str]
    interval: RecurrenceInterval
    start_date: datetime
    end_date: Optional[datetime]
    next_run: datetime
    last_run: Optional[datetime]
    tag_ids: Optional[List[UUID]]
    assignee_ids: Optional[List[UUID]]
    tasks: Optional[List[str]]
    location: Optional[str]
    active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
