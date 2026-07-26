import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from agents.base import AgentContext, BaseAgent

logger = logging.getLogger("agent-bot.agents.coder")


class CoderAgent(BaseAgent):
    name = "coder"
    description = "Агент-программист: написание, ревью, исправление кода"
    capabilities = ["code", "review", "fix", "create_bot", "create_site", "create_saas", "refactor"]

    def _load_system_prompt(self) -> str:
        return (
            "Ты — опытный программист-полystack разработчик. "
            "Умеешь писать чистый, поддерживаемый код на Python, TypeScript, JavaScript, Go, Rust. "
            "Создаёшь Telegram-ботов (aiogram, python-telegram-bot), веб-сайты (FastAPI, React), "
            "SaaS-платформы, микросервисы, Dockerfile, CI/CD конфигурации. "
            "Всегда следуй лучшим практикам: типизация, тесты, документация, линтеры. "
            "Отвечай кодом в markdown-блоках с указанием языка. "
            "Если просят исправить ошибку — приведи исправленный код и объясни причину."
        )

    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        code_blocks = self._extract_code_blocks(input_text)
        if code_blocks:
            context.artifacts["code_blocks"] = code_blocks
        return context

    async def think(self, context: AgentContext, input_text: str) -> str:
        response = await self.llm.ainvoke_with_system(
            system=self.system_prompt,
            user=self._render_prompt(context, input_text),
            temperature=0.2,
        )
        return response

    def _extract_code_blocks(self, text: str) -> list[dict]:
        pattern = r"```(\w+)?\n(.*?)```"
        matches = re.findall(pattern, text, re.DOTALL)
        return [{"language": m[0] or "text", "code": m[1]} for m in matches]

    async def generate_project(
        self,
        project_type: str,
        name: str,
        description: str,
        tech_stack: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        context = AgentContext(user_id="system")
        prompt = (
            f"Создай проект '{project_type}' под название '{name}'. "
            f"Описание: {description}. "
            f"Технологии: {', '.join(tech_stack or [])}. "
            "Сгенерируй полную структуру проекта: main.py, requirements.txt, docker-compose.yml, Dockerfile, README.md. "
            "Предоставь код в отдельных markdown-блоках с именами файлов."
        )
        response = await self.think(context, prompt)
        return {"raw": response, "files": self._extract_code_blocks(response)}

    async def review_code(self, code: str, language: str = "python") -> str:
        prompt = (
            f"Проведи code review для кода на {language}:\n\n```{language}\n{code}\n```\n"
            "Найди: 1) баги, 2) уязвимости безопасности, 3) проблемы производительности, "
            "4) нарушения стиля, 5) предложения по улучшению. "
            "Отвечай структурированно."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def fix_bug(self, code: str, bug_description: str, language: str = "python") -> str:
        prompt = (
            f"Исправь баг в коде на {language}:\n\n```{language}\n{code}\n```\n"
            f"Описание бага: {bug_description}\n"
            "Приведи исправленный код и объясни, что было изменено и почему."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def run_tests(self, code: str, test_framework: str = "pytest") -> Dict[str, Any]:
        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test_generated.py"
            test_file.write_text(code, encoding="utf-8")
            try:
                result = subprocess.run(
                    ["python", "-m", test_framework, str(test_file)],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                }
            except Exception as exc:
                return {"success": False, "error": str(exc)}
