from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.core.deps import get_current_user
from backend.models.database import Notice, User, get_db
from backend.models.schemas import NoticeCreate, NoticeResponse

router = APIRouter()


@router.get("/", response_model=List[NoticeResponse])
def get_notices(team_id: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Notice)
    if team_id:
        query = query.filter(Notice.team_id == team_id)
    # 고정 공지 먼저, 나머지는 오래된 순 (새 공지가 아래로)
    notices = query.order_by(Notice.is_pinned.desc(), Notice.created_at.asc()).all()
    return [NoticeResponse(
        id=str(n.id), title=n.title, content=n.content,
        is_pinned=n.is_pinned, team_id=str(n.team_id) if n.team_id else None,
        created_at=n.created_at
    ) for n in notices]


@router.post("/")
def create_notice(body: NoticeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(403, detail="관리자만 공지를 작성할 수 있습니다.")
    notice = Notice(
        title=body.title, content=body.content,
        is_pinned=body.is_pinned, team_id=body.team_id,
        created_by=str(current_user.id)
    )
    db.add(notice)
    db.commit()
    return {"message": "작성되었습니다."}


@router.delete("/{notice_id}")
def delete_notice(notice_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(403, detail="관리자만 삭제할 수 있습니다.")
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(404, detail="찾을 수 없습니다.")
    db.delete(notice)
    db.commit()
    return {"message": "삭제되었습니다."}