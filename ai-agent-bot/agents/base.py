import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from langchain_core.messages import BaseMessage

logger = logging.getLogger("agent-bot.agents")


class AgentContext:
    def __init__(
        self,
        user_id: str,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        memory_context: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.user_id = user_id
        self.project_id = project_id
        self.task_id = task_id
        self.history = history or []
        self.memory_context = memory_context or ""
        self.metadata = metadata or {}
        self.artifacts: Dict[str, Any] = {}
        self.errors: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "project_id": self.project_id,
            "task_id": self.task_id,
            "history": self.history,
            "memory_context": self.memory_context,
            "metadata": self.metadata,
            "artifacts": self.artifacts,
            "errors": self.errors,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentContext":
        ctx = cls(
            user_id=data["user_id"],
            project_id=data.get("project_id"),
            task_id=data.get("task_id"),
            history=data.get("history", []),
            memory_context=data.get("memory_context", ""),
            metadata=data.get("metadata", {}),
        )
        ctx.artifacts = data.get("artifacts", {})
        ctx.errors = data.get("errors", [])
        return ctx


class BaseAgent(ABC):
    name: str = "base"
    description: str = ""
    capabilities: List[str] = []

    def __init__(self, llm_client: Any):
        self.llm = llm_client
        self.system_prompt = self._load_system_prompt()

    @abstractmethod
    def _load_system_prompt(self) -> str:
        raise NotImplementedError

    @abstractmethod
    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        raise NotImplementedError

    async def think(self, context: AgentContext, input_text: str) -> str:
        response = await self.llm.ainvoke_with_system(
            system=self.system_prompt,
            user=self._render_prompt(context, input_text),
        )
        return response

    def _render_prompt(self, context: AgentContext, input_text: str) -> str:
        parts = []
        if context.memory_context:
            parts.append(f"=== Память ===\n{context.memory_context}\n")
        if context.history:
            parts.append("=== История ===")
            for msg in context.history[-10:]:
                parts.append(f"{msg.get('role', 'user')}: {msg.get('content', '')}")
            parts.append("")
        parts.append(f"=== Задача ===\n{input_text}")
        return "\n".join(parts)

    def can_handle(self, task_type: str) -> bool:
        return task_type in self.capabilities
