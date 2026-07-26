import logging
from typing import Any

from agents.base import AgentContext, BaseAgent

logger = logging.getLogger("agent-bot.agents.planner")


class PlannerAgent(BaseAgent):
    name = "planner"
    description = "Агент-планировщик: декомпозиция, roadmaps, планирование"
    capabilities = ["plan", "decompose", "roadmap", "schedule", "estimate"]

    def _load_system_prompt(self) -> str:
        return (
            "Ты — технический планировщик и менеджер проектов. "
            "Умеешь декомпозировать сложные задачи, строить roadmaps, "
            "оценивать сроки и ресурсы, создавать планы разработки. "
            "Работаешь по методологиям Agile, Scrum, Kanban. "
            "Предлагай конкретные, выполнимые шаги с оценкой времени."
        )

    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        plan = await self._create_plan(context, input_text)
        context.artifacts["plan"] = plan
        return context

    async def think(self, context: AgentContext, input_text: str) -> str:
        return await self.think(context, input_text)

    async def _create_plan(self, context: AgentContext, input_text: str) -> Dict[str, Any]:
        prompt = (
            f"Создай детальный план реализации:\n\n{input_text}\n\n"
            "Структура плана:\n"
            "## Цель\n[что нужно сделать]\n\n"
            "## Этапы\n1. Название этапа\n   - Задачи\n   - Приоритет (P0/P1/P2)\n   - Оценка (часы/дни)\n\n"
            "## Риски\n[список рисков с mitigations]\n\n"
            "## Milestones\n[ключевые точки контроля]\n\n"
            "## Ресурсы\n[команда, инструменты, зависимостeй]"
        )
        response = await self.llm.ainvoke_with_system(system=self.system_prompt, user=prompt)
        return {"raw": response}

    async def decompose_task(self, task: str) -> list[dict]:
        prompt = (
            f"Декомпозируй задачу на подзадачи:\n\n{task}\n\n"
            "Для каждой подзадачи укажи: название, описание, оценка (story points), "
            "зависимости, критерии готовности."
        )
        response = await self.llm.ainvoke_with_system(system=self.system_prompt, user=prompt)
        return self._parse_tasks(response)

    def _parse_tasks(self, response: str) -> list[dict]:
        tasks = []
        for line in response.split("\n"):
            if line.strip().startswith(("-", "*", "##")):
                tasks.append({"title": line.strip(), "raw": line})
        return tasks or [{"title": response[:200], "raw": response}]

    async def estimate(self, task: str) -> Dict[str, Any]:
        prompt = (
            f"Оцени сложность реализации:\n\n{task}\n\n"
            "Укажи: story points, оптимистичная/пессимистичная оценка в часах, "
            "ключевые сложности, риски задержек."
        )
        response = await self.llm.ainvoke_with_system(system=self.system_prompt, user=prompt)
        return {"raw": response}

    async def think(self, context: AgentContext, input_text: str) -> str:
        return await self._create_plan(context, input_text).get("raw", "")
