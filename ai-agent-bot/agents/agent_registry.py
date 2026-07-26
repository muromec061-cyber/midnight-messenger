import logging
from typing import Any, Dict

from agents.analyst import AnalystAgent
from agents.coder import CoderAgent
from agents.deployer import DeployerAgent
from agents.memory_agent import MemoryAgent
from agents.planner import PlannerAgent
from agents.researcher import ResearcherAgent
from agents.supervisor import SupervisorAgent, LangGraphOrchestrator
from agents.tester import TesterAgent
from services.llm_service import get_llm_client

logger = logging.getLogger("agent-bot.agents.registry")


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: Dict[str, Any] = {}
        self._orchestrator: LangGraphOrchestrator | None = None

    def register(self, agent: Any) -> None:
        self._agents[agent.name] = agent
        logger.info("Registered agent: %s", agent.name)

    def get(self, name: str) -> Any | None:
        return self._agents.get(name)

    def list_agents(self) -> list[dict]:
        return [
            {"name": name, "description": agent.description, "capabilities": agent.capabilities}
            for name, agent in self._agents.items()
        ]

    def get_orchestrator(self) -> LangGraphOrchestrator:
        if self._orchestrator is None:
            self._orchestrator = LangGraphOrchestrator(agents=self._agents)
        return self._orchestrator

    @classmethod
    def default(cls) -> "AgentRegistry":
        registry = cls()
        llm = get_llm_client()
        registry.register(SupervisorAgent(llm_client=llm))
        registry.register(CoderAgent(llm_client=llm))
        registry.register(AnalystAgent(llm_client=llm))
        registry.register(PlannerAgent(llm_client=llm))
        registry.register(MemoryAgent(llm_client=llm))
        registry.register(TesterAgent(llm_client=llm))
        registry.register(DeployerAgent(llm_client=llm))
        registry.register(ResearcherAgent(llm_client=llm))
        return registry


_registry: AgentRegistry | None = None


def get_registry() -> AgentRegistry:
    global _registry
    if _registry is None:
        _registry = AgentRegistry.default()
    return _registry
