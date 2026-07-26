import logging
from typing import Any, Dict, List, Optional

from database.supabase_client import get_supabase
from database.models import Project, Task, User

logger = logging.getLogger("agent-bot.tools.supabase_tools")


class SupabaseTools:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_user(self, user_id: str) -> Optional[User]:
        users = await self.supabase.query("users", {"id": user_id})
        return User(**users[0]) if users else None

    async def create_project(self, user_id: str, name: str, description: str = "", tech_stack: Optional[list[str]] = None) -> Project:
        from uuid import uuid4
        project = {
            "id": str(uuid4()),
            "user_id": user_id,
            "name": name,
            "description": description,
            "tech_stack": tech_stack or [],
        }
        created = await self.supabase.insert("projects", project)
        return Project(**created)

    async def get_projects(self, user_id: str) -> List[Project]:
        data = await self.supabase.query("projects", {"user_id": user_id})
        return [Project(**p) for p in data]

    async def create_task(self, user_id: str, title: str, project_id: Optional[str] = None, agent: str = "supervisor") -> Task:
        from uuid import uuid4
        task = {
            "id": str(uuid4()),
            "user_id": user_id,
            "project_id": project_id,
            "title": title,
            "agent": agent,
        }
        created = await self.supabase.insert("tasks", task)
        return Task(**created)

    async def update_task(self, task_id: str, **kwargs: Any) -> Optional[Task]:
        updated = await self.supabase.update("tasks", task_id, kwargs)
        return Task(**updated) if updated else None

    async def get_tasks(self, user_id: str, status: Optional[str] = None) -> List[Task]:
        tasks = await self.supabase.query("tasks", {"user_id": user_id})
        result = [Task(**t) for t in tasks]
        if status:
            result = [t for t in result if t.status == status]
        return result

    async def save_memory(self, user_id: str, content: str, project_id: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
        from uuid import uuid4
        memory = {
            "id": str(uuid4()),
            "user_id": user_id,
            "project_id": project_id,
            "content": content,
            "type": kwargs.get("type", "note"),
            "metadata": kwargs.get("metadata", {}),
        }
        return await self.supabase.insert("memories", memory)

    async def search_memories(self, query: str, user_id: str, project_id: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        return await self.supabase.rpc("match_memories", {
            "query_embedding": [0.0] * 1536,
            "match_user_id": user_id,
            "match_project_id": project_id,
            "match_type": None,
            "match_count": limit,
        })
