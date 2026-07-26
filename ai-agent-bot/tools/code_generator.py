import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from config import get_settings

settings = get_settings()
logger = logging.getLogger("agent-bot.tools.code_generator")


class CodeGenerator:
    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = Path(output_dir or os.path.join(settings.log_path, "..", "generated"))
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def generate_project(self, files: list[dict], project_name: str) -> Dict[str, Any]:
        project_dir = self.output_dir / project_name
        project_dir.mkdir(exist_ok=True)
        generated_files = []
        for file_info in files:
            filename = file_info.get("filename", "file.txt")
            content = file_info.get("code", "")
            filepath = project_dir / filename
            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_text(content, encoding="utf-8")
            generated_files.append(str(filepath))
            logger.info("Generated %s", filepath)
        return {
            "project_name": project_name,
            "path": str(project_dir),
            "files": generated_files,
        }

    async def generate_zip(self, project_dir: Path) -> bytes:
        import zipfile
        buffer = bytes()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for file in project_dir.rglob("*"):
                if file.is_file():
                    zf.write(file, file.relative_to(project_dir))
        return buffer
