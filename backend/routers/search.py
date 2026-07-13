from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.core.deps import get_current_user
from backend.models.database import Assignment, Notice, Portfolio, User, get_db

router = APIRouter()


def matches(value, query: str) -> bool:
    return query in (value or "").lower()


def make_snippet(*values) -> str:
    for value in values:
        text = (value or "").strip()
        if text:
            return text[:140]
    return ""


@router.get("/")
def search_workspace(q: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = q.strip().lower()
    if len(query) < 2:
        return []

    results = []

    notice_query = db.query(Notice)
    if not current_user.is_admin:
        notice_query = notice_query.filter(or_(Notice.team_id.is_(None), Notice.team_id == str(current_user.team_id)))
    for notice in notice_query.order_by(Notice.created_at.desc()).all():
        if matches(notice.title, query) or matches(notice.content, query):
            results.append({
                "id": str(notice.id),
                "type": "공지",
                "title": notice.title,
                "snippet": make_snippet(notice.content, notice.title),
                "href": "/",
                "date": notice.created_at,
            })

    assignment_query = db.query(Assignment)
    if not current_user.is_admin and current_user.team_id:
        assignment_query = assignment_query.filter(or_(Assignment.team_id.is_(None), Assignment.team_id == str(current_user.team_id)))
    for assignment in assignment_query.order_by(Assignment.created_at.desc()).all():
        if matches(assignment.title, query) or matches(assignment.content, query):
            results.append({
                "id": str(assignment.id),
                "type": "과제",
                "title": assignment.title,
                "snippet": make_snippet(assignment.content, assignment.due_at),
                "href": "/team",
                "date": assignment.created_at,
            })

    portfolio_query = db.query(Portfolio)
    if not current_user.is_admin:
        portfolio_query = portfolio_query.filter(or_(Portfolio.is_public.is_(True), Portfolio.user_id == str(current_user.id)))
    for portfolio in portfolio_query.order_by(Portfolio.updated_at.desc()).all():
        owner = db.query(User).filter(User.id == str(portfolio.user_id)).first()
        fields = [portfolio.intro, portfolio.projects, portfolio.skills, portfolio.awards, portfolio.goals]
        if any(matches(value, query) for value in fields) or matches(owner.username if owner else "", query):
            href = "/portfolio" if str(portfolio.user_id) == str(current_user.id) else f"/portfolio/share/{portfolio.user_id}"
            results.append({
                "id": str(portfolio.id),
                "type": "포트폴리오",
                "title": owner.username if owner else "NC member",
                "snippet": make_snippet(*fields),
                "href": href,
                "date": portfolio.updated_at,
            })

    return sorted(results, key=lambda item: item["date"], reverse=True)[:30]
