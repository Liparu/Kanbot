from fastapi import WebSocket
from typing import Dict, Set
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, space_id: str):
        await websocket.accept()
        if space_id not in self.active_connections:
            self.active_connections[space_id] = set()
        self.active_connections[space_id].add(websocket)
        logger.info(f"Client connected to space {space_id}")

    def disconnect(self, websocket: WebSocket, space_id: str):
        if space_id in self.active_connections:
            self.active_connections[space_id].discard(websocket)
            if not self.active_connections[space_id]:
                del self.active_connections[space_id]
        logger.info(f"Client disconnected from space {space_id}")

    async def broadcast_to_space(self, space_id: str, message: dict):
        if space_id not in self.active_connections:
            return
        
        dead_connections = set()
        for connection in self.active_connections[space_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                dead_connections.add(connection)
        
        for dead in dead_connections:
            self.active_connections[space_id].discard(dead)

    async def send_card_created(self, space_id: str, card: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "card_created",
            "card": card,
            "initiated_by": initiated_by,
        })

    async def send_card_updated(self, space_id: str, card: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "card_updated",
            "card": card,
            "initiated_by": initiated_by,
        })

    async def send_card_moved(self, space_id: str, card_id: str, from_column: str, to_column: str, position: int, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "card_moved",
            "card_id": card_id,
            "from_column": from_column,
            "to_column": to_column,
            "position": position,
            "initiated_by": initiated_by,
        })

    async def send_card_deleted(self, space_id: str, card_id: str, column_id: str, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "card_deleted",
            "card_id": card_id,
            "column_id": column_id,
            "initiated_by": initiated_by,
        })

    async def send_column_created(self, space_id: str, column: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "column_created",
            "column": column,
            "initiated_by": initiated_by,
        })

    async def send_column_deleted(self, space_id: str, column_id: str, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "column_deleted",
            "column_id": column_id,
            "initiated_by": initiated_by,
        })

    async def send_notification(self, space_id: str, notification: dict):
        await self.broadcast_to_space(space_id, {
            "type": "notification_created",
            "notification": notification,
        })

    async def send_member_added(self, space_id: str, member: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "member_added",
            "member": member,
            "space_id": space_id,
            "initiated_by": initiated_by,
        })

    async def send_task_created(self, space_id: str, card_id: str, task: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "task_created",
            "card_id": card_id,
            "task": task,
            "initiated_by": initiated_by,
        })

    async def send_task_updated(self, space_id: str, card_id: str, task: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "task_updated",
            "card_id": card_id,
            "task": task,
            "initiated_by": initiated_by,
        })

    async def send_task_deleted(self, space_id: str, card_id: str, task_id: str, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "task_deleted",
            "card_id": card_id,
            "task_id": task_id,
            "initiated_by": initiated_by,
        })

    async def send_comment_created(self, space_id: str, card_id: str, comment: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "comment_created",
            "card_id": card_id,
            "comment": comment,
            "initiated_by": initiated_by,
        })

    async def send_comment_updated(self, space_id: str, card_id: str, comment: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "comment_updated",
            "card_id": card_id,
            "comment": comment,
            "initiated_by": initiated_by,
        })

    async def send_comment_deleted(self, space_id: str, card_id: str, comment: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "comment_deleted",
            "card_id": card_id,
            "comment": comment,
            "initiated_by": initiated_by,
        })

    async def send_tag_created(self, space_id: str, tag: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "tag_created",
            "tag": tag,
            "initiated_by": initiated_by,
        })

    async def send_tag_updated(self, space_id: str, tag: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "tag_updated",
            "tag": tag,
            "initiated_by": initiated_by,
        })

    async def send_tag_deleted(self, space_id: str, tag_id: str, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "tag_deleted",
            "tag_id": tag_id,
            "initiated_by": initiated_by,
        })

    async def send_column_updated(self, space_id: str, column: dict, initiated_by: str | None = None):
        await self.broadcast_to_space(space_id, {
            "type": "column_updated",
            "column": column,
            "initiated_by": initiated_by,
        })
