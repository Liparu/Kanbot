from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.user import User
from app.models.space import Space, SpaceMember
from app.models.tag import Tag
from app.schemas.tag import TagCreate, TagUpdate, TagResponse
from app.api.deps import get_current_user
from app.websocket import manager as ws_manager

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


@router.get("", response_model=List[TagResponse])
async def list_tags(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(space_id, current_user, db)
    
    result = await db.execute(
        select(Tag)
        .where(Tag.space_id == space_id)
        .order_by(Tag.name)
    )
    return result.scalars().all()


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    space_id: UUID,
    tag_data: TagCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(space_id, current_user, db)

    if tag_data.is_predefined:
        existing_result = await db.execute(
            select(Tag).where(
                Tag.space_id == space_id,
                Tag.name == tag_data.name,
                Tag.is_predefined == True,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            # Return existing tag - response_model will handle serialization
            return existing
    
    result = await db.execute(
        select(Tag).where(Tag.space_id == space_id, Tag.name == tag_data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag with this name already exists",
        )
    
    tag = Tag(
        space_id=space_id,
        name=tag_data.name,
        color=tag_data.color,
        is_predefined=tag_data.is_predefined,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    
    await ws_manager.send_tag_created(
        str(space_id),
        {
            "id": str(tag.id),
            "space_id": str(tag.space_id),
            "name": tag.name,
            "color": tag.color,
            "is_predefined": tag.is_predefined,
        },
        str(current_user.id)
    )
    
    return tag


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    tag_data: TagUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    
    await verify_space_access(tag.space_id, current_user, db)
    
    if tag_data.name is not None:
        result = await db.execute(
            select(Tag).where(
                Tag.space_id == tag.space_id,
                Tag.name == tag_data.name,
                Tag.id != tag_id,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tag with this name already exists",
            )
        tag.name = tag_data.name
    
    if tag_data.color is not None:
        tag.color = tag_data.color
    if tag_data.is_predefined is not None:
        tag.is_predefined = tag_data.is_predefined
    
    await db.commit()
    await db.refresh(tag)
    
    await ws_manager.send_tag_updated(
        str(tag.space_id),
        {
            "id": str(tag.id),
            "space_id": str(tag.space_id),
            "name": tag.name,
            "color": tag.color,
            "is_predefined": tag.is_predefined,
        },
        str(current_user.id)
    )
    
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    
    space_id = str(tag.space_id)
    await verify_space_access(tag.space_id, current_user, db)
    
    await db.delete(tag)
    await db.commit()
    
    await ws_manager.send_tag_deleted(space_id, str(tag_id), str(current_user.id))
