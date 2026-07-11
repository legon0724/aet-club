from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.core.deps import get_admin_user
from backend.models.database import User, Portfolio, Submission, AIUsage, get_db
from backend.models.schemas import UserResponse

router = APIRouter()


class UserAdminUpdate(BaseModel):
    is_admin: Optional[bool] = None
    team_id: Optional[str] = None


@router.get("/users", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/admin")
def toggle_admin(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="사용자를 찾을 수 없습니다.")
    if str(user.id) == str(current_user.id):
        raise HTTPException(400, detail="본인의 권한은 변경할 수 없습니다.")
    user.is_admin = not user.is_admin
    db.commit()
    return {"message": "권한이 변경되었습니다.", "is_admin": user.is_admin}


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: str, body: UserAdminUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="사용자를 찾을 수 없습니다.")

    if body.is_admin is not None:
        if str(user.id) == str(current_user.id):
            raise HTTPException(400, detail="본인의 권한은 변경할 수 없습니다.")
        user.is_admin = body.is_admin

    if body.team_id is not None:
        user.team_id = body.team_id or None

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="사용자를 찾을 수 없습니다.")
    if str(user.id) == str(current_user.id):
        raise HTTPException(400, detail="본인 계정은 삭제할 수 없습니다.")
    db.delete(user)
    db.commit()
    return {"message": "삭제되었습니다."}


@router.get("/portfolios")
def get_all_portfolios(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    portfolios = db.query(Portfolio).all()
    result = []
    for p in portfolios:
        user = db.query(User).filter(User.id == str(p.user_id)).first()
        result.append({
            "user_id": str(p.user_id),
            "username": user.username if user else None,
            "email": user.email if user else None,
            "intro": p.intro,
            "projects": p.projects,
            "skills": p.skills,
            "awards": p.awards,
            "goals": p.goals,
            "is_public": p.is_public,
            "github_url": p.github_url,
            "blog_url": p.blog_url,
            "notion_url": p.notion_url,
            "profile_image": p.profile_image,
        })
    return result


@router.get("/ai-usage")
def get_ai_usage(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    usage_list = db.query(AIUsage).order_by(AIUsage.last_used_at.desc()).all()
    result = []
    for u in usage_list:
        user = db.query(User).filter(User.id == str(u.user_id)).first()
        result.append({
            "username": user.username if user else None,
            "date": u.date,
            "count": u.count,
            "last_used_at": u.last_used_at,
        })
    return result
