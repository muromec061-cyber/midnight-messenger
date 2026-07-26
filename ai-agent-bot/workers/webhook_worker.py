import logging
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from services.celery_app import celery_app

logger = logging.getLogger("agent-bot.workers.webhook")
router = APIRouter()


class WebhookPayload(BaseModel):
    event: str
    data: dict[str, Any]


@router.post("/webhook/task")
async def enqueue_task(payload: WebhookPayload) -> dict[str, str]:
    celery_app.send_task("services.tasks.run_agent_task", kwargs=payload.data)
    return {"status": "queued"}


@router.post("/webhook/github")
async def github_webhook(request: Request) -> dict[str, str]:
    body = await request.json()
    event = request.headers.get("X-GitHub-Event", "unknown")
    logger.info("GitHub event: %s", event)
    return {"status": "received"}
