from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import date

from app.core.database import get_db
from app.core.sanitize import sanitize_text
from app.models.user import User
from app.models.space import Space, SpaceMember, MemberRole
from app.models.calendar import Calendar
from app.models.board import Board
from app.models.column import Column, ColumnCategory
from app.models.card import Card, CardTag, card_assignees
from app.models.tag import Tag
from app.models.notification import Notification
from app.schemas.space import SpaceCreate, SpaceUpdate, SpaceResponse, SpaceMemberResponse, InviteMember
from app.schemas.space import SpaceStatsResponse
from app.api.deps import get_current_user
from app.websocket import manager as ws_manager

router = APIRouter()

DEFAULT_COLUMNS = [
    ("Inbox", ColumnCategory.INBOX),
    ("In Progress", ColumnCategory.IN_PROGRESS),
    ("Review", ColumnCategory.REVIEW),
    ("Archive", ColumnCategory.ARCHIVE),
]


@router.get("", response_model=List[SpaceResponse])
async def list_spaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Space)
        .join(SpaceMember)
        .where(SpaceMember.user_id == current_user.id)
        .options(selectinload(Space.members).selectinload(SpaceMember.user))
    )
    spaces = result.scalars().unique().all()
    
    response = []
    for space in spaces:
        members_list = [
            SpaceMemberResponse(
                user_id=m.user_id,
                username=m.user.username,
                email=m.user.email,
                role=m.role,
                agent_permissions=m.agent_permissions or {},
                joined_at=m.joined_at,
            )
            for m in space.members
        ]
        response.append(SpaceResponse(
            id=space.id,
            name=space.name,
            type=space.type,
            owner_id=space.owner_id,
            settings=space.settings or {},
            calendar_public=space.calendar_public,
            created_at=space.created_at,
            members=members_list,
        ))
    
    return response


@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
async def create_space(
    space_data: SpaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sanitized_name = sanitize_text(space_data.name)
    if not sanitized_name or not sanitized_name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Space name cannot be empty after sanitization",
        )
    space = Space(
        name=sanitized_name,
        type=space_data.type,
        owner_id=current_user.id,
        settings=space_data.settings or {},
        calendar_public=space_data.calendar_public,
    )
    db.add(space)
    await db.flush()
    
    member = SpaceMember(
        space_id=space.id,
        user_id=current_user.id,
        role=MemberRole.OWNER,
    )
    db.add(member)
    
    calendar = Calendar(space_id=space.id)
    db.add(calendar)

    board = Board(
        space_id=space.id,
        name="Main Board",
        position=0,
    )
    db.add(board)
    await db.flush()

    columns = [
        Column(
            board_id=board.id,
            name=name,
            category=category,
            position=index,
            settings={},
        )
        for index, (name, category) in enumerate(DEFAULT_COLUMNS)
    ]
    db.add_all(columns)
    
    default_tags = [
        Tag(space_id=space.id, name="Urgent", color="#ef4444", is_predefined=True),
        Tag(space_id=space.id, name="Important", color="#f97316", is_predefined=True),
        Tag(space_id=space.id, name="Waiting", color="#eab308", is_predefined=True),
        Tag(space_id=space.id, name="Blocked", color="#ec4899", is_predefined=True),
        Tag(space_id=space.id, name="Scheduled", color="#14b8a6", is_predefined=True),
    ]
    db.add_all(default_tags)
    
    await db.commit()
    
    result = await db.execute(
        select(Space)
        .where(Space.id == space.id)
        .options(selectinload(Space.members).selectinload(SpaceMember.user))
    )
    space = result.scalar_one()
    
    members_list = [
        SpaceMemberResponse(
            user_id=m.user_id,
            username=m.user.username,
            email=m.user.email,
            role=m.role,
            agent_permissions=m.agent_permissions or {},
            joined_at=m.joined_at,
        )
        for m in space.members
    ]
    
    return SpaceResponse(
        id=space.id,
        name=space.name,
        type=space.type,
        owner_id=space.owner_id,
        settings=space.settings or {},
        calendar_public=space.calendar_public,
        created_at=space.created_at,
        members=members_list,
    )


@router.get("/{space_id}", response_model=SpaceResponse)
async def get_space(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Space)
        .where(Space.id == space_id)
        .options(selectinload(Space.members).selectinload(SpaceMember.user))
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    
    is_member = any(m.user_id == current_user.id for m in space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    members_list = [
        SpaceMemberResponse(
            user_id=m.user_id,
            username=m.user.username,
            email=m.user.email,
            role=m.role,
            agent_permissions=m.agent_permissions or {},
            joined_at=m.joined_at,
        )
        for m in space.members
    ]
    
    return SpaceResponse(
        id=space.id,
        name=space.name,
        type=space.type,
        owner_id=space.owner_id,
        settings=space.settings or {},
        calendar_public=space.calendar_public,
        created_at=space.created_at,
        members=members_list,
    )


@router.get("/{space_id}/stats", response_model=SpaceStatsResponse)
async def get_space_stats(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Space)
        .where(Space.id == space_id)
        .options(selectinload(Space.members))
    )
    space = result.scalar_one_or_none()

    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")

    is_member = any(m.user_id == current_user.id for m in space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")

    result = await db.execute(
        select(Column.category, Card.id, Card.end_date)
        .join(Board, Board.id == Column.board_id)
        .join(Card, Card.column_id == Column.id)
        .join(card_assignees, card_assignees.c.card_id == Card.id)
        .where(Board.space_id == space_id, card_assignees.c.user_id == current_user.id)
    )
    rows = result.all()

    card_ids = set(r[1] for r in rows)

    waiting_tag_result = await db.execute(
        select(CardTag.card_id)
        .join(Tag, Tag.id == CardTag.tag_id)
        .where(CardTag.card_id.in_(card_ids), Tag.name == "Waiting")
    )
    waiting_card_ids = set(r[0] for r in waiting_tag_result.all())

    total_cards = 0
    waiting_cards = 0
    urgent_cards = 0
    inbox_cards = 0
    in_progress_cards = 0
    review_cards = 0
    archive_cards = 0

    today = date.today()
    for category, card_id, end_date in rows:
        if category == ColumnCategory.ARCHIVE:
            archive_cards += 1
            continue
        
        total_cards += 1
        if card_id in waiting_card_ids or category == ColumnCategory.WAITING:
            waiting_cards += 1
        if category == ColumnCategory.INBOX:
            inbox_cards += 1
        if category == ColumnCategory.IN_PROGRESS:
            in_progress_cards += 1
        if category == ColumnCategory.REVIEW:
            review_cards += 1
        if end_date:
            end_date_only = end_date.date() if hasattr(end_date, 'date') else end_date
            if end_date_only <= today:
                urgent_cards += 1

    return SpaceStatsResponse(
        space_id=space_id,
        total_cards=total_cards,
        waiting_cards=waiting_cards,
        urgent_cards=urgent_cards,
        inbox_cards=inbox_cards,
        in_progress_cards=in_progress_cards,
        review_cards=review_cards,
        archive_cards=archive_cards,
    )


@router.patch("/{space_id}", response_model=SpaceResponse)
async def update_space(
    space_id: UUID,
    space_data: SpaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Space)
        .where(Space.id == space_id)
        .options(selectinload(Space.members).selectinload(SpaceMember.user))
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    
    member = next((m for m in space.members if m.user_id == current_user.id), None)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    if space_data.name is not None:
        space.name = sanitize_text(space_data.name)
    if space_data.settings is not None:
        space.settings = space_data.settings
    if space_data.calendar_public is not None:
        space.calendar_public = space_data.calendar_public
    
    await db.commit()
    
    result = await db.execute(
        select(Space)
        .where(Space.id == space_id)
        .options(selectinload(Space.members).selectinload(SpaceMember.user))
    )
    space = result.scalar_one()
    
    members_list = [
        SpaceMemberResponse(
            user_id=m.user_id,
            username=m.user.username,
            email=m.user.email,
            role=m.role,
            agent_permissions=m.agent_permissions or {},
            joined_at=m.joined_at,
        )
        for m in space.members
    ]
    
    return SpaceResponse(
        id=space.id,
        name=space.name,
        type=space.type,
        owner_id=space.owner_id,
        settings=space.settings or {},
        calendar_public=space.calendar_public,
        created_at=space.created_at,
        members=members_list,
    )


@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_space(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Space).where(Space.id == space_id))
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    
    if space.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can delete space")
    
    await db.delete(space)
    await db.commit()


@router.post("/{space_id}/invite", response_model=SpaceMemberResponse)
async def invite_member(
    space_id: UUID,
    invite_data: InviteMember,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Space)
        .where(Space.id == space_id)
        .options(selectinload(Space.members))
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    
    is_member = any(m.user_id == current_user.id for m in space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    result = await db.execute(select(User).where(User.email == invite_data.email))
    user_to_invite = result.scalar_one_or_none()
    
    if not user_to_invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    existing = next((m for m in space.members if m.user_id == user_to_invite.id), None)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already a member")
    
    member = SpaceMember(
        space_id=space_id,
        user_id=user_to_invite.id,
        role=invite_data.role,
    )
    db.add(member)
    
    notification = Notification(
        user_id=user_to_invite.id,
        type="space_invite",
        title=f"You've been added to {space.name}",
        message=f"{current_user.username} added you to the space '{space.name}'",
        data={"space_id": str(space_id), "space_name": space.name},
    )
    db.add(notification)
    
    await db.commit()
    await db.refresh(member)
    
    member_response = SpaceMemberResponse(
        user_id=user_to_invite.id,
        username=user_to_invite.username,
        email=user_to_invite.email,
        role=member.role,
        agent_permissions=member.agent_permissions,
        joined_at=member.joined_at,
    )
    
    await ws_manager.send_member_added(
        str(space_id),
        member_response.model_dump(mode='json'),
        str(current_user.id),
    )
    
    return member_response


@router.delete("/{space_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    space_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Space)
        .where(Space.id == space_id)
        .options(selectinload(Space.members))
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    
    current_member = next((m for m in space.members if m.user_id == current_user.id), None)
    if not current_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    if user_id == space.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove space owner")
    
    if user_id != current_user.id and space.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can remove other members")
    
    member_to_remove = next((m for m in space.members if m.user_id == user_id), None)
    if not member_to_remove:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    
    await db.delete(member_to_remove)
    await db.commit()
