from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.models.user import User
from app.models.space import Space
from app.models.board import Board
from app.models.column import Column
from app.models.card import Card, CardHistory
from app.services.notifications import create_notification, serialize_notification
from app.api.deps import get_current_user, get_actor_info, ActorInfo
from app.websocket import manager as ws_manager

router = APIRouter()


class AgentInfo(BaseModel):
    user_id: UUID
    username: str
    agent_name: str
    is_agent: bool


class ActionReference(BaseModel):
    endpoint: str
    method: str
    description: str


class DelegateTask(BaseModel):
    target_user_id: UUID
    card_id: UUID
    message: Optional[str] = None
    space_id: Optional[UUID] = None
    metadata: Optional[dict] = None


@router.get("/me", response_model=AgentInfo)
async def get_agent_info(actor: ActorInfo = Depends(get_actor_info)):
    return AgentInfo(
        user_id=actor.user.id,
        username=actor.user.username,
        agent_name=actor.actor_display_name,
        is_agent=actor.is_agent,
    )


@router.get("/actions", response_model=List[ActionReference])
async def get_available_actions():
    return [
        ActionReference(endpoint="/api/v1/spaces", method="GET", description="List all spaces the agent has access to"),
        ActionReference(endpoint="/api/v1/spaces", method="POST", description="Create a new space"),
        ActionReference(endpoint="/api/v1/boards?space_id={id}", method="GET", description="List boards in a space"),
        ActionReference(endpoint="/api/v1/boards", method="POST", description="Create a new board"),
        ActionReference(endpoint="/api/v1/columns?board_id={id}", method="GET", description="List columns in a board"),
        ActionReference(endpoint="/api/v1/columns", method="POST", description="Create a new column"),
        ActionReference(endpoint="/api/v1/cards", method="GET", description="List cards with optional filters"),
        ActionReference(endpoint="/api/v1/cards", method="POST", description="Create a new card"),
        ActionReference(endpoint="/api/v1/cards/{id}", method="GET", description="Get card details including tasks and comments"),
        ActionReference(endpoint="/api/v1/cards/{id}", method="PATCH", description="Update a card"),
        ActionReference(endpoint="/api/v1/cards/{id}/move", method="POST", description="Move a card to another column"),
        ActionReference(endpoint="/api/v1/cards/{id}/tasks", method="POST", description="Add a task to a card"),
        ActionReference(endpoint="/api/v1/cards/{id}/tasks/{task_id}", method="PATCH", description="Update/toggle a task"),
        ActionReference(endpoint="/api/v1/cards/{id}/comments", method="POST", description="Add a comment to a card"),
        ActionReference(endpoint="/api/v1/cards/{id}/history", method="GET", description="Get card history/audit log"),
        ActionReference(endpoint="/api/v1/tags?space_id={id}", method="GET", description="List tags in a space"),
        ActionReference(endpoint="/api/v1/tags?space_id={id}", method="POST", description="Create a new tag"),
        ActionReference(endpoint="/api/v1/calendar/events", method="GET", description="List calendar events"),
        ActionReference(endpoint="/api/v1/calendar/events", method="POST", description="Create a calendar event"),
        ActionReference(endpoint="/api/v1/webhooks?space_id={id}", method="GET", description="List webhooks for a space"),
        ActionReference(endpoint="/api/v1/webhooks", method="POST", description="Create a webhook"),
        ActionReference(endpoint="/api/v1/scheduled-cards?space_id={id}", method="GET", description="List scheduled/recurring cards"),
        ActionReference(endpoint="/api/v1/scheduled-cards", method="POST", description="Create a scheduled card (recurring task)"),
        ActionReference(endpoint="/api/v1/scheduled-cards/{id}", method="PATCH", description="Update a scheduled card"),
        ActionReference(endpoint="/api/v1/scheduled-cards/{id}", method="DELETE", description="Delete a scheduled card"),
        ActionReference(endpoint="/api/v1/scheduled-cards/{id}/trigger", method="POST", description="Manually trigger a scheduled card to create card now"),
        ActionReference(endpoint="/api/v1/scheduled-cards/process?space_id={id}", method="POST", description="Process all due scheduled cards in a space (batch)"),
    ]


@router.get("/audit", response_model=List[dict])
async def query_audit_logs(
    space_id: Optional[UUID] = None,
    card_id: Optional[UUID] = None,
    actor_type: Optional[str] = None,
    since: Optional[datetime] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(CardHistory)
    
    if card_id:
        query = query.where(CardHistory.card_id == card_id)
    if space_id:
        space_result = await db.execute(
            select(Space)
            .where(Space.id == space_id)
            .options(selectinload(Space.members))
        )
        space = space_result.scalar_one_or_none()
        if not space:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Space not found",
            )
        is_member = any(m.user_id == current_user.id for m in space.members)
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this space",
            )
        query = (
            query.join(Card, Card.id == CardHistory.card_id)
            .join(Column, Column.id == Card.column_id)
            .join(Board, Board.id == Column.board_id)
            .where(Board.space_id == space_id)
        )
    if actor_type:
        query = query.where(CardHistory.actor_type == actor_type)
    if since:
        query = query.where(CardHistory.created_at >= since)
    
    query = query.order_by(CardHistory.created_at.desc()).limit(limit)
    result = await db.execute(query)
    
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "card_id": str(log.card_id),
            "action": log.action,
            "changes": log.changes,
            "actor_type": log.actor_type,
            "actor_id": log.actor_id,
            "actor_name": log.actor_name,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.post("/delegate")
async def delegate_task(
    delegate_data: DelegateTask,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    if not actor.is_agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents can delegate tasks",
        )
    
    target_user = await db.execute(select(User).where(User.id == delegate_data.target_user_id))
    target_user = target_user.scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found",
        )

    space_id = delegate_data.space_id
    if space_id:
        space_result = await db.execute(
            select(Space)
            .where(Space.id == space_id)
            .options(selectinload(Space.members))
        )
        space = space_result.scalar_one_or_none()
        if not space:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Space not found",
            )
        is_member = any(m.user_id == target_user.id for m in space.members)
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Target user is not a member of the space",
            )

    notification = await create_notification(
        db,
        user_id=delegate_data.target_user_id,
        notification_type="agent_delegation_request",
        title=f"{actor.actor_display_name} delegated a task",
        message=delegate_data.message,
        data={
            "card_id": str(delegate_data.card_id),
            "space_id": str(space_id) if space_id else None,
            "actor_id": actor.actor_id,
            "actor_name": actor.actor_display_name,
            "metadata": delegate_data.metadata or {},
        },
    )

    await db.commit()
    await db.refresh(notification)
    if space_id:
        await ws_manager.send_notification(
            str(space_id),
            serialize_notification(notification),
        )

    return {
        "status": "ok",
        "message": f"Task delegation request sent to user {delegate_data.target_user_id}",
        "card_id": str(delegate_data.card_id),
        "notification_id": str(notification.id),
    }
