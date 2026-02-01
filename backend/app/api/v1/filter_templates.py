from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.user import User
from app.models.space import SpaceMember
from app.models.filter_template import FilterTemplate
from app.schemas.filter_template import FilterTemplateCreate, FilterTemplateUpdate, FilterTemplateResponse
from app.api.deps import get_current_user

router = APIRouter()


async def verify_space_access(space_id: UUID, user: User, db: AsyncSession) -> None:
    result = await db.execute(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")


@router.get("", response_model=List[FilterTemplateResponse])
async def list_filter_templates(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(space_id, current_user, db)
    result = await db.execute(
        select(FilterTemplate)
        .where(FilterTemplate.space_id == space_id)
        .order_by(FilterTemplate.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=FilterTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_filter_template(
    template_data: FilterTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(template_data.space_id, current_user, db)
    template = FilterTemplate(
        space_id=template_data.space_id,
        name=template_data.name,
        filters=template_data.filters or {},
        created_by=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.patch("/{template_id}", response_model=FilterTemplateResponse)
async def update_filter_template(
    template_id: UUID,
    template_data: FilterTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FilterTemplate).where(FilterTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter template not found")
    await verify_space_access(template.space_id, current_user, db)
    if template_data.name is not None:
        template.name = template_data.name
    if template_data.filters is not None:
        template.filters = template_data.filters
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filter_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FilterTemplate).where(FilterTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter template not found")
    await verify_space_access(template.space_id, current_user, db)
    await db.delete(template)
    await db.commit()