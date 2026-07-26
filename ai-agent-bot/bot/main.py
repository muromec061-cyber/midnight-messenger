import asyncio
import logging
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

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


bot_instance: Bot | None = None
dispatcher: Dispatcher | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_instance, dispatcher
    bot_instance, dispatcher = setup_bot()
    if settings.webhook_url:
        await bot_instance.set_webhook(
            url=f"{settings.webhook_url}/webhook/{settings.webhook_secret}",
            drop_pending_updates=True,
        )
        logger.info("Webhook set to %s", settings.webhook_url)
    else:
        logger.info("Polling mode")
        asyncio.create_task(dispatcher.start_polling(bot_instance))
    yield
    if bot_instance:
        await bot_instance.delete_webhook(drop_pending_updates=True)
        await bot_instance.session.close()


app = FastAPI(title="AI Agent Bot", lifespan=lifespan)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/webhook/{secret}")
async def telegram_webhook(request: Request, secret: str) -> JSONResponse:
    if secret != settings.webhook_secret:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    if not dispatcher or not bot_instance:
        return JSONResponse({"error": "not initialized"}, status_code=500)
    update = await dispatcher.feed_webhook_update(bot=bot_instance, update=await request.json())
    return JSONResponse({"ok": True})


@app.get("/")
async def root() -> dict:
    return {"service": "AI Agent Bot", "status": "running"}
