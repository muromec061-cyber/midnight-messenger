import logging
from typing import Any

from agents.base import AgentContext, BaseAgent

logger = logging.getLogger("agent-bot.agents.analyst")


class AnalystAgent(BaseAgent):
    name = "analyst"
    description = "Агент-аналитик: анализ требований, данных, архитектуры"
    capabilities = ["analyze", "review", "requirements", "data", "architecture"]

    def _load_system_prompt(self) -> str:
        return (
            "Ты — технический аналитик и архитектор. "
            "Анализируешь требования, данные, архитектуру проектов. "
            "Составляешь технические задания, оцениваешь сложность, "
            "находим риски и предлагаешь решения. "
            "Работаешь с Python, TypeScript, SQL, PostgreSQL, REST API, микросервисами. "
            "Отвечай структурированно: краткое резюме, детали, рекомендации."
        )

    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        return context

    async def think(self, context: AgentContext, input_text: str) -> str:
        prompt = (
            f"Проанализируй следующий запрос:\n\n{input_text}\n\n"
            "Предоставь анализ в формате:\n"
            "## Резюме\n[краткое описание]\n\n"
            "## Детали\n[подробности]\n\n"
            "## Риски\n[список рисков]\n\n"
            "## Рекомендации\n[конкретные шаги]"
        )
        return await self.llm.ainvoke_with_system(system=self.system_prompt, user=prompt)

    async def analyze_requirements(self, requirements: str) -> str:
        prompt = (
            f"Проанализируй требования:\n\n{requirements}\n\n"
            "Выдели: функциональные требования, нефункциональные, стейкхолдеров, "
            "User Stories, приоритеты (MoSCoW), критерии приёмки."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def analyze_code(self, code: str, language: str = "python") -> str:
        prompt = (
            f"Проанализируй архитектуру и качество кода на {language}:\n\n```{language}\n{code}\n```\n"
            "Оцени: модульность, читаемость, масштабируемость, безопасность, "
            "соблюдение принципов SOLID, DRY, KISS."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def generate_technical_spec(self, idea: str) -> str:
        prompt = (
            f"Составь техническое задание на основе идеи:\n\n{idea}\n\n"
            "Структура ТЗ:\n"
            "1. Назначение и цели\n"
            "2. Функциональные требования\n"
            "3. Нефункциональные требования\n"
            "4. Технологический стек\n"
            "5. Архитектура системы\n"
            "6. API контракты\n"
            "7. Схема данных\n"
            "8. План разработки\n"
            "9. Критерии приёмки"
        )
        return await self.think(AgentContext(user_id="system"), prompt)
