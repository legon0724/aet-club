from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import shutil, os, uuid
from backend.core.deps import get_current_user
from backend.models.database import Portfolio, User, get_db

router = APIRouter()

UPLOAD_DIR = "uploads/portfolio"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/me")
def get_my_portfolio(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == str(current_user.id)).first()
    if not portfolio:
        return {}
    return {
        "intro": portfolio.intro,
        "projects": portfolio.projects,
        "skills": portfolio.skills,
        "awards": portfolio.awards,
        "goals": portfolio.goals,
        "is_public": portfolio.is_public,
        "github_url": portfolio.github_url,
        "blog_url": portfolio.blog_url,
        "notion_url": portfolio.notion_url,
        "profile_image": portfolio.profile_image,
    }


@router.put("/me")
async def update_my_portfolio(
    intro: Optional[str] = Form(None),
    projects: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),
    awards: Optional[str] = Form(None),
    goals: Optional[str] = Form(None),
    is_public: Optional[str] = Form("false"),
    github_url: Optional[str] = Form(None),
    blog_url: Optional[str] = Form(None),
    notion_url: Optional[str] = Form(None),
    profile_image_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == str(current_user.id)).first()
    if not portfolio:
        portfolio = Portfolio(user_id=str(current_user.id))
        db.add(portfolio)

    portfolio.intro = intro
    portfolio.projects = projects
    portfolio.skills = skills
    portfolio.awards = awards
    portfolio.goals = goals
    portfolio.is_public = is_public == "true"
    portfolio.github_url = github_url
    portfolio.blog_url = blog_url
    portfolio.notion_url = notion_url

    if profile_image_file and profile_image_file.filename:
        ext = profile_image_file.filename.split('.')[-1].lower()
        if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            save_name = f"{uuid.uuid4().hex}.{ext}"
            save_path = os.path.join(UPLOAD_DIR, save_name)
            with open(save_path, "wb") as f:
                shutil.copyfileobj(profile_image_file.file, f)
            portfolio.profile_image = f"/api/portfolio/images/{save_name}"

    db.commit()
    return {"message": "저장되었습니다."}


@router.get("/images/{filename}")
def get_image(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, detail="이미지를 찾을 수 없습니다.")
    return FileResponse(path)


@router.get("/{user_id}")
def get_portfolio(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
    if not portfolio:
        raise HTTPException(404, detail="포트폴리오를 찾을 수 없습니다.")
    if not portfolio.is_public and not current_user.is_admin and str(current_user.id) != user_id:
        raise HTTPException(403, detail="비공개 포트폴리오입니다.")
    user = db.query(User).filter(User.id == user_id).first()
    return {
        "username": user.username if user else None,
        "intro": portfolio.intro,
        "projects": portfolio.projects,
        "skills": portfolio.skills,
        "awards": portfolio.awards,
        "goals": portfolio.goals,
        "github_url": portfolio.github_url,
        "blog_url": portfolio.blog_url,
        "notion_url": portfolio.notion_url,
        "profile_image": portfolio.profile_image,
    }