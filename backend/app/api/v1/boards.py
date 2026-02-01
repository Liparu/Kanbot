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
from app.models.column import Column, ColumnCategory
from app.models.card import Card, CardTag
from app.schemas.board import BoardCreate, BoardUpdate, BoardResponse, BoardWithColumnsResponse
from app.api.deps import get_current_user

router = APIRouter()

DEFAULT_COLUMNS = [
    ("Inbox", ColumnCategory.INBOX),
    ("In Progress", ColumnCategory.IN_PROGRESS),
    ("Waiting", ColumnCategory.WAITING),
    ("Review", ColumnCategory.REVIEW),
    ("Archive", ColumnCategory.ARCHIVE),
]


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


@router.get("", response_model=List[BoardResponse])
async def list_boards(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(space_id, current_user, db)
    
    result = await db.execute(
        select(Board)
        .where(Board.space_id == space_id)
        .order_by(Board.position)
    )
    return result.scalars().all()


@router.post("", response_model=BoardResponse, status_code=status.HTTP_201_CREATED)
async def create_board(
    board_data: BoardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_space_access(board_data.space_id, current_user, db)
    
    result = await db.execute(
        select(Board)
        .where(Board.space_id == board_data.space_id)
        .order_by(Board.position.desc())
    )
    last_board = result.scalars().first()
    position = (last_board.position + 1) if last_board else 0
    
    board = Board(
        space_id=board_data.space_id,
        name=board_data.name,
        position=position,
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

    await db.commit()
    await db.refresh(board)
    
    return board


@router.get("/{board_id}", response_model=BoardWithColumnsResponse)
async def get_board(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Board)
        .where(Board.id == board_id)
        .options(
            selectinload(Board.columns)
            .selectinload(Column.cards)
            .selectinload(Card.tasks),
            selectinload(Board.columns)
            .selectinload(Column.cards)
            .selectinload(Card.assignees),
            selectinload(Board.columns)
            .selectinload(Column.cards)
            .selectinload(Card.tags)
            .selectinload(CardTag.tag),
        )
    )
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    
    await verify_space_access(board.space_id, current_user, db)
    
    return board


@router.patch("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: UUID,
    board_data: BoardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    
    await verify_space_access(board.space_id, current_user, db)
    
    if board_data.name is not None:
        board.name = board_data.name
    if board_data.position is not None:
        board.position = board_data.position
    
    await db.commit()
    await db.refresh(board)
    
    return board


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    
    await verify_space_access(board.space_id, current_user, db)
    
    await db.delete(board)
    await db.commit()
