import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.agent_registry import get_registry
from agents.base import AgentContext

logger = logging.getLogger("agent-bot.workers.api")
router = APIRouter()


class TaskRequest(BaseModel):
    user_id: str
    input_text: str
    project_id: str | None = None
    task_id: str | None = None


class TaskResponse(BaseModel):
    status: str
    result: str | None = None
    agent: str | None = None
    artifacts: dict[str, Any] | None = None


@router.post("/agent/task", response_model=TaskResponse)
async def run_agent_task(request: TaskRequest) -> TaskResponse:
    try:
        registry = get_registry()
        orchestrator = registry.get_orchestrator()
        context = AgentContext(
            user_id=request.user_id,
            project_id=request.project_id,
            task_id=request.task_id,
        )
        result = await orchestrator.run(context, request.input_text)
        content = result.history[-1].get("content", "") if result.history else ""
        return TaskResponse(
            status="completed",
            result=content,
            agent=result.metadata.get("next_agent"),
            artifacts=result.artifacts,
        )
    except Exception as exc:
        logger.error("API agent task failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/agents")
async def list_agents() -> dict[str, Any]:
    registry = get_registry()
    return {"agents": registry.list_agents()}


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
