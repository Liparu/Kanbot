"""
Analytics API for Kanbot

Provides metrics and insights about cards, columns, and workflow efficiency.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.card import Card, CardHistory
from app.models.column import Column
from app.models.space import Space

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/cards/{card_id}/time-in-columns")
async def get_card_time_in_columns(
    card_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate how long a card has spent in each column.
    
    Returns time breakdown by column based on card history.
    """
    # Get card with history and column
    result = await db.execute(
        select(Card)
        .options(joinedload(Card.history), joinedload(Card.column))
        .where(Card.id == card_id)
    )
    card = result.unique().scalar_one_or_none()
    
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Get space_id from the card's column
    space_id = card.column.space_id
    
    # Get column names for this space
    columns_result = await db.execute(
        select(Column).where(Column.space_id == space_id)
    )
    columns = {str(c.id): c.name for c in columns_result.scalars().all()}
    
    # Parse history to find column transitions
    column_times: dict[str, timedelta] = {}
    current_column_id = str(card.column_id)
    last_transition_time = card.created_at
    
    # Sort history by created_at ascending
    sorted_history = sorted(card.history, key=lambda h: h.created_at)
    
    for entry in sorted_history:
        if entry.action == "moved" and entry.changes:
            old_column = entry.changes.get("old_column_id")
            new_column = entry.changes.get("new_column_id")
            
            if old_column and new_column:
                # Calculate time in old column
                time_spent = entry.created_at - last_transition_time
                
                if old_column not in column_times:
                    column_times[old_column] = timedelta()
                column_times[old_column] += time_spent
                
                last_transition_time = entry.created_at
                current_column_id = new_column
    
    # Add time in current column
    now = datetime.now(timezone.utc)
    time_in_current = now - last_transition_time
    
    if current_column_id not in column_times:
        column_times[current_column_id] = timedelta()
    column_times[current_column_id] += time_in_current
    
    # Format response
    time_breakdown = []
    total_time = timedelta()
    
    for col_id, duration in column_times.items():
        total_time += duration
        time_breakdown.append({
            "column_id": col_id,
            "column_name": columns.get(col_id, "Unknown"),
            "duration_seconds": int(duration.total_seconds()),
            "duration_human": format_duration(duration),
        })
    
    # Sort by duration descending
    time_breakdown.sort(key=lambda x: x["duration_seconds"], reverse=True)
    
    return {
        "card_id": str(card_id),
        "card_name": card.name,
        "current_column": columns.get(current_column_id, "Unknown"),
        "total_age_seconds": int(total_time.total_seconds()),
        "total_age_human": format_duration(total_time),
        "created_at": card.created_at.isoformat(),
        "time_breakdown": time_breakdown,
    }


@router.get("/spaces/{space_id}/cycle-time")
async def get_space_cycle_time(
    space_id: UUID,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate average cycle time for cards in a space.
    
    Cycle time = time from card creation to moving to done/archive column.
    """
    # Get space
    result = await db.execute(select(Space).where(Space.id == space_id))
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Get columns to identify "done" columns (typically last position or named "Done", "Archive", etc.)
    columns_result = await db.execute(
        select(Column)
        .where(Column.space_id == space_id)
        .order_by(Column.position.desc())
    )
    columns = columns_result.scalars().all()
    
    # Find done/archive columns (last 2 columns by position, or by name pattern)
    done_column_ids = []
    for col in columns[:2]:  # Last 2 columns
        done_column_ids.append(str(col.id))
    
    # Also add columns with "done", "archive", "hotovo" in name
    for col in columns:
        if any(kw in col.name.lower() for kw in ["done", "archive", "hotovo", "dokončen"]):
            if str(col.id) not in done_column_ids:
                done_column_ids.append(str(col.id))
    
    # Get cards that are in done columns and were created in the time range
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Join with Column to filter by space
    cards_result = await db.execute(
        select(Card)
        .options(joinedload(Card.history))
        .join(Column, Card.column_id == Column.id)
        .where(
            and_(
                Column.space_id == space_id,
                Card.column_id.in_([UUID(cid) for cid in done_column_ids]),
                Card.created_at >= cutoff,
            )
        )
    )
    cards = cards_result.unique().scalars().all()
    
    if not cards:
        return {
            "space_id": str(space_id),
            "space_name": space.name,
            "period_days": days,
            "completed_cards": 0,
            "average_cycle_time_seconds": None,
            "average_cycle_time_human": "N/A",
            "message": "No completed cards in this period",
        }
    
    # Calculate cycle time for each card
    cycle_times = []
    
    for card in cards:
        # Find when card moved to done column
        done_time = None
        sorted_history = sorted(card.history, key=lambda h: h.created_at)
        
        for entry in sorted_history:
            if entry.action == "moved" and entry.changes:
                new_column = entry.changes.get("new_column_id")
                if new_column in done_column_ids:
                    done_time = entry.created_at
                    break
        
        if done_time:
            cycle_time = done_time - card.created_at
            cycle_times.append(cycle_time.total_seconds())
    
    if not cycle_times:
        return {
            "space_id": str(space_id),
            "space_name": space.name,
            "period_days": days,
            "completed_cards": len(cards),
            "average_cycle_time_seconds": None,
            "average_cycle_time_human": "N/A",
            "message": "Could not calculate cycle times (no move history)",
        }
    
    avg_seconds = sum(cycle_times) / len(cycle_times)
    avg_duration = timedelta(seconds=avg_seconds)
    
    return {
        "space_id": str(space_id),
        "space_name": space.name,
        "period_days": days,
        "completed_cards": len(cycle_times),
        "average_cycle_time_seconds": int(avg_seconds),
        "average_cycle_time_human": format_duration(avg_duration),
        "min_cycle_time_seconds": int(min(cycle_times)),
        "max_cycle_time_seconds": int(max(cycle_times)),
    }


@router.get("/spaces/{space_id}/throughput")
async def get_space_throughput(
    space_id: UUID,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate card throughput for a space.
    
    Shows how many cards were completed per day/week.
    """
    # Get space
    result = await db.execute(select(Space).where(Space.id == space_id))
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Get done columns
    columns_result = await db.execute(
        select(Column)
        .where(Column.space_id == space_id)
        .order_by(Column.position.desc())
    )
    columns = columns_result.scalars().all()
    
    done_column_ids = []
    for col in columns[:2]:
        done_column_ids.append(col.id)
    for col in columns:
        if any(kw in col.name.lower() for kw in ["done", "archive", "hotovo", "dokončen"]):
            if col.id not in done_column_ids:
                done_column_ids.append(col.id)
    
    # Count cards completed per day
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get completed cards with their completion dates from history
    # Join with Column to filter by space
    cards_result = await db.execute(
        select(Card)
        .options(joinedload(Card.history))
        .join(Column, Card.column_id == Column.id)
        .where(
            and_(
                Column.space_id == space_id,
                Card.column_id.in_(done_column_ids),
            )
        )
    )
    cards = cards_result.unique().scalars().all()
    
    # Group by completion date
    daily_completions: dict[str, int] = {}
    
    for card in cards:
        sorted_history = sorted(card.history, key=lambda h: h.created_at)
        
        for entry in sorted_history:
            if entry.action == "moved" and entry.changes:
                new_column = entry.changes.get("new_column_id")
                if new_column and UUID(new_column) in done_column_ids:
                    if entry.created_at >= cutoff:
                        date_key = entry.created_at.strftime("%Y-%m-%d")
                        daily_completions[date_key] = daily_completions.get(date_key, 0) + 1
                    break
    
    # Calculate stats
    total_completed = sum(daily_completions.values())
    active_days = len(daily_completions)
    
    return {
        "space_id": str(space_id),
        "space_name": space.name,
        "period_days": days,
        "total_completed": total_completed,
        "active_days": active_days,
        "avg_per_day": round(total_completed / days, 2) if days > 0 else 0,
        "avg_per_week": round(total_completed / (days / 7), 2) if days >= 7 else 0,
        "daily_breakdown": [
            {"date": date, "count": count}
            for date, count in sorted(daily_completions.items())
        ],
    }


def format_duration(duration: timedelta) -> str:
    """Format a timedelta as human-readable string."""
    total_seconds = int(duration.total_seconds())
    
    if total_seconds < 60:
        return f"{total_seconds}s"
    
    minutes = total_seconds // 60
    if minutes < 60:
        return f"{minutes}m"
    
    hours = minutes // 60
    remaining_minutes = minutes % 60
    
    if hours < 24:
        if remaining_minutes:
            return f"{hours}h {remaining_minutes}m"
        return f"{hours}h"
    
    days = hours // 24
    remaining_hours = hours % 24
    
    if remaining_hours:
        return f"{days}d {remaining_hours}h"
    return f"{days}d"


@router.get("/spaces/{space_id}/summary")
async def get_board_summary(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a quick summary of the board state.
    
    Returns card counts per column, oldest card age, and recent activity.
    """
    from app.models.column import Column
    from app.services.card_age import compute_card_age_days
    from datetime import datetime, timezone
    
    # Get columns in this space
    result = await db.execute(
        select(Column)
        .where(Column.space_id == space_id)
        .order_by(Column.position)
    )
    columns = result.scalars().all()
    
    now = datetime.now(timezone.utc)
    column_stats = []
    total_cards = 0
    oldest_card_age = 0
    
    for column in columns:
        # Count cards in column
        card_result = await db.execute(
            select(func.count(Card.id)).where(Card.column_id == column.id)
        )
        card_count = card_result.scalar() or 0
        total_cards += card_count
        
        # Find oldest card in column
        oldest_result = await db.execute(
            select(Card.column_entered_at)
            .where(Card.column_id == column.id)
            .order_by(Card.column_entered_at.asc())
            .limit(1)
        )
        oldest_entered = oldest_result.scalar()
        
        column_oldest_age = 0
        if oldest_entered:
            age = compute_card_age_days(oldest_entered, now)
            if age:
                column_oldest_age = age
                if age > oldest_card_age:
                    oldest_card_age = age
        
        column_stats.append({
            "id": str(column.id),
            "name": column.name,
            "card_count": card_count,
            "oldest_card_age_days": column_oldest_age,
        })
    
    return {
        "space_id": str(space_id),
        "total_cards": total_cards,
        "columns": column_stats,
        "oldest_card_age_days": oldest_card_age,
        "generated_at": now.isoformat(),
    }


@router.get("/spaces/{space_id}/tags")
async def get_tag_statistics(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tag usage statistics for a space.
    
    Returns how many cards have each tag.
    """
    from app.models.tag import Tag
    from app.models.card import CardTag
    
    # Get all tags in the space with card counts
    result = await db.execute(
        select(
            Tag.id,
            Tag.name,
            Tag.color,
            func.count(CardTag.card_id).label('card_count')
        )
        .outerjoin(CardTag, Tag.id == CardTag.tag_id)
        .where(Tag.space_id == space_id)
        .group_by(Tag.id, Tag.name, Tag.color)
        .order_by(func.count(CardTag.card_id).desc())
    )
    
    tags = result.all()
    
    return {
        "space_id": str(space_id),
        "tags": [
            {
                "id": str(t.id),
                "name": t.name,
                "color": t.color,
                "card_count": t.card_count,
            }
            for t in tags
        ],
        "total_tags": len(tags),
    }


@router.get("/spaces/{space_id}/activity")
async def get_space_activity(
    space_id: UUID,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent activity feed for a space.
    
    Returns recent card changes, comments, and movements.
    """
    from app.models.comment import Comment
    
    activities = []
    
    # Get recent card history entries
    history_result = await db.execute(
        select(CardHistory)
        .join(Card)
        .join(Column)
        .where(Column.space_id == space_id)
        .order_by(CardHistory.changed_at.desc())
        .limit(limit)
    )
    history_entries = history_result.scalars().all()
    
    for entry in history_entries:
        activities.append({
            "type": "card_change",
            "timestamp": entry.changed_at.isoformat() if entry.changed_at else None,
            "card_id": str(entry.card_id),
            "field": entry.field_name,
            "old_value": entry.old_value,
            "new_value": entry.new_value,
            "actor_name": entry.actor_name,
        })
    
    # Get recent comments
    comment_result = await db.execute(
        select(Comment)
        .join(Card)
        .join(Column)
        .where(Column.space_id == space_id)
        .order_by(Comment.created_at.desc())
        .limit(limit)
    )
    comments = comment_result.scalars().all()
    
    for comment in comments:
        activities.append({
            "type": "comment",
            "timestamp": comment.created_at.isoformat() if comment.created_at else None,
            "card_id": str(comment.card_id),
            "actor_name": comment.actor_name,
            "content_preview": comment.content[:100] if comment.content else None,
        })
    
    # Sort by timestamp and limit
    activities.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    
    return {
        "space_id": str(space_id),
        "activities": activities[:limit],
        "count": len(activities[:limit]),
    }


@router.get("/columns/{column_id}/stats")
async def get_column_stats(
    column_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get statistics for a specific column.
    
    Returns card counts, average age, and throughput.
    """
    from app.models.column import Column as ColumnModel
    from app.services.card_age import compute_card_age_days
    
    # Get column
    result = await db.execute(
        select(ColumnModel).where(ColumnModel.id == column_id)
    )
    column = result.scalar_one_or_none()
    
    if not column:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Column not found")
    
    now = datetime.now(timezone.utc)
    
    # Get cards in column
    cards_result = await db.execute(
        select(Card).where(Card.column_id == column_id)
    )
    cards = cards_result.scalars().all()
    
    # Calculate stats
    card_count = len(cards)
    ages = []
    for card in cards:
        if card.column_entered_at:
            age = compute_card_age_days(card.column_entered_at, now)
            if age is not None:
                ages.append(age)
    
    avg_age = sum(ages) / len(ages) if ages else 0
    max_age = max(ages) if ages else 0
    
    # Count cards moved out in last 7 days (throughput)
    week_ago = now - timedelta(days=7)
    throughput_result = await db.execute(
        select(func.count(CardHistory.id))
        .where(
            CardHistory.field_name == "column_id",
            CardHistory.old_value == str(column_id),
            CardHistory.changed_at >= week_ago,
        )
    )
    weekly_throughput = throughput_result.scalar() or 0
    
    return {
        "column_id": str(column_id),
        "column_name": column.name,
        "card_count": card_count,
        "average_age_days": round(avg_age, 1),
        "max_age_days": max_age,
        "weekly_throughput": weekly_throughput,
        "generated_at": now.isoformat(),
    }


@router.get("/users/{user_id}/workload")
async def get_user_workload(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get workload statistics for a user.
    
    Returns assigned cards grouped by space.
    """
    # Get cards assigned to user
    result = await db.execute(
        select(Card)
        .join(Card.assignees)
        .where(User.id == user_id)
        .options(
            selectinload(Card.column).selectinload(Column.space)
        )
    )
    cards = result.scalars().all()
    
    # Group by space
    by_space = {}
    for card in cards:
        space_name = card.column.space.name if card.column and card.column.space else "Unknown"
        space_id = str(card.column.space.id) if card.column and card.column.space else None
        
        if space_id not in by_space:
            by_space[space_id] = {
                "space_name": space_name,
                "card_count": 0,
                "by_column": {},
            }
        
        by_space[space_id]["card_count"] += 1
        
        col_name = card.column.name if card.column else "Unknown"
        if col_name not in by_space[space_id]["by_column"]:
            by_space[space_id]["by_column"][col_name] = 0
        by_space[space_id]["by_column"][col_name] += 1
    
    return {
        "user_id": str(user_id),
        "total_assigned": len(cards),
        "by_space": list(by_space.values()),
    }


@router.get("/spaces/{space_id}/overdue")
async def get_overdue_cards(
    space_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all overdue cards in a space.
    
    Returns cards past their due date, sorted by how overdue.
    """
    now = datetime.now(timezone.utc).date()
    
    result = await db.execute(
        select(Card)
        .join(Column)
        .where(
            Column.space_id == space_id,
            Card.due_date != None,
            Card.due_date < now,
        )
        .options(
            selectinload(Card.column),
            selectinload(Card.assignees),
        )
        .order_by(Card.due_date.asc())
    )
    cards = result.scalars().all()
    
    return {
        "space_id": str(space_id),
        "overdue_count": len(cards),
        "cards": [
            {
                "id": str(card.id),
                "name": card.name,
                "due_date": card.due_date.isoformat() if card.due_date else None,
                "days_overdue": (now - card.due_date).days if card.due_date else 0,
                "column_name": card.column.name if card.column else None,
                "assignees": [u.username for u in (card.assignees or [])],
            }
            for card in cards
        ],
    }


@router.get("/spaces/{space_id}/upcoming")
async def get_upcoming_deadlines(
    space_id: UUID,
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get cards with upcoming deadlines.
    
    Returns cards due within the specified number of days.
    """
    now = datetime.now(timezone.utc).date()
    future = now + timedelta(days=days)
    
    result = await db.execute(
        select(Card)
        .join(Column)
        .where(
            Column.space_id == space_id,
            Card.due_date != None,
            Card.due_date >= now,
            Card.due_date <= future,
        )
        .options(
            selectinload(Card.column),
            selectinload(Card.assignees),
        )
        .order_by(Card.due_date.asc())
    )
    cards = result.scalars().all()
    
    return {
        "space_id": str(space_id),
        "days_ahead": days,
        "upcoming_count": len(cards),
        "cards": [
            {
                "id": str(card.id),
                "name": card.name,
                "due_date": card.due_date.isoformat() if card.due_date else None,
                "days_until_due": (card.due_date - now).days if card.due_date else 0,
                "column_name": card.column.name if card.column else None,
                "assignees": [u.username for u in (card.assignees or [])],
            }
            for card in cards
        ],
    }
