from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.user import User
from app.models.space import Space, SpaceMember
from app.models.board import Board
from app.models.column import Column
from app.models.card import Card, CardTag
from app.schemas.column import ColumnCreate, ColumnUpdate, ColumnResponse, ColumnWithCardsResponse
from app.api.deps import get_current_user

router = APIRouter()


async def verify_board_access(board_id: UUID, user: User, db: AsyncSession) -> Board:
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id)
        .options(selectinload(Board.space).selectinload(Space.members))
    )
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    
    is_member = any(m.user_id == user.id for m in board.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    return board


@router.get("", response_model=List[ColumnResponse])
async def list_columns(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_board_access(board_id, current_user, db)
    
    result = await db.execute(
        select(Column)
        .where(Column.board_id == board_id)
        .order_by(Column.position)
    )
    return result.scalars().all()


@router.post("", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED)
async def create_column(
    column_data: ColumnCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_board_access(column_data.board_id, current_user, db)
    
    if column_data.position is None:
        result = await db.execute(
            select(Column)
            .where(Column.board_id == column_data.board_id)
            .order_by(Column.position.desc())
        )
        last_column = result.scalars().first()
        position = (last_column.position + 1) if last_column else 0
    else:
        position = column_data.position
    
    column = Column(
        board_id=column_data.board_id,
        name=column_data.name,
        category=column_data.category,
        position=position,
        settings=column_data.settings or {},
    )
    db.add(column)
    await db.commit()
    await db.refresh(column)
    
    return column


@router.get("/{column_id}", response_model=ColumnWithCardsResponse)
async def get_column(
    column_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Column)
        .where(Column.id == column_id)
        .options(
            selectinload(Column.cards).selectinload(Card.tags).selectinload(CardTag.tag),
            selectinload(Column.cards).selectinload(Card.assignees),
            selectinload(Column.board).selectinload(Board.space).selectinload(Space.members),
        )
    )
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    
    is_member = any(m.user_id == current_user.id for m in column.board.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    return column


@router.patch("/{column_id}", response_model=ColumnResponse)
async def update_column(
    column_id: UUID,
    column_data: ColumnUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Column)
        .where(Column.id == column_id)
        .options(selectinload(Column.board).selectinload(Board.space).selectinload(Space.members))
    )
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    
    is_member = any(m.user_id == current_user.id for m in column.board.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    if column_data.name is not None:
        column.name = column_data.name
    if column_data.category is not None:
        column.category = column_data.category
    if column_data.position is not None:
        column.position = column_data.position
    if column_data.settings is not None:
        column.settings = column_data.settings
    
    await db.commit()
    await db.refresh(column)
    
    return column


@router.delete("/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    column_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Column)
        .where(Column.id == column_id)
        .options(selectinload(Column.board).selectinload(Board.space).selectinload(Space.members))
    )
    column = result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    
    is_member = any(m.user_id == current_user.id for m in column.board.space.members)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this space")
    
    await db.delete(column)
    await db.commit()
