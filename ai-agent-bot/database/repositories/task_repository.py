from typing import List, Optional

from database.supabase_client import get_supabase
from database.models import Task


class TaskRepository:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_by_id(self, task_id: str) -> Optional[Task]:
        tasks = await self.supabase.query("tasks", {"id": task_id})
        return Task(**tasks[0]) if tasks else None

    async def list_by_user(self, user_id: str, status: Optional[str] = None) -> List[Task]:
        tasks = await self.supabase.query("tasks", {"user_id": user_id})
        result = [Task(**t) for t in tasks]
        if status:
            result = [t for t in result if t.status == status]
        return result

    async def create(self, task_data: dict) -> Task:
        created = await self.supabase.insert("tasks", task_data)
        return Task(**created)

    async def update(self, task_id: str, data: dict) -> Optional[Task]:
        updated = await self.supabase.update("tasks", task_id, data)
        return Task(**updated) if updated else None
