from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Multi-Agent AI Interview Platform"

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://postgres:postgres@db:5432/interview_db"
    )

    # Redis
    REDIS_URL: str = Field(default="redis://redis:6379/0")

    # Security
    JWT_SECRET: str = Field(default="defaultlocaldevsecretkey1234567890abcdef")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # LLM Settings
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Storage S3
    S3_BUCKET: str = "interview-platform-bucket"
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_ENDPOINT_URL: Optional[str] = None

    # LangSmith settings
    LANGSMITH_API_KEY: Optional[str] = None
    LANGSMITH_PROJECT: str = "interview-platform"
    LANGSMITH_TRACING: bool = False

    # Configuration for environment loading
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
