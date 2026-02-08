import re
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    notification_type: str,
    title: str,
    message: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        data=data or {},
    )
    db.add(notification)
    await db.flush()
    return notification


def serialize_notification(notification: Notification) -> Dict[str, Any]:
    return {
        "id": str(notification.id),
        "user_id": str(notification.user_id),
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "data": notification.data or {},
        "read": notification.read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


def parse_mentions(text: str) -> Set[str]:
    """Extract @username mentions from text.
    
    Returns a set of usernames (without the @ prefix).
    """
    pattern = r'@([a-zA-Z0-9_.-]+)'
    matches = re.findall(pattern, text)
    return set(matches)


async def notify_mentions(
    db: AsyncSession,
    content: str,
    card_id: UUID,
    card_name: str,
    author_id: UUID,
    author_name: str,
    comment_id: Optional[UUID] = None,
) -> List[Notification]:
    """Parse @mentions in content and create notifications for mentioned users.
    
    Returns list of created notifications.
    """
    usernames = parse_mentions(content)
    if not usernames:
        return []
    
    # Find users by username
    result = await db.execute(
        select(User).where(User.username.in_(usernames))
    )
    mentioned_users = result.scalars().all()
    
    notifications = []
    for user in mentioned_users:
        # Don't notify the author of their own mention
        if user.id == author_id:
            continue
        
        notification = await create_notification(
            db=db,
            user_id=user.id,
            notification_type="mention",
            title=f"@{author_name} mentioned you",
            message=f"In card: {card_name}",
            data={
                "card_id": str(card_id),
                "comment_id": str(comment_id) if comment_id else None,
                "content_preview": content[:200],
            },
        )
        notifications.append(notification)
    
    return notifications