from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.space import Space, SpaceMember
from app.models.column import Column
from app.models.card import Card

router = APIRouter()


class SearchCardResult(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    space_id: UUID
    space_name: str
    column_name: str
    
    class Config:
        from_attributes = True


class SearchSpaceResult(BaseModel):
    id: UUID
    name: str
    type: str
    
    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    cards: List[SearchCardResult] = Field(default_factory=list)
    spaces: List[SearchSpaceResult] = Field(default_factory=list)
    total_cards: int = 0
    total_spaces: int = 0


@router.get("/search", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=2, max_length=200),
    types: List[str] = Query(default=["cards", "spaces"]),
    space_id: Optional[UUID] = None,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_space_ids_result = await db.execute(
        select(Space.id).where(
            or_(
                Space.owner_id == current_user.id,
                Space.id.in_(
                    select(SpaceMember.space_id).where(SpaceMember.user_id == current_user.id)
                )
            )
        )
    )
    user_space_ids = [row[0] for row in user_space_ids_result.fetchall()]
    
    if not user_space_ids:
        return SearchResponse()
    
    if space_id and space_id not in user_space_ids:
        return SearchResponse()
    
    search_space_ids = [space_id] if space_id else user_space_ids
    search_term = f"%{q}%"
    
    response = SearchResponse()
    
    if "cards" in types:
        cards_query = (
            select(Card, Column.name.label('column_name'), Space.name.label('space_name'), Space.id.label('space_id'))
            .join(Column, Card.column_id == Column.id)
            .join(Space, Column.space_id == Space.id)
            .where(
                Space.id.in_(search_space_ids),
                or_(
                    Card.name.ilike(search_term),
                    Card.description.ilike(search_term)
                )
            )
            .limit(limit)
        )
        
        cards_result = await db.execute(cards_query)
        for row in cards_result.fetchall():
            card, column_name, space_name, space_id = row
            response.cards.append(SearchCardResult(
                id=card.id,
                name=card.name,
                description=card.description[:100] if card.description else None,
                space_id=space_id,
                space_name=space_name,
                column_name=column_name,
            ))
        response.total_cards = len(response.cards)
    
    if "spaces" in types:
        spaces_query = (
            select(Space)
            .where(
                Space.id.in_(search_space_ids),
                Space.name.ilike(search_term)
            )
            .limit(limit)
        )
        
        spaces_result = await db.execute(spaces_query)
        for space in spaces_result.scalars():
            response.spaces.append(SearchSpaceResult(
                id=space.id,
                name=space.name,
                type=space.type.value,
            ))
        response.total_spaces = len(response.spaces)
    
    return response
