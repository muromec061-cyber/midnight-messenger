import logging
from typing import Any, Dict, List

from celery import shared_task
from database.supabase_client import get_supabase

logger = logging.getLogger("agent-bot.services.tasks")


@shared_task(bind=True, max_retries=3)
def run_agent_task(self, user_id: str, input_text: str, project_id: str | None = None, task_id: str | None = None) -> Dict[str, Any]:
    import asyncio
    async def _run() -> Dict[str, Any]:
        from agents.agent_registry import get_registry
        from agents.base import AgentContext
        registry = get_registry()
        orchestrator = registry.get_orchestrator()
        context = AgentContext(user_id=user_id, project_id=project_id, task_id=task_id)
        result = await orchestrator.run(context, input_text)
        content = result.history[-1].get("content", "") if result.history else ""
        return {"status": "completed", "result": content, "artifacts": result.artifacts}
    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("Celery task failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@shared_task
def backup_database() -> str:
    import asyncio
    from scripts.backup import backup_database as _backup
    return asyncio.run(_backup())


@shared_task
def backup_memory() -> str:
    import asyncio
    from scripts.backup import backup_memory as _backup
    return asyncio.run(_backup())


@shared_task
def cleanup_old_backups() -> None:
    import asyncio
    from scripts.backup import cleanup_old_backups as _cleanup
    asyncio.run(_cleanup())
