import logging
from typing import Any

from agents.base import AgentContext, BaseAgent

logger = logging.getLogger("agent-bot.agents.researcher")


class ResearcherAgent(BaseAgent):
    name = "researcher"
    description = "Агент поиска: поиск информации, изучение технологий, мониторинг"
    capabilities = ["research", "search", "learn", "monitor", "document"]

    def _load_system_prompt(self) -> str:
        return (
            "Ты — исследователь и аналитик информации. "
            "Ищешь актуальную информацию в интернете, изучаешь новые технологии, "
            "отслеживаешь тренды, готовишь обзоры. "
            "Всегда указывай источники, проверяй факты, структурируй ответ."
        )

    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        research = await self.research(input_text)
        context.artifacts["research"] = research
        return context

    async def think(self, context: AgentContext, input_text: str) -> str:
        return await self.llm.ainvoke_with_system(
            system=self.system_prompt,
            user=self._render_prompt(context, input_text),
        )

    async def research(self, query: str) -> Dict[str, Any]:
        prompt = (
            f"Проведи исследование по теме:\n\n{query}\n\n"
            "Структура ответа:\n"
            "## Ключевые факты\n[главные выводы]\n\n"
            "## Детали\n[подробности с источниками]\n\n"
            "## Тренды\n[что происходит в индустрии]\n\n"
            "## Рекомендации\n[что делать дальше]"
        )
        response = await self.llm.ainvoke_with_system(system=self.system_prompt, user=prompt)
        return {"raw": response, "query": query}

    async def compare_technologies(self, technologies: str) -> str:
        prompt = (
            f"Сравни технологии:\n\n{technologies}\n\n"
            "Сравни по критериям: производительность, экосистема, "
            "сложность, стоимость, сообщество, использование в production."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def learn_topic(self, topic: str, level: str = "intermediate") -> str:
        prompt = (
            f"Составь обучающий материал по теме '{topic}' для уровня '{level}'.\n\n"
            "Включи: основы, примеры кода, лучшие практики, "
            "частые ошибки, ссылки на документацию."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def monitor_project(self, project_description: str) -> str:
        prompt = (
            f"Состав план мониторинга для проекта:\n\n{project_description}\n\n"
            "Включи: метрики (SLO/SLA), дашборды, алерты, "
            "логирование, трассировка, incident response."
        )
        return await self.think(AgentContext(user_id="system"), prompt)
