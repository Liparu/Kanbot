from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class CalendarEventCreate(BaseModel):
    calendar_id: UUID
    card_id: Optional[UUID] = None
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    all_day: bool = False
    location: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, max_length=20)


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, max_length=20)


class CalendarEventResponse(BaseModel):
    id: UUID
    calendar_id: UUID
    card_id: Optional[UUID]
    google_event_id: Optional[str]
    title: str
    description: Optional[str]
    start_date: datetime
    end_date: Optional[datetime]
    all_day: bool
    location: Optional[str]
    color: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarResponse(BaseModel):
    id: UUID
    space_id: UUID
    google_calendar_id: Optional[str] = None
    settings: dict = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True
