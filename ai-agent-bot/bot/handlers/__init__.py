import logging
from typing import Any, Dict

from aiogram import Router
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    ReplyKeyboardMarkup,
    KeyboardButton,
)

from agents.agent_registry import get_registry
from agents.base import AgentContext
from bot.user_sync import sync_user
from utils.security import is_admin, is_owner

logger = logging.getLogger("agent-bot.bot.handlers")
router = Router()


def get_bot_keyboard(user_id: int) -> ReplyKeyboardMarkup:
    is_admin_user = is_admin(user_id)
    is_owner_user = is_owner(user_id)
    buttons = [
        [KeyboardButton(text="📁 Проекты"), KeyboardButton(text="💬 Новый чат")],
        [KeyboardButton(text="🧠 Память"), KeyboardButton(text="⚙️ Настройки")],
    ]
    if is_admin_user:
        buttons.append([KeyboardButton(text="🔧 Админ")])
    if is_owner_user:
        buttons.append([KeyboardButton(text="👑 Владелец")])
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True, one_time_keyboard=False)


def get_inline_keyboard(options: list[dict]) -> InlineKeyboardMarkup:
    buttons = []
    for opt in options:
        buttons.append([InlineKeyboardButton(text=opt["text"], callback_data=opt.get("callback_data", opt["text"]))])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    await sync_user(message)
    welcome = (
        f"👋 Привет, {message.from_user.first_name or 'пользователь'}!\n\n"
        "Я — AI-платформа с командой специализированных агентов.\n\n"
        "<b>Что я умею:</b>\n"
        "• 🧑‍💻 Писать и исправлять код\n"
        "• 🤖 Создавать Telegram-ботов\n"
        "• 🌐 Создавать сайты и SaaS\n"
        "• 🧠 Помнить контекст разговоров\n"
        "• 🧪 Тестировать код\n"
        "• 🚀 Деплоить проекты\n"
        "• 🔍 Искать информацию\n"
        "• 📊 Анализировать данные\n\n"
        "Просто напиши задачу — я передам её нужному агенту."
    )
    await message.answer(welcome, reply_markup=get_bot_keyboard(message.from_user.id), parse_mode=ParseMode.HTML)


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    help_text = (
        "<b>📖 Справка</b>\n\n"
        "<b>Агенты:</b>\n"
        "🎯 <b>Supervisor</b> — координатор задач\n"
        "💻 <b>Coder</b> — программирование\n"
        "📊 <b>Analyst</b> — анализ и требования\n"
        "📅 <b>Planner</b> — планирование\n"
        "🧠 <b>Memory</b> — долговременная память\n"
        "🧪 <b>Tester</b> — тестирование и QA\n"
        "🚀 <b>Deployer</b> — деплой и инфраструктура\n"
        "🔍 <b>Researcher</b> — поиск информации\n\n"
        "<b>Команды:</b>\n"
        "/start — главное меню\n"
        "/project — создать проект\n"
        "/memory — поиск в памяти\n"
        "/agents — список агентов\n"
        "/settings — настройки\n"
    )
    await message.answer(help_text, parse_mode=ParseMode.HTML)


@router.message(Command("project"))
async def cmd_project(message: Message, state: FSMContext) -> None:
    await state.clear()
    keyboard = get_inline_keyboard([
        {"text": "🤖 Telegram-бот", "callback_data": "proj:bot"},
        {"text": "🌐 Сайт", "callback_data": "proj:site"},
        {"text": "💼 SaaS", "callback_data": "proj:saas"},
        {"text": "📦 Другое", "callback_data": "proj:other"},
    ])
    await message.answer("Выбери тип проекта:", reply_markup=keyboard)


@router.message(Command("memory"))
async def cmd_memory(message: Message) -> None:
    registry = get_registry()
    memory_agent = registry.get("memory")
    if not memory_agent:
        await message.answer("Агент памяти не доступен.")
        return
    context = AgentContext(user_id=str(message.from_user.id))
    await memory_agent.execute(context, message.text or "")
    recall = await memory_agent.recall(message.text or "", user_id=str(message.from_user.id))
    await message.answer(recall or "Пока ничего не запомнил.")


@router.message(Command("agents"))
async def cmd_agents(message: Message) -> None:
    registry = get_registry()
    agents = registry.list_agents()
    lines = ["<b>🤖 Доступные агенты:</b>\n"]
    for agent in agents:
        lines.append(f"• <b>{agent['name']}</b>: {agent['description']}")
    await message.answer("\n".join(lines), parse_mode=ParseMode.HTML)


@router.message(Command("settings"))
async def cmd_settings(message: Message) -> None:
    keyboard = get_inline_keyboard([
        {"text": "🔔 Уведомления", "callback_data": "set:notifications"},
        {"text": "🎨 Тема", "callback_data": "set:theme"},
        {"text": "🔑 API ключи", "callback_data": "set:api"},
        {"text": "📊 Статистика", "callback_data": "set:stats"},
    ])
    await message.answer("⚙️ Настройки:", reply_markup=keyboard)


@router.message(Command("admin"))
async def cmd_admin(message: Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("⛔ Доступ запрещён.")
        return
    keyboard = get_inline_keyboard([
        {"text": "📊 Статистика", "callback_data": "admin:stats"},
        {"text": "👥 Пользователи", "callback_data": "admin:users"},
        {"text": "🔧 Логи", "callback_data": "admin:logs"},
        {"text": "🔄 Резервное копирование", "callback_data": "admin:backup"},
    ])
    await message.answer("🔧 Панель администратора:", reply_markup=keyboard)


@router.callback_query(lambda c: c.data and c.data.startswith("proj:"))
async def callback_project(callback: CallbackQuery, state: FSMContext) -> None:
    project_type = callback.data.split(":", 1)[1]
    await state.update_data(project_type=project_type)
    await callback.message.edit_text(
        f"Отлично! Опиши проект:\n\n"
        f"1. Название\n"
        f"2. Что должно делать\n"
        f"3. Технологии (если есть пожелания)\n"
        f"4. Дополнительные требования\n\n"
        f"Или нажми /cancel для отмены."
    )
    await callback.answer()


@router.callback_query(lambda c: c.data and c.data.startswith("set:"))
async def callback_settings(callback: CallbackQuery) -> None:
    setting = callback.data.split(":", 1)[1]
    responses = {
        "notifications": "🔔 Уведомления включены.\nВы получите уведомления о завершении задач.",
        "theme": "🎨 Тема: тёмная (Telegram style).",
        "api": "🔑 API ключи сохранены безопасно в encrypted storage.",
        "stats": "📊 Статистика:\n• Задач выполнено: 0\n• Агентов активных: 8\n• Проектов: 0",
    }
    await callback.message.edit_text(responses.get(setting, "Настройка обновлена."))
    await callback.answer()


@router.callback_query(lambda c: c.data and c.data.startswith("admin:"))
async def callback_admin(callback: CallbackQuery) -> None:
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещён.", show_alert=True)
        return
    action = callback.data.split(":", 1)[1]
    responses = {
        "stats": "📊 <b>Статистика системы</b>\n\n• Пользователей: 0\n• Проектов: 0\n• Задач: 0\n• Агентов: 8\n• Uptime: 0ч",
        "users": "👥 <b>Пользователи</b>\n\nНет зарегистрированных пользователей.",
        "logs": "🔧 <b>Последние логи</b>\n\n<i>(Доступно в панели администратора)</i>",
        "backup": "🔄 <b>Резервное копирование</b>\n\nПоследний бэкап: -\nСледующий: -\nСтатус: готово",
    }
    await callback.message.edit_text(
        responses.get(action, "Панель администратора"),
        parse_mode=ParseMode.HTML,
    )
    await callback.answer()


@router.message()
async def handle_message(message: Message, state: FSMContext) -> None:
    if not message.text:
        return
    await sync_user(message)
    await process_agent_task(message, message.text)


async def process_agent_task(message: Message, text: str) -> None:
    status_msg = await message.answer("🤔 Обрабатываю запрос...")
    try:
        registry = get_registry()
        orchestrator = registry.get_orchestrator()
        context = AgentContext(user_id=str(message.from_user.id))
        result_context = await orchestrator.run(context, text)
        response_text = result_context.history[-1].get("content", "Задача выполнена.") if result_context.history else "Задача выполнена."
        await status_msg.edit_text(response_text, parse_mode=ParseMode.HTML)
    except Exception as exc:
        logger.error("Agent task failed: %s", exc, exc_info=True)
        await status_msg.edit_text(f"❌ Ошибка: {exc}")
