import logging
from typing import Any, Dict, List

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhook import Webhook, WebhookLog

logger = logging.getLogger(__name__)


async def dispatch_webhooks(
    db: AsyncSession,
    space_id: str,
    event: str,
    payload: Dict[str, Any],
):
    result = await db.execute(
        select(Webhook).where(Webhook.space_id == space_id, Webhook.active == True)
    )
    webhooks: List[Webhook] = result.scalars().all()

    if not webhooks:
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        for webhook in webhooks:
            if webhook.events and event not in webhook.events:
                continue

            log = WebhookLog(
                webhook_id=webhook.id,
                event=event,
                payload=payload,
            )
            try:
                headers = {}
                if webhook.secret:
                    headers["X-Kanbot-Secret"] = webhook.secret
                response = await client.post(
                    webhook.url,
                    json={"event": event, "space_id": str(space_id), "payload": payload},
                    headers=headers,
                )
                log.response_status = response.status_code
                log.response_body = response.text[:1000]
                log.success = 200 <= response.status_code < 300
            except Exception as exc:
                log.response_body = str(exc)[:1000]
                log.success = False
                logger.warning("Webhook dispatch failed: %s", exc)
            db.add(log)

    await db.commit()