"""
Application configuration using Pydantic Settings.
Loads from environment variables and .env file.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Server
    port: int = 8000
    host: str = "0.0.0.0"
    env: str = "development"
    debug: bool = True

    # Gemini API (Required - 90% of AI workload)
    gemini_api_key: str = ""

    @property
    def gemini_api_keys(self) -> list[str]:
        """Return list of API keys if comma-separated."""
        if not self.gemini_api_key:
            return []
        return [k.strip() for k in self.gemini_api_key.split(",") if k.strip()]

    # Groq API (Fallback when Gemini fails)
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"  # Default Groq model (high throughput, no 1000 OTPM limit)
    groq_enabled: bool = True  # Enable Groq as fallback

    # Local LLM (Optional - 10% lightweight tasks)
    local_llm_enabled: bool = False
    local_llm_endpoint: str = "http://localhost:11434/api/generate"
    local_llm_model: str = "llama2"

    # Firebase

    firebase_project_id: str = ""
    firebase_client_email: str = ""  # New direct cred
    firebase_private_key: str = ""   # New direct cred

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Vector Database (ChromaDB)
    chroma_url: str = "http://localhost:8000"
    chroma_collection: str = "ai_agents"

    # YouTube Data API (Optional)
    youtube_api_key: str = ""

    # Authentication
    api_key_secret: str = "development_secret_key_change_in_prod"
    jwt_secret: str = "development_jwt_secret_change_in_prod"

    # Rate Limiting (requests per minute)
    rate_limit_default: int = 60
    rate_limit_heavy: int = 10

    # Badge Signing
    badge_signing_secret: str = "development_badge_secret"

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # Telemetry
    metrics_enabled: bool = True

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
