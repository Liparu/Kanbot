from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
import secrets

from app.core.database import get_db
from app.models.user import User
from app.models.space import Space, SpaceMember
from app.models.webhook import Webhook, WebhookLog
from app.schemas.webhook import WebhookCreate, WebhookUpdate, WebhookResponse, WebhookLogResponse
from app.api.deps import get_current_user

router = APIRouter()


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


@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(space_id, current_user, db)
    
    result = await db.execute(
        select(Webhook).where(Webhook.space_id == space_id)
    )
    return result.scalars().all()


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    webhook_data: WebhookCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(webhook_data.space_id, current_user, db)
    
    webhook = Webhook(
        space_id=webhook_data.space_id,
        url=webhook_data.url,
        events=webhook_data.events,
        secret=webhook_data.secret or secrets.token_urlsafe(32),
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    
    return webhook


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: UUID,
    webhook_data: WebhookUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    
    await verify_space_access(webhook.space_id, current_user, db)
    
    if webhook_data.url is not None:
        webhook.url = webhook_data.url
    if webhook_data.events is not None:
        webhook.events = webhook_data.events
    if webhook_data.secret is not None:
        webhook.secret = webhook_data.secret
    if webhook_data.active is not None:
        webhook.active = webhook_data.active
    
    await db.commit()
    await db.refresh(webhook)
    
    return webhook


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    
    await verify_space_access(webhook.space_id, current_user, db)
    
    await db.delete(webhook)
    await db.commit()


@router.get("/{webhook_id}/logs", response_model=List[WebhookLogResponse])
async def get_webhook_logs(
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    
    await verify_space_access(webhook.space_id, current_user, db)
    
    result = await db.execute(
        select(WebhookLog)
        .where(WebhookLog.webhook_id == webhook_id)
        .order_by(WebhookLog.created_at.desc())
        .limit(100)
    )
    return result.scalars().all()
