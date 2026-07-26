from typing import Optional

from aiogram.types import Message

LANGS = {
    "ru": {
        "welcome": "👋 Привет, {name}! Я AI-агент платформа.",
        "help": "📖 Справка по командам и агентам.",
        "project_created": "✅ Проект '{name}' создан!",
        "memory_saved": "🧠 Запомнил: {title}",
        "error": "❌ Ошибка: {error}",
    },
    "en": {
        "welcome": "👋 Hello, {name}! I'm an AI agent platform.",
        "help": "📖 Help and commands.",
        "project_created": "✅ Project '{name}' created!",
        "memory_saved": "🧠 Remembered: {title}",
        "error": "❌ Error: {error}",
    },
}


def t(key: str, lang: str = "ru", **kwargs: Any) -> str:
    text = LANGS.get(lang, LANGS["ru"]).get(key, key)
    return text.format(**kwargs)


def detect_lang(message: Message) -> str:
    if not message.from_user:
        return "ru"
    lang_code = getattr(message.from_user, "language_code", None)
    if lang_code and lang_code.startswith("ru"):
        return "ru"
    if lang_code and lang_code.startswith("en"):
        return "en"
    return "ru"
