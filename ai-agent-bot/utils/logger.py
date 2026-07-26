import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from rich.console import Console
from rich.logging import RichHandler

from config import get_settings

settings = get_settings()
LOG_DIR = Path(settings.log_path)
LOG_DIR.mkdir(parents=True, exist_ok=True)

console = Console(stderr=True)


def setup_logging(name: str = "agent-bot") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    logger.handlers.clear()

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    rich_handler = RichHandler(
        console=console,
        show_time=True,
        show_level=True,
        show_path=False,
        markup=True,
        rich_tracebacks=True,
    )
    rich_handler.setFormatter(formatter)
    logger.addHandler(rich_handler)

    file_handler = RotatingFileHandler(
        LOG_DIR / f"{name}.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=10,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.DEBUG)
    logger.addHandler(file_handler)

    error_file = LOG_DIR / f"{name}_error.log"
    error_handler = RotatingFileHandler(
        error_file,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)
    logger.addHandler(error_handler)

    if os.getenv("ENVIRONMENT") == "production":
        logger.propagate = False

    return logger


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"agent-bot.{name}")
