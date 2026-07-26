from typing import List, Optional

from database.supabase_client import get_supabase
from database.models import Project


class ProjectRepository:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_by_id(self, project_id: str) -> Optional[Project]:
        projects = await self.supabase.query("projects", {"id": project_id})
        return Project(**projects[0]) if projects else None

    async def list_by_user(self, user_id: str) -> List[Project]:
        data = await self.supabase.query("projects", {"user_id": user_id})
        return [Project(**p) for p in data]

    async def create(self, project_data: dict) -> Project:
        created = await self.supabase.insert("projects", project_data)
        return Project(**created)

    async def update(self, project_id: str, data: dict) -> Optional[Project]:
        updated = await self.supabase.update("projects", project_id, data)
        return Project(**updated) if updated else None

    async def delete(self, project_id: str) -> None:
        await self.supabase.delete("projects", project_id)
