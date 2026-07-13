from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend.core.deps import get_admin_user
from backend.models.database import (
    ActivityGalleryItem,
    Assignment,
    Banner,
    CalendarEvent,
    Notice,
    Team,
    User,
    Portfolio,
    Submission,
    AIUsage,
    get_db,
)
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


def iso(value):
    return value.isoformat() if value else None


def parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


@router.get("/backup")
def export_backup(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    return {
        "version": 1,
        "exported_at": datetime.utcnow().isoformat(),
        "teams": [
            {
                "id": str(item.id),
                "name": item.name,
                "description": item.description,
                "color": item.color,
                "created_at": iso(item.created_at),
            }
            for item in db.query(Team).all()
        ],
        "notices": [
            {
                "id": str(item.id),
                "title": item.title,
                "content": item.content,
                "is_pinned": item.is_pinned,
                "team_id": str(item.team_id) if item.team_id else None,
                "created_at": iso(item.created_at),
            }
            for item in db.query(Notice).all()
        ],
        "assignments": [
            {
                "id": str(item.id),
                "team_id": str(item.team_id) if item.team_id else None,
                "title": item.title,
                "content": item.content,
                "resource_url": item.resource_url,
                "copy_mode": item.copy_mode,
                "points": item.points,
                "due_at": item.due_at,
                "created_at": iso(item.created_at),
            }
            for item in db.query(Assignment).all()
        ],
        "calendar_events": [
            {
                "id": str(item.id),
                "title": item.title,
                "start_date": iso(item.start_date),
                "end_date": iso(item.end_date),
                "team_id": str(item.team_id) if item.team_id else None,
                "event_type": item.event_type,
            }
            for item in db.query(CalendarEvent).all()
        ],
        "gallery": [
            {
                "id": str(item.id),
                "title": item.title,
                "description": item.description,
                "image_url": item.image_url,
                "file_url": item.file_url,
                "file_name": item.file_name,
                "link_url": item.link_url,
                "created_at": iso(item.created_at),
            }
            for item in db.query(ActivityGalleryItem).all()
        ],
        "banners": [
            {
                "id": str(item.id),
                "title": item.title,
                "image_url": item.image_url,
                "link_url": item.link_url,
                "order_num": item.order_num,
                "is_active": item.is_active,
                "created_at": iso(item.created_at),
            }
            for item in db.query(Banner).all()
        ],
        "portfolios": [
            {
                "id": str(item.id),
                "user_id": str(item.user_id),
                "intro": item.intro,
                "projects": item.projects,
                "skills": item.skills,
                "awards": item.awards,
                "goals": item.goals,
                "is_public": item.is_public,
                "github_url": item.github_url,
                "blog_url": item.blog_url,
                "notion_url": item.notion_url,
                "profile_image": item.profile_image,
                "updated_at": iso(item.updated_at),
            }
            for item in db.query(Portfolio).all()
        ],
    }


@router.post("/backup")
def restore_backup(data: dict, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    for entry in data.get("teams", []):
        item = db.query(Team).filter(Team.id == entry.get("id")).first() if entry.get("id") else None
        if not item:
            item = Team(id=entry.get("id") or None, name=entry.get("name") or "복원된 팀")
            db.add(item)
        item.name = entry.get("name") or item.name
        item.description = entry.get("description")
        item.color = entry.get("color") or item.color

    for entry in data.get("notices", []):
        item = db.query(Notice).filter(Notice.id == entry.get("id")).first() if entry.get("id") else None
        if not item:
            item = Notice(id=entry.get("id") or None, title=entry.get("title") or "복원된 공지")
            db.add(item)
        item.title = entry.get("title") or item.title
        item.content = entry.get("content")
        item.is_pinned = bool(entry.get("is_pinned"))
        item.team_id = entry.get("team_id") or None

    for entry in data.get("assignments", []):
        item = db.query(Assignment).filter(Assignment.id == entry.get("id")).first() if entry.get("id") else None
        if not item:
            item = Assignment(id=entry.get("id") or None, title=entry.get("title") or "복원된 과제")
            db.add(item)
        item.title = entry.get("title") or item.title
        item.content = entry.get("content")
        item.team_id = entry.get("team_id") or None
        item.resource_url = entry.get("resource_url")
        item.copy_mode = entry.get("copy_mode") or "site"
        item.points = entry.get("points")
        item.due_at = entry.get("due_at")

    for entry in data.get("calendar_events", []):
        item = db.query(CalendarEvent).filter(CalendarEvent.id == entry.get("id")).first() if entry.get("id") else None
        if not item:
            item = CalendarEvent(
                id=entry.get("id") or None,
                title=entry.get("title") or "복원된 일정",
                start_date=parse_datetime(entry.get("start_date")) or datetime.utcnow(),
            )
            db.add(item)
        item.title = entry.get("title") or item.title
        item.start_date = parse_datetime(entry.get("start_date")) or item.start_date
        item.end_date = parse_datetime(entry.get("end_date"))
        item.team_id = entry.get("team_id") or None
        item.event_type = entry.get("event_type") or "일정"

    for entry in data.get("gallery", []):
        item = db.query(ActivityGalleryItem).filter(ActivityGalleryItem.id == entry.get("id")).first() if entry.get("id") else None
        if not item:
            item = ActivityGalleryItem(id=entry.get("id") or None, title=entry.get("title") or "복원된 자료")
            db.add(item)
        item.title = entry.get("title") or item.title
        item.description = entry.get("description")
        item.image_url = entry.get("image_url")
        item.file_url = entry.get("file_url")
        item.file_name = entry.get("file_name")
        item.link_url = entry.get("link_url")

    for entry in data.get("banners", []):
        item = db.query(Banner).filter(Banner.id == entry.get("id")).first() if entry.get("id") else None
        if not item:
            item = Banner(id=entry.get("id") or None)
            db.add(item)
        item.title = entry.get("title")
        item.image_url = entry.get("image_url")
        item.link_url = entry.get("link_url")
        item.order_num = entry.get("order_num") or 0
        item.is_active = bool(entry.get("is_active", True))

    for entry in data.get("portfolios", []):
        item = db.query(Portfolio).filter(Portfolio.id == entry.get("id")).first() if entry.get("id") else None
        if not item and entry.get("user_id"):
            item = db.query(Portfolio).filter(Portfolio.user_id == entry.get("user_id")).first()
        if not item and entry.get("user_id"):
            item = Portfolio(id=entry.get("id") or None, user_id=entry.get("user_id"))
            db.add(item)
        if item:
            item.intro = entry.get("intro")
            item.projects = entry.get("projects")
            item.skills = entry.get("skills")
            item.awards = entry.get("awards")
            item.goals = entry.get("goals")
            item.is_public = bool(entry.get("is_public"))
            item.github_url = entry.get("github_url")
            item.blog_url = entry.get("blog_url")
            item.notion_url = entry.get("notion_url")
            item.profile_image = entry.get("profile_image")

    db.commit()
    return {"message": "백업을 복원했습니다."}


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
