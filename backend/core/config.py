from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "AET 동아리 API"
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    ADMIN_EMAILS: List[str] = [
        "hyouk0724@gmail.com",
        "2620325@cam.hs.kr",
        "bliss00@cam.hs.kr",
        "gssth8286@gmail.com",
    ]

    ALLOWED_EMAIL_DOMAIN: str = "@cam.hs.kr"

    USE_SQLITE: bool = True
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "aet_club"
    DB_USER: str = "aet_user"
    DB_PASSWORD: str = "password"
    CLOUD_SQL_INSTANCE: str = ""

    GCS_BUCKET_NAME: str = "aet-club-files"
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    FRONTEND_URL: str = "http://localhost:5173"

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    class Config:
        env_file = "backend/.env"
        env_file_encoding = "utf-8"


settings = Settings()