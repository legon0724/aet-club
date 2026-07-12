from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.core.deps import get_admin_user
from backend.models.database import Assignment, User, Portfolio, Submission, AIUsage, get_db
from backend.models.schemas import UserResponse
from backend.routers.submissions import ensure_submission_columns

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


@router.get("/assignment-status")
def get_assignment_status(team_id: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    ensure_submission_columns(db)

    assignment_query = db.query(Assignment)
    user_query = db.query(User)
    if team_id:
        assignment_query = assignment_query.filter(Assignment.team_id == team_id)
        user_query = user_query.filter(User.team_id == team_id)

    assignments = assignment_query.order_by(Assignment.created_at.desc()).all()
    users = user_query.order_by(User.username.asc()).all()
    assignment_ids = [str(assignment.id) for assignment in assignments]
    submissions = []
    if assignment_ids:
        submissions = db.query(Submission).filter(Submission.assignment_id.in_(assignment_ids)).all()

    work_by_assignment_user = {}
    for item in submissions:
        key = (str(item.assignment_id), str(item.user_id))
        existing = work_by_assignment_user.get(key)
        if not existing or item.status == "submitted" or (item.updated_at or item.created_at) > (existing.updated_at or existing.created_at):
            work_by_assignment_user[key] = item

    result = []
    for assignment in assignments:
        students = []
        counts = {"submitted": 0, "draft": 0, "missing": 0}
        for user in users:
            work = work_by_assignment_user.get((str(assignment.id), str(user.id)))
            status = "missing"
            updated_at = None
            if work:
                status = "submitted" if work.status == "submitted" else "draft"
                updated_at = work.updated_at or work.created_at
            counts[status] += 1
            students.append({
                "user_id": str(user.id),
                "username": user.username,
                "email": user.email,
                "status": status,
                "updated_at": updated_at,
            })
        result.append({
            "assignment_id": str(assignment.id),
            "title": assignment.title,
            "due_at": assignment.due_at,
            "submitted_count": counts["submitted"],
            "draft_count": counts["draft"],
            "missing_count": counts["missing"],
            "total_count": len(users),
            "students": students,
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
