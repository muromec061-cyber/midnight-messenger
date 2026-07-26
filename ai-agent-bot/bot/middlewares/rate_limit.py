from aiogram import BaseMiddleware
from aiogram.types import TelegramObject
from typing import Any, Callable, Dict, Awaitable
import time

class RateLimitMiddleware(BaseMiddleware):
    def __init__(self, rate_limit: int = 30, period: int = 60):
        self.rate_limit = rate_limit
        self.period = period
        self._requests: dict[int, list[float]] = {}

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        user_id = getattr(event, "from_user", None)
        if user_id and hasattr(user_id, "id"):
            now = time.time()
            uid = user_id.id
            if uid not in self._requests:
                self._requests[uid] = []
            self._requests[uid] = [t for t in self._requests[uid] if now - t < self.period]
            if len(self._requests[uid]) >= self.rate_limit:
                return None
            self._requests[uid].append(now)
        return await handler(event, data)
