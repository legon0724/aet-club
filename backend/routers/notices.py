from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.core.deps import get_current_user, get_admin_user
from backend.models.database import Notice, User, get_db
from backend.models.schemas import NoticeCreate, NoticeResponse

router = APIRouter()


@router.get("/", response_model=List[NoticeResponse])
def get_notices(team_id: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(Notice)
    if team_id:
        query = query.filter(Notice.team_id == team_id)
    return query.order_by(Notice.is_pinned.desc(), Notice.created_at.desc()).all()


@router.post("/")
def create_notice(body: NoticeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    notice = Notice(
        title=body.title,
        content=body.content,
        is_pinned=body.is_pinned,
        team_id=body.team_id,
        created_by=str(current_user.id),
    )
    db.add(notice)
    db.commit()
    return {"message": "공지가 등록되었습니다."}


@router.delete("/{notice_id}")
def delete_notice(notice_id: str, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(404, detail="찾을 수 없습니다.")
    db.delete(notice)
    db.commit()
    return {"message": "삭제되었습니다."}