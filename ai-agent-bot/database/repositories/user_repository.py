from typing import List, Optional

from database.supabase_client import get_supabase
from database.models import User


class UserRepository:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_by_telegram_id(self, telegram_id: int) -> Optional[User]:
        users = await self.supabase.query("users", {"telegram_id": telegram_id})
        return User(**users[0]) if users else None

    async def get_by_id(self, user_id: str) -> Optional[User]:
        users = await self.supabase.query("users", {"id": user_id})
        return User(**users[0]) if users else None

    async def create(self, user_data: dict) -> User:
        created = await self.supabase.insert("users", user_data)
        return User(**created)

    async def update(self, user_id: str, data: dict) -> Optional[User]:
        updated = await self.supabase.update("users", user_id, data)
        return User(**updated) if updated else None

    async def list_all(self, limit: int = 100) -> List[User]:
        return [User(**u) for u in await self.supabase.query("users")]
