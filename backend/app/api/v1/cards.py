from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import date

from app.core.database import get_db
from app.core.sanitize import sanitize_text
from app.models.user import User
from app.models.space import Space, SpaceMember
from app.models.column import Column, ColumnCategory
from app.models.card import Card, Task, Comment, CardTag, CardDependency, CardHistory
from app.models.tag import Tag
from app.schemas.card import (
    CardCreate,
    CardUpdate,
    CardResponse,
    CardDetailResponse,
    CardMove,
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CardHistoryResponse,
)
from app.api.deps import get_current_user, get_actor_info, ActorInfo
from app.websocket import manager as ws_manager
from app.services.webhooks import dispatch_webhooks
from app.services.notifications import create_notification, serialize_notification

router = APIRouter()


async def verify_card_access(card_id: UUID, user: User, db: AsyncSession) -> Card:
    result = await db.execute(
        select(Card)
        .where(Card.id == card_id)
        .options(
            selectinload(Card.column)
            .selectinload(Column.space)
            .selectinload(Space.members),
            selectinload(Card.assignees),
            selectinload(Card.tags).selectinload(CardTag.tag),
        )
    )
    card = result.scalar_one_or_none()
    
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    
    is_member = any(m.user_id == user.id for m in card.column.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    return card


async def log_card_action(
    db: AsyncSession,
    card: Card,
    action: str,
    changes: dict,
    actor: ActorInfo,
):
    history = CardHistory(
        card_id=card.id,
        action=action,
        changes=changes,
        actor_type=actor.actor_type,
        actor_id=actor.actor_id,
        actor_name=actor.actor_display_name,
    )
    db.add(history)


@router.get("", response_model=List[CardResponse])
async def list_cards(
    space_id: Optional[UUID] = None,
    column_id: Optional[UUID] = None,
    assignee_id: Optional[UUID] = None,
    tag_id: Optional[UUID] = None,
    start_date_from: Optional[date] = None,
    start_date_to: Optional[date] = None,
    end_date_from: Optional[date] = None,
    end_date_to: Optional[date] = None,
    search: Optional[str] = None,
    waiting_only: Optional[bool] = None,
    urgent_only: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Card)
        .join(Column)
        .join(Space, Column.space_id == Space.id)
        .join(SpaceMember)
        .where(SpaceMember.user_id == current_user.id)
        .options(
            selectinload(Card.tags).selectinload(CardTag.tag),
            selectinload(Card.assignees),
        )
    )
    
    if space_id:
        query = query.where(Space.id == space_id)
    if column_id:
        query = query.where(Column.id == column_id)
    if assignee_id:
        query = query.join(Card.assignees).where(User.id == assignee_id)
    if tag_id:
        query = query.join(Card.tags).where(CardTag.tag_id == tag_id)
    if start_date_from:
        query = query.where(Card.start_date >= start_date_from)
    if start_date_to:
        query = query.where(Card.start_date <= start_date_to)
    if end_date_from:
        query = query.where(Card.end_date >= end_date_from)
    if end_date_to:
        query = query.where(Card.end_date <= end_date_to)
    if search:
        query = query.where(
            or_(
                Card.name.ilike(f"%{search}%"),
                Card.description.ilike(f"%{search}%"),
            )
        )
    if waiting_only:
        query = query.where(Column.category == ColumnCategory.WAITING)
    if urgent_only:
        query = query.where(Card.end_date != None, Card.end_date <= date.today())
    
    query = query.order_by(Card.position)
    result = await db.execute(query)
    return result.scalars().unique().all()


@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def create_card(
    card_data: CardCreate,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Column)
        .where(Column.id == card_data.column_id)
        .options(
            selectinload(Column.space)
            .selectinload(Space.members)
        )
    )
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    
    is_member = any(m.user_id == actor.user.id for m in column.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    result = await db.execute(
        select(Card)
        .where(Card.column_id == card_data.column_id)
        .order_by(Card.position.desc())
    )
    last_card = result.scalars().first()
    position = card_data.position if card_data.position is not None else ((last_card.position + 1) if last_card else 0)
    
    start_date = card_data.start_date
    if column.category == ColumnCategory.IN_PROGRESS and not start_date:
        start_date = date.today()
    
    sanitized_name = sanitize_text(card_data.name)
    if not sanitized_name or not sanitized_name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Card name cannot be empty after sanitization",
        )
    
    card = Card(
        column_id=card_data.column_id,
        name=sanitized_name,
        description=sanitize_text(card_data.description),
        start_date=start_date,
        end_date=card_data.end_date,
        location=sanitize_text(card_data.location),
        position=position,
        metadata_json=card_data.metadata_json or {},
        waiting_on=sanitize_text(card_data.waiting_on),
        created_by=actor.user.id,
    )
    db.add(card)
    await db.flush()
    
    if card_data.assignee_ids:
        from app.models.card import card_assignees
        for uid in card_data.assignee_ids:
            await db.execute(card_assignees.insert().values(card_id=card.id, user_id=uid))
    
    if card_data.tag_ids:
        for tag_id in card_data.tag_ids:
            card_tag = CardTag(card_id=card.id, tag_id=tag_id)
            db.add(card_tag)
    
    await log_card_action(db, card, "created", {"name": card.name}, actor)
    
    await db.commit()
    await db.refresh(card)
    await db.refresh(column, attribute_names=["space"])
    await db.refresh(column.space, attribute_names=["members"])
    
    result = await db.execute(
        select(Card)
        .where(Card.id == card.id)
        .options(
            selectinload(Card.tags).selectinload(CardTag.tag),
            selectinload(Card.assignees),
        )
    )
    created_card = result.scalar_one()
    
    space_id = str(column.space.id)
    
    await ws_manager.send_card_created(
        space_id,
        {
            "id": str(created_card.id),
            "column_id": str(created_card.column_id),
            "name": created_card.name,
            "description": created_card.description,
            "start_date": str(created_card.start_date) if created_card.start_date else None,
            "end_date": str(created_card.end_date) if created_card.end_date else None,
            "location": created_card.location,
            "position": created_card.position,
            "task_counter": created_card.task_counter,
            "task_completed_counter": created_card.task_completed_counter,
            "tags": [{"tag": {"id": str(ct.tag.id), "name": ct.tag.name, "color": ct.tag.color}} for ct in created_card.tags],
            "assignees": [{"id": str(u.id), "username": u.username, "email": u.email} for u in created_card.assignees],
        },
        str(actor.user.id)
    )
    if actor.is_agent:
        notify_targets = {
            member.user_id
            for member in column.space.members
            if member.user_id != actor.user.id
        }
        created_notifications = []
        for user_id in notify_targets:
            notification = await create_notification(
                db,
                user_id=user_id,
                notification_type="agent_card_created",
                title=f"{actor.actor_display_name} created a card",
                message=created_card.name,
                data={
                    "card_id": str(created_card.id),
                    "column_id": str(created_card.column_id),
                    "space_id": space_id,
                    "actor_id": actor.actor_id,
                    "actor_name": actor.actor_display_name,
                },
            )
            created_notifications.append(notification)
        if created_notifications:
            await db.commit()
            for notification in created_notifications:
                await db.refresh(notification)
            for notification in created_notifications:
                await ws_manager.send_notification(
                    space_id,
                    serialize_notification(notification),
                )
    await dispatch_webhooks(
        db,
        space_id,
        "card_created",
        {"card_id": str(created_card.id), "column_id": str(created_card.column_id)},
    )
    
    return created_card


@router.get("/{card_id}", response_model=CardDetailResponse)
async def get_card(
    card_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Card)
        .where(Card.id == card_id)
        .options(
            selectinload(Card.tags).selectinload(CardTag.tag),
            selectinload(Card.assignees),
            selectinload(Card.tasks),
            selectinload(Card.comments),
            selectinload(Card.column)
            .selectinload(Column.space)
            .selectinload(Space.members),
        )
    )
    card = result.scalar_one_or_none()
    
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    
    is_member = any(m.user_id == current_user.id for m in card.column.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    return card


@router.patch("/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: UUID,
    card_data: CardUpdate,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    changes = {}
    
    if card_data.name is not None and card_data.name != card.name:
        sanitized_name = sanitize_text(card_data.name)
        changes["name"] = {"old": card.name, "new": sanitized_name}
        card.name = sanitized_name
    if card_data.description is not None:
        card.description = sanitize_text(card_data.description)
    if card_data.start_date is not None:
        card.start_date = card_data.start_date
    if card_data.end_date is not None:
        card.end_date = card_data.end_date
    if card_data.location is not None:
        card.location = sanitize_text(card_data.location)
    if card_data.position is not None:
        card.position = card_data.position
    if card_data.metadata_json is not None:
        card.metadata_json = card_data.metadata_json
    if card_data.waiting_on is not None:
        card.waiting_on = sanitize_text(card_data.waiting_on)
    if card_data.approver_id is not None:
        card.approver_id = card_data.approver_id
    
    if card_data.assignee_ids is not None:
        users_result = await db.execute(
            select(User).where(User.id.in_(card_data.assignee_ids))
        )
        card.assignees = list(users_result.scalars().all())
    
    if card_data.tag_ids is not None:
        await db.execute(
            CardTag.__table__.delete().where(CardTag.card_id == card.id)
        )
        if card_data.tag_ids:
            db.add_all([CardTag(card_id=card.id, tag_id=tag_id) for tag_id in card_data.tag_ids])
    
    if changes:
        await log_card_action(db, card, "updated", changes, actor)
    
    await db.commit()
    
    # Refresh the card to pick up updated relationships
    await db.refresh(card, attribute_names=["tags", "assignees", "column"])
    for ct in card.tags:
        await db.refresh(ct, attribute_names=["tag"])
    await db.refresh(card.column, attribute_names=["space"])
    await db.refresh(card.column.space, attribute_names=["members"])
    updated_card = card
    space_id = str(updated_card.column.space.id)
    
    await ws_manager.send_card_updated(
        space_id,
        {
            "id": str(updated_card.id),
            "column_id": str(updated_card.column_id),
            "name": updated_card.name,
            "description": updated_card.description,
            "start_date": str(updated_card.start_date) if updated_card.start_date else None,
            "end_date": str(updated_card.end_date) if updated_card.end_date else None,
            "location": updated_card.location,
            "position": updated_card.position,
            "task_counter": updated_card.task_counter,
            "task_completed_counter": updated_card.task_completed_counter,
            "tags": [{"tag": {"id": str(ct.tag.id), "name": ct.tag.name, "color": ct.tag.color}} for ct in updated_card.tags],
            "assignees": [{"id": str(u.id), "username": u.username, "email": u.email} for u in updated_card.assignees],
        },
        str(actor.user.id)
    )
    if actor.is_agent:
        notify_targets = {
            member.user_id
            for member in updated_card.column.space.members
            if member.user_id != actor.user.id
        }
        created_notifications = []
        for user_id in notify_targets:
            notification = await create_notification(
                db,
                user_id=user_id,
                notification_type="agent_card_updated",
                title=f"{actor.actor_display_name} updated a card",
                message=updated_card.name,
                data={
                    "card_id": str(updated_card.id),
                    "column_id": str(updated_card.column_id),
                    "space_id": space_id,
                    "actor_id": actor.actor_id,
                    "actor_name": actor.actor_display_name,
                },
            )
            created_notifications.append(notification)
        if created_notifications:
            await db.commit()
            for notification in created_notifications:
                await db.refresh(notification)
            for notification in created_notifications:
                await ws_manager.send_notification(
                    space_id,
                    serialize_notification(notification),
                )
    await dispatch_webhooks(
        db,
        space_id,
        "card_updated",
        {"card_id": str(updated_card.id), "column_id": str(updated_card.column_id)},
    )
    
    return updated_card


@router.post("/{card_id}/move", response_model=CardResponse)
async def move_card(
    card_id: UUID,
    move_data: CardMove,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    
    result = await db.execute(
        select(Column)
        .where(Column.id == move_data.column_id)
        .options(
            selectinload(Column.space)
            .selectinload(Space.members)
        )
    )
    target_column = result.scalar_one_or_none()
    
    if not target_column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target column not found")
    
    is_member = any(m.user_id == actor.user.id for m in target_column.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of target space")
    
    old_column_id = card.column_id
    
    if target_column.category == ColumnCategory.ARCHIVE:
        card.last_column_id = card.column_id
    
    if target_column.category == ColumnCategory.IN_PROGRESS and not card.start_date:
        card.start_date = date.today()
    
    card.column_id = move_data.column_id
    if move_data.position is not None:
        card.position = move_data.position
    
    await log_card_action(
        db, card, "moved",
        {"from_column": str(old_column_id), "to_column": str(move_data.column_id)},
        actor
    )
    
    await db.commit()
    
    space_id = str(target_column.space.id)
    
    await ws_manager.send_card_moved(
        space_id,
        str(card_id),
        str(old_column_id),
        str(move_data.column_id),
        move_data.position or 0,
        str(actor.user.id)
    )
    if actor.is_agent:
        notify_targets = {
            member.user_id
            for member in target_column.space.members
            if member.user_id != actor.user.id
        }
        created_notifications = []
        for user_id in notify_targets:
            notification = await create_notification(
                db,
                user_id=user_id,
                notification_type="agent_card_moved",
                title=f"{actor.actor_display_name} moved a card",
                message=card.name,
                data={
                    "card_id": str(card.id),
                    "from_column": str(old_column_id),
                    "to_column": str(move_data.column_id),
                    "space_id": space_id,
                    "actor_id": actor.actor_id,
                    "actor_name": actor.actor_display_name,
                },
            )
            created_notifications.append(notification)
        if created_notifications:
            await db.commit()
            for notification in created_notifications:
                await db.refresh(notification)
            for notification in created_notifications:
                await ws_manager.send_notification(
                    space_id,
                    serialize_notification(notification),
                )
    await dispatch_webhooks(
        db,
        space_id,
        "card_moved",
        {
            "card_id": str(card_id),
            "from_column": str(old_column_id),
            "to_column": str(move_data.column_id),
            "position": move_data.position or 0,
        },
    )
    
    result = await db.execute(
        select(Card)
        .where(Card.id == card.id)
        .options(
            selectinload(Card.tags).selectinload(CardTag.tag),
            selectinload(Card.assignees),
        )
    )
    return result.scalar_one()


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: UUID,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    column_id = card.column_id
    space_id = str(card.column.space.id)
    
    await db.delete(card)
    await db.commit()
    
    await ws_manager.send_card_deleted(space_id, str(card_id), str(column_id), str(actor.user.id))
    if actor.is_agent:
        notify_targets = {
            member.user_id
            for member in card.column.space.members
            if member.user_id != actor.user.id
        }
        created_notifications = []
        for user_id in notify_targets:
            notification = await create_notification(
                db,
                user_id=user_id,
                notification_type="agent_card_deleted",
                title=f"{actor.actor_display_name} deleted a card",
                message=card.name,
                data={
                    "card_id": str(card.id),
                    "column_id": str(column_id),
                    "space_id": space_id,
                    "actor_id": actor.actor_id,
                    "actor_name": actor.actor_display_name,
                },
            )
            created_notifications.append(notification)
        if created_notifications:
            await db.commit()
            for notification in created_notifications:
                await db.refresh(notification)
            for notification in created_notifications:
                await ws_manager.send_notification(
                    space_id,
                    serialize_notification(notification),
                )
    await dispatch_webhooks(
        db,
        space_id,
        "card_deleted",
        {"card_id": str(card_id), "column_id": str(column_id)},
    )


@router.post("/{card_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def add_task(
    card_id: UUID,
    task_data: TaskCreate,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    space_id = str(card.column.space.id)
    
    result = await db.execute(
        select(Task)
        .where(Task.card_id == card_id)
        .order_by(Task.position.desc())
    )
    last_task = result.scalars().first()
    position = task_data.position if task_data.position is not None else ((last_task.position + 1) if last_task else 0)
    
    task = Task(
        card_id=card_id,
        text=sanitize_text(task_data.text),
        position=position,
    )
    db.add(task)
    
    card.task_counter += 1
    
    await db.commit()
    await db.refresh(task)
    
    await ws_manager.send_task_created(
        space_id,
        str(card_id),
        {
            "id": str(task.id),
            "card_id": str(task.card_id),
            "text": task.text,
            "completed": task.completed,
            "position": task.position,
        },
        str(actor.user.id)
    )
    
    return task


@router.patch("/{card_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    card_id: UUID,
    task_id: UUID,
    task_data: TaskUpdate,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    space_id = str(card.column.space.id)
    
    result = await db.execute(select(Task).where(Task.id == task_id, Task.card_id == card_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    if task_data.text is not None:
        task.text = sanitize_text(task_data.text)
    if task_data.position is not None:
        task.position = task_data.position
    if task_data.completed is not None:
        if task_data.completed and not task.completed:
            card.task_completed_counter += 1
        elif not task_data.completed and task.completed:
            card.task_completed_counter -= 1
        task.completed = task_data.completed
    
    await db.commit()
    await db.refresh(task)
    
    await ws_manager.send_task_updated(
        space_id,
        str(card_id),
        {
            "id": str(task.id),
            "card_id": str(task.card_id),
            "text": task.text,
            "completed": task.completed,
            "position": task.position,
        },
        str(actor.user.id)
    )
    
    return task


@router.delete("/{card_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    card_id: UUID,
    task_id: UUID,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    space_id = str(card.column.space.id)
    
    result = await db.execute(select(Task).where(Task.id == task_id, Task.card_id == card_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    card.task_counter -= 1
    if task.completed:
        card.task_completed_counter -= 1
    
    await db.delete(task)
    await db.commit()
    
    await ws_manager.send_task_deleted(
        space_id,
        str(card_id),
        str(task_id),
        str(actor.user.id)
    )


@router.post("/{card_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    card_id: UUID,
    comment_data: CommentCreate,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    space_id = str(card.column.space.id)
    
    comment = Comment(
        card_id=card_id,
        user_id=actor.user.id,
        content=sanitize_text(comment_data.content),
        actor_type=actor.actor_type,
        actor_name=actor.actor_display_name,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    comment_data_ws = {
        "id": str(comment.id),
        "card_id": str(comment.card_id),
        "user_id": str(comment.user_id),
        "content": comment.content,
        "actor_type": comment.actor_type,
        "actor_name": comment.actor_name,
        "is_edited": comment.is_edited,
        "is_deleted": comment.is_deleted,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }
    await ws_manager.send_comment_created(space_id, str(card_id), comment_data_ws, str(actor.user.id))

    if actor.is_agent:
        notify_targets = {
            member.user_id
            for member in card.column.space.members
            if member.user_id != actor.user.id
        }
        created_notifications = []
        for user_id in notify_targets:
            notification = await create_notification(
                db,
                user_id=user_id,
                notification_type="agent_comment_added",
                title=f"{actor.actor_display_name} commented on a card",
                message=comment.content[:200],
                data={
                    "card_id": str(card.id),
                    "column_id": str(card.column_id),
                    "space_id": space_id,
                    "comment_id": str(comment.id),
                    "actor_id": actor.actor_id,
                    "actor_name": actor.actor_display_name,
                },
            )
            created_notifications.append(notification)
        if created_notifications:
            await db.commit()
            for notification in created_notifications:
                await db.refresh(notification)
            for notification in created_notifications:
                await ws_manager.send_notification(
                    space_id,
                    serialize_notification(notification),
                )
    
    return comment


@router.patch("/{card_id}/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    card_id: UUID,
    comment_id: UUID,
    comment_data: CommentUpdate,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    space_id = str(card.column.space.id)
    
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.card_id == card_id)
    )
    comment = result.scalar_one_or_none()
    
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    
    if comment.user_id != actor.user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only edit your own comments")
    
    if comment.is_deleted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot edit a deleted comment")
    
    comment.content = sanitize_text(comment_data.content)
    comment.is_edited = True
    await db.commit()
    await db.refresh(comment)
    
    comment_data_ws = {
        "id": str(comment.id),
        "card_id": str(comment.card_id),
        "user_id": str(comment.user_id),
        "content": comment.content,
        "actor_type": comment.actor_type,
        "actor_name": comment.actor_name,
        "is_edited": comment.is_edited,
        "is_deleted": comment.is_deleted,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }
    await ws_manager.send_comment_updated(space_id, str(card_id), comment_data_ws, str(actor.user.id))
    
    return comment


@router.delete("/{card_id}/comments/{comment_id}", response_model=CommentResponse)
async def delete_comment(
    card_id: UUID,
    comment_id: UUID,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    card = await verify_card_access(card_id, actor.user, db)
    space_id = str(card.column.space.id)
    
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.card_id == card_id)
    )
    comment = result.scalar_one_or_none()
    
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    
    if comment.user_id != actor.user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only delete your own comments")
    
    comment.content = "[deleted]"
    comment.is_deleted = True
    await db.commit()
    await db.refresh(comment)
    
    comment_data_ws = {
        "id": str(comment.id),
        "card_id": str(comment.card_id),
        "user_id": str(comment.user_id),
        "content": comment.content,
        "actor_type": comment.actor_type,
        "actor_name": comment.actor_name,
        "is_edited": comment.is_edited,
        "is_deleted": comment.is_deleted,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }
    await ws_manager.send_comment_deleted(space_id, str(card_id), comment_data_ws, str(actor.user.id))
    
    return comment


@router.get("/{card_id}/history", response_model=List[CardHistoryResponse])
async def get_card_history(
    card_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_card_access(card_id, current_user, db)
    
    result = await db.execute(
        select(CardHistory)
        .where(CardHistory.card_id == card_id)
        .order_by(CardHistory.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{card_id}/dependencies/{blocked_by_id}", status_code=status.HTTP_201_CREATED)
async def add_dependency(
    card_id: UUID,
    blocked_by_id: UUID,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    await verify_card_access(card_id, actor.user, db)
    await verify_card_access(blocked_by_id, actor.user, db)
    
    if card_id == blocked_by_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Card cannot block itself")
    
    result = await db.execute(
        select(CardDependency).where(
            CardDependency.card_id == card_id,
            CardDependency.blocked_by_id == blocked_by_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dependency already exists")
    
    dependency = CardDependency(card_id=card_id, blocked_by_id=blocked_by_id)
    db.add(dependency)
    await db.commit()
    
    return {"status": "ok"}


@router.delete("/{card_id}/dependencies/{blocked_by_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_dependency(
    card_id: UUID,
    blocked_by_id: UUID,
    actor: ActorInfo = Depends(get_actor_info),
    db: AsyncSession = Depends(get_db),
):
    await verify_card_access(card_id, actor.user, db)
    
    result = await db.execute(
        select(CardDependency).where(
            CardDependency.card_id == card_id,
            CardDependency.blocked_by_id == blocked_by_id,
        )
    )
    dependency = result.scalar_one_or_none()
    
    if not dependency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")
    
    await db.delete(dependency)
    await db.commit()
