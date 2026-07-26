import logging
from typing import Any

from agents.base import AgentContext, BaseAgent

logger = logging.getLogger("agent-bot.agents.deployer")


class DeployerAgent(BaseAgent):
    name = "deployer"
    description = "Агент деплоя: CI/CD, Docker, инфраструктура, мониторинг"
    capabilities = ["deploy", "docker", "cicd", "infrastructure", "monitoring"]

    def _load_system_prompt(self) -> str:
        return (
            "Ты — DevOps-инженер. "
            "Создаёшь Dockerfile, docker-compose.yml, CI/CD пайплайны. "
            "Деплоишь на AWS, GCP, Azure, Fly.io, Railway, Render, Supabase. "
            "Настраиваешь мониторинг, логирование, алерты, резервное копирование. "
            "Всегда следуй security best practices, используй secrets management."
        )

    async def execute(self, context: AgentContext, input_text: str) -> AgentContext:
        deploy_plan = await self._create_deploy_plan(input_text)
        context.artifacts["deploy_plan"] = deploy_plan
        return context

    async def think(self, context: AgentContext, input_text: str) -> str:
        return await self.llm.ainvoke_with_system(
            system=self.system_prompt,
            user=self._render_prompt(context, input_text),
        )

    async def _create_deploy_plan(self, task: str) -> Dict[str, Any]:
        prompt = (
            f"Создай план деплоя для:\n\n{task}\n\n"
            "Включи:\n"
            "## Инфраструктура\n[провайдер, регионы, scaling]\n\n"
            "## Docker\n[Dockerfile, docker-compose, оптимизация]\n\n"
            "## CI/CD\n[пайплайн, этапы, окружения]\n\n"
            "## Мониторинг\n[метрики, логи, алерты]\n\n"
            "## Безопасность\n[secrets, TLS, firewall, WAF]\n\n"
            "## Резервное копирование\n[стратегия, retention, recovery]"
        )
        response = await self.llm.ainvoke_with_system(system=self.system_prompt, user=prompt)
        return {"raw": response}

    async def generate_dockerfile(self, project_type: str, base_image: str = "python:3.12-slim") -> str:
        prompt = (
            f"Сгенерируй production-ready Dockerfile для {project_type}.\n"
            f"Базовый образ: {base_image}.\n"
            "Требования:\n"
            "1. Multi-stage build\n"
            "2. Не запускать как root\n"
            "3. Health check\n"
            "4. Минимальный размер образа\n"
            "5. Кэширование слоёв\n"
            "6. ENV переменные"
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def generate_ci_cd(self, platform: str = "github") -> str:
        prompt = (
            f"Сгенерируй CI/CD конфигурацию для {platform}.\n"
            "Включи: линтинг, тесты, сборку, деплой, проверки безопасности."
        )
        return await self.think(AgentContext(user_id="system"), prompt)

    async def suggest_infrastructure(self, project_description: str) -> str:
        prompt = (
            f"Предложи инфраструктуру для проекта:\n\n{project_description}\n\n"
            "Укажи: облачный провайдер, сервисы (база, кэш, очередь, CDN), "
            "стоимость, scaling strategy, disaster recovery."
        )
        return await self.think(AgentContext(user_id="system"), prompt)
