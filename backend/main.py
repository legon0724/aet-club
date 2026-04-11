from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings
from backend.models.database import init_db
from backend.routers import auth, portfolio, teams, submissions, notices, banners, ai, admin, chat

app = FastAPI(title=settings.APP_NAME, version="1.0.0", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["인증"])
app.include_router(portfolio.router,   prefix="/api/portfolio",   tags=["포트폴리오"])
app.include_router(teams.router,       prefix="/api/teams",       tags=["팀"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["과제제출"])
app.include_router(notices.router,     prefix="/api/notices",     tags=["공지"])
app.include_router(banners.router,     prefix="/api/banners",     tags=["배너"])
app.include_router(ai.router,          prefix="/api/ai",          tags=["AI분석"])
app.include_router(admin.router,       prefix="/api/admin",       tags=["관리자"])
app.include_router(chat.router,        prefix="/api/chat",        tags=["채팅"])


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}