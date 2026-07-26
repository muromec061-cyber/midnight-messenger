from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Bot
    bot_token: str = "8767339896:AAEWTuQ4u-PdKOv2dcp7bzuF3FsIwJfEpVg"
    webhook_url: Optional[str] = None
    webhook_secret: str = "change_me_in_production"

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    supabase_db_url: str = ""

    # PostgreSQL
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_db: str = "agent_db"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # LLM
    llm_provider: str = "openai"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_embedding_model: str = "text-embedding-3-small"

    # Ollama (self-hosted fallback)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:70b"

    # Auth
    secret_key: str = "change_me_in_production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    # Access control
    admin_ids: str = ""
    owner_id: str = ""

    # Logging
    log_level: str = "INFO"
    log_path: str = "/app/logs"

    # Backup
    backup_interval_hours: int = 6
    backup_retention_days: int = 30

    # Monitoring
    sentry_dsn: str = ""
    prometheus_port: int = 9090

    # Cloudflare
    cloudflare_tunnel_token: str = ""
    cloudflare_account_id: str = ""

    # Integrations
    docker_registry: str = ""
    docker_username: str = ""
    docker_password: str = ""
    github_token: str = ""
    github_repo: str = ""

    @property
    def database_url(self) -> str:
        if self.supabase_db_url:
            return self.supabase_db_url
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    @property
    def admin_list(self) -> list[int]:
        return [int(x.strip()) for x in self.admin_ids.split(",") if x.strip()]

    @property
    def owner(self) -> int:
        return int(self.owner_id) if self.owner_id else 0


@lru_cache()
def get_settings() -> Settings:
    return Settings()
