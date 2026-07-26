import logging
from typing import Any

from agents.base import AgentContext, BaseAgent

logger = logging.getLogger("agent-bot.agents.tester")


class TesterAgent(BaseAgent):
    name = "tester"
    description = "Агент тестирования: тесты, QA, отладка"
    capabilities = ["test", "qa", "debug", "coverage", "lint"]

    def _load_system_prompt(self) -> str:
        return (
            "Ты — QA-инженер и тестировщик. "
            "Пишешь unit-тесты (pytest), интеграционные тесты, e2e-тесты. "
            "Проверяешь покрытие кода, находишь баги, "
            "настраиваешь линтеры (ruff, mypy, eslint). "
            "Работаешь с Python, TypeScript, JavaScript. "
            "Всегда присылай код тестов и инструкцию по запуску."
        )

    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        context.artifacts["test_suite"] = await self._generate_tests(input_text)
        return context

    async def think(self, context: AgentContext, input_text: str) -> str:
        return await self.llm.ainvoke_with_system(
            system=self.system_prompt,
            user=self._render_prompt(context, input_text),
        )

    async def _generate_tests(self, code: str) -> Dict[str, Any]:
        prompt = (
            f"Напиши pytest-тесты для следующего кода:\n\n```python\n{code}\n```\n\n"
            "Требования:\n"
            "1. Покрой основные сценарии (happy path)\n"
            "2. Добавь негативные тесты (ошибки, граничные значения)\n"
            "3. Используй фикстуры и параметризацию\n"
            "4. Добавь docstrings и комментарии\n"
            "5. Предоставь команду запуска"
        )
        response = await self.llm.ainvoke_with_system(system=self.system_prompt, user=prompt)
        return {"raw": response}

    async def write_unit_tests(self, code: str, framework: str = "pytest") -> str:
        prompt = (
            f"Напиши unit-тесты на {framework} для кода:\n\n```\n{code}\n```\n\n"
            "Включи: фикстуры, моки, покрытие edge cases, проверку исключений."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def debug(self, error: str, code: str, context_info: str = "") -> str:
        prompt = (
            f"Отлади проблему.\n\nОшибка:\n{error}\n\nКод:\n```\n{code}\n```\n\n"
            f"Контекст:\n{context_info}\n\n"
            "Найди причину, предложи исправление и объясни, почему ошибка произошла."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def run_lint(self, code: str, language: str = "python") -> Dict[str, Any]:
        prompt = (
            f"Запусти статический анализ кода на {language}:\n\n```{language}\n{code}\n```\n\n"
            "Проверь: стиль кода (PEP8/ESLint), типизацию, сложность, "
            "security issues, code smells. Дай список проблем с severity."
        )
        response = await self.think(AgentContext(user_id="system"), prompt)
        return {"raw": response, "issues": self._parse_issues(response)}

    def _parse_issues(self, response: str) -> list[dict]:
        issues = []
        for line in response.split("\n"):
            if any(k in line.lower() for k in ["error", "warning", "issue", "critical"]):
                issues.append({"line": line.strip()})
        return issues
