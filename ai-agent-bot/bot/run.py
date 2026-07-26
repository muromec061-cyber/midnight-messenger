from aiogram import Bot, Dispatcher
from bot.handlers import router as bot_router
from config import get_settings
from utils.logger import setup_logging

settings = get_settings()
logger = setup_logging("bot.main")


def setup_bot() -> tuple[Bot, Dispatcher]:
    bot = Bot(token=settings.bot_token)
    dp = Dispatcher()
    dp.include_router(bot_router)
    return bot, dp


if __name__ == "__main__":
    bot, dp = setup_bot()
    logger.info("Starting bot in polling mode...")
    dp.run_polling(bot)
