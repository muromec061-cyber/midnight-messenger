import json
import logging
import re
from typing import Annotated, Any, Dict, List, Optional, Sequence, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from agents.base import AgentContext, BaseAgent

logger = logging.getLogger("agent-bot.agents.supervisor")


class SupervisorState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    next_agent: Optional[str]
    context: AgentContext
    artifacts: Dict[str, Any]
    task_complete: bool


class SupervisorAgent(BaseAgent):
    name = "supervisor"
    description = "Главный агент: маршрутизация задач, координация, принятие решений"
    capabilities = ["supervise", "route", "plan", "coordinate"]

    def _load_system_prompt(self) -> str:
        return (
            "Ты — главный агент-координатор системы AI. "
            "Твоя задача: понять, что хочет пользователь, выбрать нужного специалиста "
            "(программист, аналитик, планировщик, память, тестировщик, деплой, поиск), "
            "делегировать задачу и вернуть структурированный ответ. "
            "Всегда отвечай кратко и по делу. Используй русский язык."
        )

    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        decision = await self._decide_agent(context, input_text)
        context.metadata["next_agent"] = decision.get("agent", "coder")
        context.metadata["reasoning"] = decision.get("reasoning", "")
        context.metadata["confidence"] = decision.get("confidence", "medium")
        logger.info("Supervisor routed task to %s", decision.get("agent"))
        return context

    async def _decide_agent(self, context: AgentContext, input_text: str) -> Dict[str, Any]:
        routing_prompt = (
            "Выбери, какому агенту передать задачу. Доступные агенты:\n"
            "- coder: написание кода, ревью, исправление ошибок, создание ботов/сайтов/SaaS\n"
            "- analyst: анализ требований, данных, архитектуры\n"
            "- planner: планирование, декомпозиция задач, roadmaps\n"
            "- memory: поиск в долговременной памяти, сохранение контекста\n"
            "- tester: написание тестов, QA, отладка\n"
            "- deployer: деплой, CI/CD, Docker, инфраструктура\n"
            "- researcher: поиск информации, изучение технологий\n\n"
            f"Задача: {input_text}\n"
            "Ответ строго в JSON: {\"agent\": \"имя_агента\", \"reasoning\": \"...\", \"confidence\": \"high|medium|low\"}"
        )
        response = await self.llm.ainvoke_with_system(
            system="Ты — маршрутизатор задач. Отвечай только JSON.",
            user=routing_prompt,
            temperature=0.1,
        )
        try:
            match = re.search(r"\{.*\}", response, re.DOTALL)
            if match:
                return json.loads(match.group(0))
        except Exception:
            logger.debug("Failed to parse supervisor decision: %s", response)
        return {"agent": "coder", "reasoning": "default", "confidence": "low"}


class LangGraphOrchestrator:
    def __init__(self, agents: Dict[str, BaseAgent]):
        self.agents = agents
        self.supervisor = agents.get("supervisor")
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(SupervisorState)

        for agent_name, agent in self.agents.items():
            graph.add_node(agent_name, self._make_node(agent))

        graph.add_conditional_edges(
            "supervisor",
            self._route,
            {name: name for name in self.agents if name != "supervisor"},
        )
        for agent_name in self.agents:
            if agent_name != "supervisor":
                graph.add_edge(agent_name, "supervisor")

        graph.set_entry_point("supervisor")
        graph.add_edge("supervisor", END)
        return graph.compile()

    def _make_node(self, agent: BaseAgent):
        async def node(state: Dict[str, Any]) -> Dict[str, Any]:
            context: AgentContext = state.get("context")
            last_message = state["messages"][-1] if state.get("messages") else None
            user_input = last_message.content if last_message else ""
            new_context = await agent.execute(context, user_input)
            response_text = await agent.think(context, user_input)
            return {
                "messages": [AIMessage(content=response_text, name=agent.name)],
                "context": new_context,
                "next_agent": None,
                "task_complete": True,
                "artifacts": new_context.artifacts,
            }
        return node

    def _route(self, state: Dict[str, Any]) -> str:
        context: AgentContext = state.get("context")
        if context and context.metadata.get("next_agent"):
            return context.metadata["next_agent"]
        return "coder"

    async def run(self, context: AgentContext, user_input: str) -> AgentContext:
        initial_state = {
            "messages": [HumanMessage(content=user_input)],
            "context": context,
            "next_agent": None,
            "artifacts": {},
            "task_complete": False,
        }
        result = await self.graph.ainvoke(initial_state)
        if result.get("messages"):
            last = result["messages"][-1]
            if hasattr(last, "content") and last.content:
                context.history.append({"role": "assistant", "agent": getattr(last, "name", "unknown"), "content": last.content})
        return result.get("context", context)
