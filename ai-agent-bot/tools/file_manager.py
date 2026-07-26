import asyncio
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import get_settings

settings = get_settings()
logger = logging.getLogger("agent-bot.tools.file_manager")


class FileManager:
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or os.path.join(settings.log_path, "..", "workspace"))
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def write_file(self, relative_path: str, content: str) -> str:
        safe_path = self._safe_path(relative_path)
        safe_path.parent.mkdir(parents=True, exist_ok=True)
        safe_path.write_text(content, encoding="utf-8")
        logger.debug("Written %s", safe_path)
        return str(safe_path)

    async def read_file(self, relative_path: str) -> Optional[str]:
        safe_path = self._safe_path(relative_path)
        if not safe_path.exists():
            return None
        return safe_path.read_text(encoding="utf-8")

    async def list_files(self, relative_path: str = "") -> List[Dict[str, Any]]:
        safe_path = self._safe_path(relative_path)
        if not safe_path.exists() or not safe_path.is_dir():
            return []
        result = []
        for item in safe_path.iterdir():
            result.append({
                "name": item.name,
                "path": str(item.relative_to(self.base_dir)),
                "is_dir": item.is_dir(),
                "size": item.stat().st_size if item.is_file() else 0,
            })
        result.sort(key=lambda x: (not x["is_dir"], x["name"]))
        return result

    async def delete_file(self, relative_path: str) -> bool:
        safe_path = self._safe_path(relative_path)
        if safe_path.exists():
            if safe_path.is_dir():
                import shutil
                shutil.rmtree(safe_path)
            else:
                safe_path.unlink()
            return True
        return False

    async def run_command(self, command: str, cwd: Optional[str] = None) -> Dict[str, Any]:
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                cwd=cwd or str(self.base_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate(timeout=120)
            return {
                "success": process.returncode == 0,
                "returncode": process.returncode,
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
            }
        except asyncio.TimeoutError:
            return {"success": False, "error": "Command timed out"}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def _safe_path(self, relative_path: str) -> Path:
        safe = Path(relative_path).resolve()
        base = self.base_dir.resolve()
        if not str(safe).startswith(str(base)):
            raise ValueError(f"Path traversal detected: {relative_path}")
        return safe
