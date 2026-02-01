from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

from app.core.database import get_db
from app.models.user import User
from app.models.space import Space, SpaceMember
from app.models.board import Board
from app.models.column import Column, ColumnCategory
from app.models.card import Card, Task, CardTag
from app.models.scheduled_card import ScheduledCard, RecurrenceInterval
from app.schemas.scheduled_card import ScheduledCardCreate, ScheduledCardUpdate, ScheduledCardResponse
from app.api.deps import get_current_user, get_actor_info, ActorInfo

router = APIRouter()


def calculate_next_run(current_datetime: datetime, interval: RecurrenceInterval) -> datetime:
    """Calculate the next run datetime based on interval, preserving time-of-day."""
    if interval == RecurrenceInterval.DAILY:
        return current_datetime + timedelta(days=1)
    elif interval == RecurrenceInterval.WEEKLY:
        return current_datetime + timedelta(weeks=1)
    elif interval == RecurrenceInterval.BIWEEKLY:
        return current_datetime + timedelta(weeks=2)
    elif interval == RecurrenceInterval.MONTHLY:
        # Preserve time-of-day when moving to next month
        month = current_datetime.month + 1
        year = current_datetime.year
        if month > 12:
            month = 1
            year += 1
        day = min(current_datetime.day, 28)
        return current_datetime.replace(year=year, month=month, day=day)
    elif interval == RecurrenceInterval.QUARTERLY:
        month = current_datetime.month + 3
        year = current_datetime.year
        while month > 12:
            month -= 12
            year += 1
        day = min(current_datetime.day, 28)
        return current_datetime.replace(year=year, month=month, day=day)
    elif interval == RecurrenceInterval.YEARLY:
        return current_datetime.replace(year=current_datetime.year + 1)
    return current_datetime + timedelta(days=1)


async def verify_space_access(space_id: UUID, user: User, db: AsyncSession) -> Space:
    result = await db.execute(
        select(Space)
        .where(Space.id == space_id)
        .options(selectinload(Space.members))
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    
    is_member = any(m.user_id == user.id for m in space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    return space


@router.get("", response_model=List[ScheduledCardResponse])
async def list_scheduled_cards(
    space_id: UUID,
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(space_id, current_user, db)
    
    query = select(ScheduledCard).where(ScheduledCard.space_id == space_id)
    if active_only:
        query = query.where(ScheduledCard.active == True)
    query = query.order_by(ScheduledCard.next_run)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ScheduledCardResponse, status_code=status.HTTP_201_CREATED)
async def create_scheduled_card(
    data: ScheduledCardCreate,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(data.space_id, actor.user, db)
    
    scheduled_card = ScheduledCard(
        space_id=data.space_id,
        column_id=data.column_id,
        column_name=data.column_name,
        name=data.name,
        description=data.description,
        interval=data.interval,
        start_date=data.start_date,
        end_date=data.end_date,
        next_run=data.start_date,
        tag_ids=[str(tid) for tid in data.tag_ids] if data.tag_ids else [],
        assignee_ids=[str(aid) for aid in data.assignee_ids] if data.assignee_ids else [],
        tasks=data.tasks or [],
        location=data.location,
        created_by=actor.user.id,
    )
    db.add(scheduled_card)
    await db.commit()
    await db.refresh(scheduled_card)
    
    return scheduled_card


@router.get("/{scheduled_card_id}", response_model=ScheduledCardResponse)
async def get_scheduled_card(
    scheduled_card_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScheduledCard)
        .where(ScheduledCard.id == scheduled_card_id)
    )
    scheduled_card = result.scalar_one_or_none()
    
    if not scheduled_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled card not found")
    
    await verify_space_access(scheduled_card.space_id, current_user, db)
    
    return scheduled_card


@router.patch("/{scheduled_card_id}", response_model=ScheduledCardResponse)
async def update_scheduled_card(
    scheduled_card_id: UUID,
    data: ScheduledCardUpdate,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScheduledCard)
        .where(ScheduledCard.id == scheduled_card_id)
    )
    scheduled_card = result.scalar_one_or_none()
    
    if not scheduled_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled card not found")
    
    await verify_space_access(scheduled_card.space_id, actor.user, db)
    
    if data.column_id is not None:
        scheduled_card.column_id = data.column_id
    if data.column_name is not None:
        scheduled_card.column_name = data.column_name
    if data.name is not None:
        scheduled_card.name = data.name
    if data.description is not None:
        scheduled_card.description = data.description
    if data.interval is not None:
        scheduled_card.interval = data.interval
    if data.start_date is not None:
        scheduled_card.start_date = data.start_date
        if scheduled_card.next_run < data.start_date:
            scheduled_card.next_run = data.start_date
    if data.end_date is not None:
        scheduled_card.end_date = data.end_date
    if data.tag_ids is not None:
        scheduled_card.tag_ids = [str(tid) for tid in data.tag_ids]
    if data.assignee_ids is not None:
        scheduled_card.assignee_ids = [str(aid) for aid in data.assignee_ids]
    if data.tasks is not None:
        scheduled_card.tasks = data.tasks
    if data.location is not None:
        scheduled_card.location = data.location
    if data.active is not None:
        scheduled_card.active = data.active
    
    await db.commit()
    await db.refresh(scheduled_card)
    
    return scheduled_card


@router.delete("/{scheduled_card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_card(
    scheduled_card_id: UUID,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScheduledCard)
        .where(ScheduledCard.id == scheduled_card_id)
    )
    scheduled_card = result.scalar_one_or_none()
    
    if not scheduled_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled card not found")
    
    await verify_space_access(scheduled_card.space_id, actor.user, db)
    
    await db.delete(scheduled_card)
    await db.commit()


@router.post("/{scheduled_card_id}/trigger", response_model=dict)
async def trigger_scheduled_card(
    scheduled_card_id: UUID,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger a scheduled card to create the card now."""
    result = await db.execute(
        select(ScheduledCard)
        .where(ScheduledCard.id == scheduled_card_id)
    )
    scheduled_card = result.scalar_one_or_none()
    
    if not scheduled_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled card not found")
    
    await verify_space_access(scheduled_card.space_id, actor.user, db)
    
    card = await create_card_from_schedule(db, scheduled_card, actor.user.id)
    
    return {"status": "ok", "card_id": str(card.id)}


@router.post("/process", response_model=dict)
async def process_scheduled_cards(
    space_id: UUID,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    """Process all due scheduled cards for a space. Useful for AI agents."""
    await verify_space_access(space_id, actor.user, db)
    
    now = datetime.now(dt_timezone.utc)
    result = await db.execute(
        select(ScheduledCard)
        .where(
            ScheduledCard.space_id == space_id,
            ScheduledCard.active == True,
            ScheduledCard.next_run <= now,
        )
    )
    scheduled_cards = result.scalars().all()
    
    created_count = 0
    for scheduled_card in scheduled_cards:
        if scheduled_card.end_date and scheduled_card.end_date < now:
            scheduled_card.active = False
            continue
        
        await create_card_from_schedule(db, scheduled_card, actor.user.id)
        scheduled_card.last_run = now
        scheduled_card.next_run = calculate_next_run(now, scheduled_card.interval)
        created_count += 1
    
    await db.commit()
    
    return {"status": "ok", "cards_created": created_count}


async def create_card_from_schedule(db: AsyncSession, scheduled_card: ScheduledCard, user_id: UUID) -> Card:
    """Create a card from a scheduled card template."""
    column_id = scheduled_card.column_id
    
    if column_id:
        result = await db.execute(select(Column).where(Column.id == column_id))
        column = result.scalar_one_or_none()
        if not column:
            column_id = None
    
    if not column_id:
        result = await db.execute(
            select(Column)
            .join(Board)
            .where(
                Board.space_id == scheduled_card.space_id,
                Column.name == scheduled_card.column_name,
            )
        )
        column = result.scalar_one_or_none()
        
        if not column:
            result = await db.execute(
                select(Board).where(Board.space_id == scheduled_card.space_id).order_by(Board.position)
            )
            board = result.scalars().first()
            
            if not board:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No board found in space")
            
            result = await db.execute(
                select(Column).where(Column.board_id == board.id).order_by(Column.position.desc())
            )
            last_column = result.scalars().first()
            
            column = Column(
                board_id=board.id,
                name=scheduled_card.column_name,
                category=ColumnCategory.DEFAULT,
                position=(last_column.position + 1) if last_column else 0,
            )
            db.add(column)
            await db.flush()
        
        scheduled_card.column_id = column.id
    
    result = await db.execute(
        select(Card)
        .where(Card.column_id == column.id)
        .order_by(Card.position.desc())
    )
    last_card = result.scalars().first()
    
    # Set card dates from scheduled card if available
    # Use the scheduled card's start_date as the card's start_date
    # If end_date is set, use it; otherwise default to 1 hour after start
    card_start_date = scheduled_card.start_date
    card_end_date = scheduled_card.end_date
    
    # If only start_date is set (no end_date), default end to 1 hour later
    if card_start_date and not card_end_date:
        card_end_date = card_start_date + timedelta(hours=1)
    
    card = Card(
        column_id=column.id,
        name=scheduled_card.name,
        description=scheduled_card.description,
        location=scheduled_card.location,
        start_date=card_start_date,
        end_date=card_end_date,
        position=(last_card.position + 1) if last_card else 0,
        created_by=user_id,
    )
    db.add(card)
    await db.flush()
    
    if scheduled_card.assignee_ids:
        from app.models.user import User as UserModel
        for aid in scheduled_card.assignee_ids:
            result = await db.execute(select(UserModel).where(UserModel.id == UUID(aid)))
            user = result.scalar_one_or_none()
            if user:
                card.assignees.append(user)
    
    if scheduled_card.tag_ids:
        for tid in scheduled_card.tag_ids:
            card_tag = CardTag(card_id=card.id, tag_id=UUID(tid))
            db.add(card_tag)
    
    if scheduled_card.tasks:
        for i, task_text in enumerate(scheduled_card.tasks):
            task = Task(
                card_id=card.id,
                text=task_text,
                position=i,
            )
            db.add(task)
            card.task_counter += 1
    
    await db.commit()
    await db.refresh(card)
    
    return card
