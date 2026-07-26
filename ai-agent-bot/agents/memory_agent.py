import logging
from typing import Any

from agents.base import AgentContext, BaseAgent

logger = logging.getLogger("agent-bot.agents.memory")


class MemoryAgent(BaseAgent):
    name = "memory"
    description = "Агент памяти: долговременная память, поиск, сохранение контекста"
    capabilities = ["remember", "recall", "search", "summarize", "context"]

    def _load_system_prompt(self) -> str:
        return (
            "Ты — агент долговременной памяти. "
            "Сохраняешь важную информацию, ищешь по истории, "
            "суммаризуешь контекст, напоминаешь о важном. "
            "Всегда отвечай кратко и по фактам."
        )

    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        memory = get_memory()
        results = memory.search(
            query=input_text,
            project=context.project_id,
            user_id=context.user_id,
            limit=10,
        )
        context.memory_context = "\n".join(
            f"[{r.get('updated', '')}] {r.get('title', '')}: {r.get('path', '')}"
            for r in results
        )
        return context

    async def think(self, context: AgentContext, input_text: str) -> str:
        return await self.llm.ainvoke_with_system(
            system=self.system_prompt,
            user=self._render_prompt(context, input_text),
        )

    async def save_memory(
        self,
        content: str,
        title: str,
        user_id: str,
        project_id: Optional[str] = None,
        note_type: str = "note",
        tags: Optional[list[str]] = None,
    ) -> str:
        memory = get_memory()
        return memory.save_note(
            content=content,
            title=title,
            user_id=user_id,
            project=project_id,
            note_type=note_type,
            tags=tags or [],
        )

    async def recall(self, query: str, user_id: str, project_id: Optional[str] = None, limit: int = 10) -> str:
        memory = get_memory()
        results = memory.search(query, project=project_id, user_id=user_id, limit=limit)
        if not results:
            return "Ничего не найдено в памяти."
        lines = [f"Найдено {len(results)} записей:"]
        for r in results:
            lines.append(f"- {r.get('title', 'Без названия')} ({r.get('type', 'note')})")
        return "\n".join(lines)

    async def summarize_context(self, history: list[dict]) -> str:
        if not history:
            return "Контекст пуст."
        prompt = (
            "Суммаризируй следующий диалог кратко, выделяя ключевые факты, "
            "решения и open questions:\n\n"
            + "\n".join(f"{m.get('role', '?')}: {m.get('content', '')}" for m in history[-20:])
        )
        return await self.think(AgentContext(user_id="system"), prompt)
