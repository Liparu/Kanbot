from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.space import Space, SpaceMember
from app.models.calendar import Calendar, CalendarEvent
from app.models.card import Card
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventUpdate,
    CalendarEventResponse,
    CalendarResponse,
)
from app.api.deps import get_current_user

router = APIRouter()


async def verify_calendar_access(calendar_id: UUID, user: User, db: AsyncSession) -> Calendar:
    result = await db.execute(
        select(Calendar)
        .where(Calendar.id == calendar_id)
        .options(selectinload(Calendar.space).selectinload(Space.members))
    )
    calendar = result.scalar_one_or_none()
    
    if not calendar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar not found")
    
    is_member = any(m.user_id == user.id for m in calendar.space.members)
    if not is_member and not calendar.space.calendar_public:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this calendar")
    
    return calendar


@router.get("/space/{space_id}", response_model=CalendarResponse)
async def get_space_calendar(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Space)
        .where(Space.id == space_id)
        .options(selectinload(Space.members), selectinload(Space.calendar))
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    
    is_member = any(m.user_id == current_user.id for m in space.members)
    if not is_member and not space.calendar_public:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this calendar")
    
    return space.calendar


@router.get("/events", response_model=List[CalendarEventResponse])
async def list_calendar_events(
    calendar_ids: List[UUID] = Query(default=[]),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not calendar_ids:
        result = await db.execute(
            select(Calendar)
            .join(Space)
            .join(SpaceMember)
            .where(SpaceMember.user_id == current_user.id)
        )
        calendars = result.scalars().all()
        calendar_ids = [c.id for c in calendars]
    
    query = select(CalendarEvent).where(CalendarEvent.calendar_id.in_(calendar_ids))
    
    if start_date:
        query = query.where(CalendarEvent.start_date >= start_date)
    if end_date:
        query = query.where(CalendarEvent.start_date <= end_date)
    
    query = query.order_by(CalendarEvent.start_date)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    event_data: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    calendar = await verify_calendar_access(event_data.calendar_id, current_user, db)
    
    is_member = any(m.user_id == current_user.id for m in calendar.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create events in this calendar")
    
    event = CalendarEvent(
        calendar_id=event_data.calendar_id,
        card_id=event_data.card_id,
        title=event_data.title,
        description=event_data.description,
        start_date=event_data.start_date,
        end_date=event_data.end_date,
        all_day=event_data.all_day,
        location=event_data.location,
        color=event_data.color,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    
    return event


@router.patch("/events/{event_id}", response_model=CalendarEventResponse)
async def update_calendar_event(
    event_id: UUID,
    event_data: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.id == event_id)
        .options(selectinload(CalendarEvent.calendar).selectinload(Calendar.space).selectinload(Space.members))
    )
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    is_member = any(m.user_id == current_user.id for m in event.calendar.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update events in this calendar")
    
    if event_data.title is not None:
        event.title = event_data.title
    if event_data.description is not None:
        event.description = event_data.description
    if event_data.start_date is not None:
        event.start_date = event_data.start_date
    if event_data.end_date is not None:
        event.end_date = event_data.end_date
    if event_data.all_day is not None:
        event.all_day = event_data.all_day
    if event_data.location is not None:
        event.location = event_data.location
    if event_data.color is not None:
        event.color = event_data.color
    
    await db.commit()
    await db.refresh(event)
    
    return event


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.id == event_id)
        .options(selectinload(CalendarEvent.calendar).selectinload(Calendar.space).selectinload(Space.members))
    )
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    is_member = any(m.user_id == current_user.id for m in event.calendar.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete events in this calendar")
    
    await db.delete(event)
    await db.commit()


from app.services.google_calendar import google_calendar_service


@router.get("/google/status")
async def get_google_calendar_status(
    current_user: User = Depends(get_current_user),
):
    return {
        "configured": google_calendar_service.is_configured,
        "connected": bool(current_user.settings and current_user.settings.get("google_calendar_token")),
    }


@router.get("/google/auth-url")
async def get_google_auth_url(
    redirect_uri: str,
    space_id: UUID,
    current_user: User = Depends(get_current_user),
):
    if not google_calendar_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
    
    state = f"{current_user.id}:{space_id}"
    auth_url = google_calendar_service.create_auth_url(redirect_uri, state)
    
    return {"auth_url": auth_url}


@router.post("/google/callback")
async def google_calendar_callback(
    code: str,
    state: str,
    redirect_uri: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not google_calendar_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar is not configured"
        )
    
    try:
        token_data = google_calendar_service.exchange_code(code, redirect_uri)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange code: {str(e)}"
        )
    
    if current_user.settings is None:
        current_user.settings = {}
    
    current_user.settings["google_calendar_token"] = token_data
    await db.commit()
    
    return {"success": True}


@router.delete("/google/disconnect")
async def disconnect_google_calendar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.settings:
        current_user.settings.pop("google_calendar_token", None)
        await db.commit()
    
    return {"success": True}


@router.get("/google/calendars")
async def list_google_calendars(
    current_user: User = Depends(get_current_user),
):
    token_data = current_user.settings.get("google_calendar_token") if current_user.settings else None
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar not connected"
        )
    
    try:
        calendars = google_calendar_service.get_calendars(token_data)
        return calendars
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch calendars: {str(e)}"
        )


@router.get("/google/events")
async def list_google_events(
    calendar_id: str = "primary",
    time_min: Optional[datetime] = None,
    time_max: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
):
    token_data = current_user.settings.get("google_calendar_token") if current_user.settings else None
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar not connected"
        )
    
    try:
        result = google_calendar_service.get_events(token_data, calendar_id, time_min, time_max)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch events: {str(e)}"
        )


@router.post("/google/events")
async def create_google_event(
    calendar_id: str,
    summary: str,
    start: datetime,
    end: Optional[datetime] = None,
    description: Optional[str] = None,
    location: Optional[str] = None,
    all_day: bool = False,
    current_user: User = Depends(get_current_user),
):
    token_data = current_user.settings.get("google_calendar_token") if current_user.settings else None
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar not connected"
        )
    
    try:
        result = google_calendar_service.create_event(
            token_data, calendar_id, summary, start, end, description, location, all_day
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create event: {str(e)}"
        )


@router.delete("/google/events/{event_id}")
async def delete_google_event(
    event_id: str,
    calendar_id: str = "primary",
    current_user: User = Depends(get_current_user),
):
    token_data = current_user.settings.get("google_calendar_token") if current_user.settings else None
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar not connected"
        )
    
    try:
        google_calendar_service.delete_event(token_data, calendar_id, event_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete event: {str(e)}"
        )
