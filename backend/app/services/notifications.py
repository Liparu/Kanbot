from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


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