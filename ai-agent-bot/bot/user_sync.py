import logging
from datetime import datetime, timezone
from typing import Optional

from aiogram import Bot
from aiogram.types import Message

from config import get_settings
from database.supabase_client import get_supabase
from database.models import User
from utils.security import hash_password

settings = get_settings()
logger = logging.getLogger("agent-bot.bot.user_sync")


async def sync_user(message: Message) -> User:
    supabase = get_supabase()
    users = await supabase.query("users", {"telegram_id": message.from_user.id})
    if users:
        user = User(**users[0])
        await supabase.update("users", user.id, {
            "first_name": message.from_user.first_name,
            "last_name": message.from_user.last_name,
            "username": message.from_user.username,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        return user
    from uuid import uuid4
    new_user = {
        "id": str(uuid4()),
        "telegram_id": message.from_user.id,
        "username": message.from_user.username,
        "first_name": message.from_user.first_name,
        "last_name": message.from_user.last_name,
        "role": "user",
        "settings": {},
    }
    created = await supabase.insert("users", new_user)
    logger.info("New user registered: %s", message.from_user.id)
    return User(**created)


async def get_user_by_telegram_id(telegram_id: int) -> Optional[User]:
    supabase = get_supabase()
    users = await supabase.query("users", {"telegram_id": telegram_id})
    if users:
        return User(**users[0])
    return None
