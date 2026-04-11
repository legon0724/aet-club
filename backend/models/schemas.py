from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    privacy_consented: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    is_admin: bool
    team_id: Optional[str] = None
    created_at: datetime

    @field_validator('id', 'team_id', mode='before')
    @classmethod
    def uuid_to_str(cls, v):
        if v is None:
            return None
        return str(v)

    class Config:
        from_attributes = True


class PortfolioSchema(BaseModel):
    intro: Optional[str] = None
    projects: Optional[str] = None
    skills: Optional[str] = None
    awards: Optional[str] = None
    goals: Optional[str] = None
    is_public: Optional[bool] = False

    class Config:
        from_attributes = True


class TeamSchema(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    color: str = "#3b82f6"

    class Config:
        from_attributes = True


class SubmissionCreate(BaseModel):
    title: str
    content: Optional[str] = None
    team_id: Optional[str] = None
    link_url: Optional[str] = None


class SubmissionResponse(BaseModel):
    id: str
    title: str
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    link_url: Optional[str] = None
    created_at: datetime
    username: Optional[str] = None

    class Config:
        from_attributes = True


class NoticeCreate(BaseModel):
    title: str
    content: Optional[str] = None
    is_pinned: bool = False
    team_id: Optional[str] = None


class NoticeResponse(BaseModel):
    id: str
    title: str
    content: Optional[str] = None
    is_pinned: bool
    team_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BannerCreate(BaseModel):
    title: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    order_num: int = 0
    is_active: bool = True


class BannerResponse(BaseModel):
    id: str
    title: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    order_num: int
    is_active: bool

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    tags: Optional[str] = None
    team_id: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    tags: Optional[str] = None
    likes: int
    created_at: datetime

    class Config:
        from_attributes = True


class AIAnalysisRequest(BaseModel):
    record_text: str
    target_major: str
    target_university: Optional[str] = None
    target_admission: Optional[str] = None


class CalendarEventCreate(BaseModel):
    title: str
    start_date: datetime
    end_date: Optional[datetime] = None
    team_id: Optional[str] = None
    event_type: str = "일정"


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    start_date: datetime
    end_date: Optional[datetime] = None
    team_id: Optional[str] = None
    event_type: str

    class Config:
        from_attributes = True