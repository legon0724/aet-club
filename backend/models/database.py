import uuid
from datetime import datetime
from typing import Any
from urllib.parse import quote_plus
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey,
    Integer, String, Text, TypeDecorator, create_engine
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from backend.core.config import settings


class UUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value: Any, dialect: Any):
        if value is None:
            return None
        return uuid.UUID(str(value))


def get_db_url() -> str:
    if settings.USE_SQLITE:
        return "sqlite:///./aet_club.db"
    if settings.CLOUD_SQL_INSTANCE:
        socket_dir = f"/cloudsql/{settings.CLOUD_SQL_INSTANCE}"
        return (
            f"postgresql+pg8000://{settings.DB_USER}:{quote_plus(settings.DB_PASSWORD)}"
            f"@/{settings.DB_NAME}?unix_sock={socket_dir}/.s.PGSQL.5432"
        )
    return (
        f"postgresql+pg8000://{settings.DB_USER}:{quote_plus(settings.DB_PASSWORD)}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )


_db_url = get_db_url()
_connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
engine = create_engine(_db_url, echo=False, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    privacy_consented = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    team_id = Column(UUID(), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)

    portfolio = relationship("Portfolio", back_populates="user", uselist=False, cascade="all, delete")
    submissions = relationship("Submission", back_populates="user", cascade="all, delete")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete")
    ai_usage = relationship("AIUsage", back_populates="user", cascade="all, delete")


class Team(Base):
    __tablename__ = "teams"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#3b82f6")
    created_at = Column(DateTime, default=datetime.utcnow)


class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    intro = Column(Text, nullable=True)
    projects = Column(Text, nullable=True)
    skills = Column(Text, nullable=True)
    awards = Column(Text, nullable=True)
    goals = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False)
    github_url = Column(Text, nullable=True)
    blog_url = Column(Text, nullable=True)
    notion_url = Column(Text, nullable=True)
    profile_image = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="portfolio")


class Submission(Base):
    __tablename__ = "submissions"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(UUID(), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    link_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="submissions")


class Notice(Base):
    __tablename__ = "notices"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    is_pinned = Column(Boolean, default=False)
    team_id = Column(UUID(), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(UUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Banner(Base):
    __tablename__ = "banners"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=True)
    image_url = Column(Text, nullable=True)
    link_url = Column(Text, nullable=True)
    order_num = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    github_url = Column(Text, nullable=True)
    demo_url = Column(Text, nullable=True)
    tags = Column(String(255), nullable=True)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    team_id = Column(UUID(), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(20), default="일정")
    created_by = Column(UUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class AIUsage(Base):
    __tablename__ = "ai_usage"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(10), nullable=False)
    count = Column(Integer, default=0)
    last_used_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="ai_usage")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="activity_logs")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    username = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)