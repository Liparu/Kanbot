from datetime import datetime, timedelta, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import User
from app.models.space import Space, SpaceType
from app.models.card import Card, Comment, Task

router = APIRouter()


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    is_active: bool
    is_admin: bool
    is_banned: bool
    banned_at: Optional[datetime]
    created_at: datetime
    space_count: int = 0

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int


class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_admin: Optional[bool] = None


class BanUserRequest(BaseModel):
    is_banned: bool


class SystemStats(BaseModel):
    total_users: int
    new_users_this_week: int
    new_users_this_month: int
    active_users_7_days: int
    total_spaces: int
    personal_spaces: int
    team_spaces: int
    agent_spaces: int
    total_cards: int
    completed_cards: int
    total_comments: int


@router.get("/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    offset = (page - 1) * page_size
    
    query = select(User)
    count_query = select(func.count(User.id))
    
    if search:
        search_filter = User.email.ilike(f"%{search}%") | User.username.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()
    
    user_responses = []
    for user in users:
        space_count_result = await db.execute(
            select(func.count(Space.id)).where(Space.owner_id == user.id)
        )
        space_count = space_count_result.scalar()
        
        user_responses.append(UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            is_active=user.is_active,
            is_admin=user.is_admin,
            is_banned=user.is_banned,
            banned_at=user.banned_at,
            created_at=user.created_at,
            space_count=space_count,
        ))
    
    return UserListResponse(
        users=user_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    space_count_result = await db.execute(
        select(func.count(Space.id)).where(Space.owner_id == user.id)
    )
    space_count = space_count_result.scalar()
    
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_admin=user.is_admin,
        is_banned=user.is_banned,
        banned_at=user.banned_at,
        created_at=user.created_at,
        space_count=space_count,
    )


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id and data.is_admin is False:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin privileges")
    
    if data.email is not None:
        existing = await db.execute(
            select(User).where(and_(User.email == data.email, User.id != user_id))
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = data.email
    
    if data.username is not None:
        existing = await db.execute(
            select(User).where(and_(User.username == data.username, User.id != user_id))
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already in use")
        user.username = data.username
    
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    
    await db.commit()
    await db.refresh(user)
    
    space_count_result = await db.execute(
        select(func.count(Space.id)).where(Space.owner_id == user.id)
    )
    space_count = space_count_result.scalar()
    
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_admin=user.is_admin,
        is_banned=user.is_banned,
        banned_at=user.banned_at,
        created_at=user.created_at,
        space_count=space_count,
    )


@router.post("/users/{user_id}/ban", response_model=UserResponse)
async def ban_user(
    user_id: UUID,
    data: BanUserRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot ban an admin user")
    
    user.is_banned = data.is_banned
    user.banned_at = datetime.now(timezone.utc) if data.is_banned else None
    
    await db.commit()
    await db.refresh(user)
    
    space_count_result = await db.execute(
        select(func.count(Space.id)).where(Space.owner_id == user.id)
    )
    space_count = space_count_result.scalar()
    
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_admin=user.is_admin,
        is_banned=user.is_banned,
        banned_at=user.banned_at,
        created_at=user.created_at,
        space_count=space_count,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete an admin user")
    
    await db.delete(user)
    await db.commit()


@router.get("/stats", response_model=SystemStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    total_users = (await db.execute(select(func.count(User.id)))).scalar()
    new_users_week = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= week_ago)
    )).scalar()
    new_users_month = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= month_ago)
    )).scalar()
    
    active_users = total_users
    
    total_spaces = (await db.execute(select(func.count(Space.id)))).scalar()
    
    personal_spaces = (await db.execute(
        select(func.count(Space.id)).where(Space.type == SpaceType.PERSONAL)
    )).scalar()
    company_spaces = (await db.execute(
        select(func.count(Space.id)).where(Space.type == SpaceType.COMPANY)
    )).scalar()
    agent_spaces = (await db.execute(
        select(func.count(Space.id)).where(Space.type == SpaceType.AGENT)
    )).scalar()
    
    total_cards = (await db.execute(select(func.count(Card.id)))).scalar()
    
    total_tasks = (await db.execute(select(func.count(Task.id)))).scalar()
    completed_tasks = (await db.execute(
        select(func.count(Task.id)).where(Task.completed == True)
    )).scalar()
    
    total_comments = (await db.execute(select(func.count(Comment.id)))).scalar()
    
    return SystemStats(
        total_users=total_users,
        new_users_this_week=new_users_week,
        new_users_this_month=new_users_month,
        active_users_7_days=active_users,
        total_spaces=total_spaces,
        personal_spaces=personal_spaces,
        team_spaces=company_spaces,
        agent_spaces=agent_spaces,
        total_cards=total_cards,
        completed_cards=completed_tasks,
        total_comments=total_comments,
    )
