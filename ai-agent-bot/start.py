#!/usr/bin/env python3
"""Start AI Agent Bot."""

import asyncio
import logging
import sys

from bot.main import setup_bot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent-bot.start")


async def main() -> int:
    try:
        bot, dp = setup_bot()
        logger.info("Starting bot in polling mode...")
        await dp.start_polling(bot)
        return 0
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
        return 0
    except Exception as exc:
        logger.error("Failed to start bot: %s", exc, exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
