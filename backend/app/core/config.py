from pydantic_settings import BaseSettings
from typing import List, Optional
import secrets
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "Kanbot"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    ENVIRONMENT: str = "development"
    
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    DATABASE_URL: str = "postgresql+asyncpg://kanbot:kanbot_secret@localhost:5432/kanbot"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    ADMIN_EMAIL: Optional[str] = None
    ADMIN_PASSWORD: Optional[str] = None
    
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"
    
    def validate_secret_key(self) -> None:
        if not self.SECRET_KEY:
            if self.is_production:
                raise ValueError("SECRET_KEY must be set in production environment")
            self.SECRET_KEY = secrets.token_urlsafe(32)
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
settings.validate_secret_key()
