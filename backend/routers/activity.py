from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.core.deps import get_current_user
from backend.models.database import ActivityGalleryItem, Portfolio, Submission, User, get_db
from backend.routers.submissions import ensure_submission_columns

router = APIRouter()


def has_text(value) -> bool:
    return bool((value or "").strip())


def build_badges(metrics: dict) -> List[dict]:
    badges = []
    rules = [
        ("starter", "시작 배지", "첫 활동 기록을 남겼습니다.", metrics["score"] >= 10),
        ("submitter", "제출 루틴", "과제를 제출했습니다.", metrics["submitted_count"] >= 1),
        ("portfolio", "포트폴리오 공개", "공개 포트폴리오를 열었습니다.", metrics["portfolio_public"]),
        ("project", "프로젝트 기록", "프로젝트 내용을 정리했습니다.", metrics["project_ready"]),
        ("presenter", "발표 기록", "발표나 활동 자료를 공유했습니다.", metrics["gallery_count"] >= 1 or metrics["award_ready"]),
    ]

    for key, label, description, earned in rules:
        badges.append({
            "key": key,
            "label": label,
            "description": description,
            "earned": earned,
        })

    return badges


@router.get("/me")
def get_my_activity(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_submission_columns(db)

    submissions = db.query(Submission).filter(Submission.user_id == str(current_user.id)).all()
    submitted_count = sum(1 for item in submissions if (item.status or "submitted") == "submitted")
    draft_count = sum(1 for item in submissions if item.status == "draft")

    portfolio = db.query(Portfolio).filter(Portfolio.user_id == str(current_user.id)).first()
    portfolio_sections = 0
    project_ready = False
    award_ready = False
    portfolio_public = False
    if portfolio:
        portfolio_sections = sum(
            1 for value in [portfolio.intro, portfolio.projects, portfolio.skills, portfolio.awards, portfolio.goals]
            if has_text(value)
        )
        project_ready = has_text(portfolio.projects)
        award_ready = has_text(portfolio.awards)
        portfolio_public = bool(portfolio.is_public)

    gallery_count = db.query(ActivityGalleryItem).filter(ActivityGalleryItem.created_by == str(current_user.id)).count()
    score = (
        submitted_count * 15
        + draft_count * 5
        + portfolio_sections * 4
        + (10 if portfolio_public else 0)
        + (8 if project_ready else 0)
        + (8 if award_ready else 0)
        + gallery_count * 12
    )

    metrics = {
        "score": score,
        "submitted_count": submitted_count,
        "draft_count": draft_count,
        "portfolio_sections": portfolio_sections,
        "portfolio_public": portfolio_public,
        "project_ready": project_ready,
        "award_ready": award_ready,
        "gallery_count": gallery_count,
    }

    return {
        **metrics,
        "badges": build_badges(metrics),
    }
