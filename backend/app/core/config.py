import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Powered Intelligent Email Assistant"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkeyforlocalemailassistantjwttokengeneration")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    # Default to SQLite local file, but can be overridden by PostgreSQL URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./emails.db")

    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB: int = int(os.getenv("REDIS_DB", 0))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD", None)

    # API Keys & Third-party integrations
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    HUGGINGFACE_API_KEY: Optional[str] = os.getenv("HUGGINGFACE_API_KEY", "")
    
    # Email settings
    MOCK_EMAIL_INTERVAL_SECONDS: int = int(os.getenv("MOCK_EMAIL_INTERVAL_SECONDS", 15))
    REAL_EMAIL_SYNC_ENABLED: bool = os.getenv("REAL_EMAIL_SYNC_ENABLED", "false").lower() == "true"
    IMAP_SERVER: Optional[str] = os.getenv("IMAP_SERVER", "imap.gmail.com")
    IMAP_USERNAME: Optional[str] = os.getenv("IMAP_USERNAME", "")
    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET", "")

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
