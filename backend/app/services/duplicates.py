"""Duplicate detection service for cards"""
from difflib import SequenceMatcher
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card


def calculate_similarity(text1: str, text2: str) -> float:
    """Calculate similarity ratio between two strings.
    
    Returns a float between 0.0 (completely different) and 1.0 (identical).
    """
    if not text1 or not text2:
        return 0.0
    
    # Normalize: lowercase and strip
    t1 = text1.lower().strip()
    t2 = text2.lower().strip()
    
    return SequenceMatcher(None, t1, t2).ratio()


async def find_similar_cards(
    db: AsyncSession,
    name: str,
    space_id: UUID,
    threshold: float = 0.7,
    limit: int = 5,
    exclude_card_id: Optional[UUID] = None,
) -> List[Tuple[Card, float]]:
    """Find cards in the same space with similar names.
    
    Args:
        db: Database session
        name: Card name to compare against
        space_id: Space to search in
        threshold: Minimum similarity ratio (0.0-1.0)
        limit: Maximum number of results
        exclude_card_id: Card ID to exclude (for updates)
    
    Returns:
        List of (Card, similarity_score) tuples, sorted by similarity descending
    """
    # Get all cards in the space
    query = (
        select(Card)
        .join(Card.column)
        .where(Card.column.has(space_id=space_id))
    )
    
    if exclude_card_id:
        query = query.where(Card.id != exclude_card_id)
    
    result = await db.execute(query)
    cards = result.scalars().all()
    
    # Calculate similarity for each card
    similar_cards = []
    for card in cards:
        similarity = calculate_similarity(name, card.name)
        if similarity >= threshold:
            similar_cards.append((card, similarity))
    
    # Sort by similarity (highest first) and limit
    similar_cards.sort(key=lambda x: x[1], reverse=True)
    return similar_cards[:limit]


def format_duplicate_warning(similar_cards: List[Tuple[Card, float]]) -> str:
    """Format a warning message about potential duplicates.
    
    Args:
        similar_cards: List of (Card, similarity) tuples
    
    Returns:
        Formatted warning string
    """
    if not similar_cards:
        return ""
    
    lines = ["⚠️ Potential duplicates found:"]
    for card, score in similar_cards:
        percentage = int(score * 100)
        lines.append(f"  • {card.name} ({percentage}% similar)")
    
    return "\n".join(lines)
