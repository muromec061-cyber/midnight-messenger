import logging
from typing import Any, Dict, List, Optional

from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions

from config import get_settings

settings = get_settings()
logger = logging.getLogger("agent-bot.database.supabase")


class SupabaseClient:
    def __init__(self):
        self._client: Optional[Client] = None
        self._service_client: Optional[Client] = None

    def connect(self) -> Client:
        if self._client is None:
            if not settings.supabase_url or not settings.supabase_key:
                raise RuntimeError("Supabase credentials not configured")
            self._client = create_client(
                settings.supabase_url,
                settings.supabase_key,
                options=ClientOptions(
                    postgrest_client_timeout=30,
                    storage_client_timeout=30,
                ),
            )
            logger.info("Connected to Supabase (anon)")
        return self._client

    def service(self) -> Client:
        if self._service_client is None:
            if not settings.supabase_url or not settings.supabase_service_key:
                raise RuntimeError("Supabase service key not configured")
            self._service_client = create_client(
                settings.supabase_url,
                settings.supabase_service_key,
            )
            logger.info("Connected to Supabase (service)")
        return self._service_client

    def health(self) -> bool:
        try:
            client = self.connect()
            client.table("users").select("id", count="exact").limit(0).execute()
            return True
        except Exception as exc:
            logger.error("Supabase health check failed: %s", exc)
            return False

    async def query(self, table: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        client = self.connect()
        query = client.table(table).select("*")
        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)
        response = query.execute()
        return response.data or []

    async def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        client = self.service()
        response = client.table(table).insert(data).execute()
        return response.data[0] if response.data else {}

    async def update(self, table: str, id_: str, data: Dict[str, Any]) -> Dict[str, Any]:
        client = self.service()
        response = client.table(table).update(data).eq("id", id_).execute()
        return response.data[0] if response.data else {}

    async def delete(self, table: str, id_: str) -> None:
        client = self.service()
        client.table(table).delete().eq("id", id_).execute()

    async def rpc(self, function_name: str, params: Optional[Dict[str, Any]] = None) -> Any:
        client = self.service()
        response = client.rpc(function_name, params or {}).execute()
        return response.data


_supabase_client: Optional[SupabaseClient] = None


def get_supabase() -> SupabaseClient:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client
