from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.core.deps import get_current_user
from backend.models.database import Notice, NoticeRead, User, get_db
from backend.models.schemas import NoticeCreate, NoticeReadStatusResponse, NoticeResponse

router = APIRouter()


def can_read_notice(notice: Notice, user: User) -> bool:
    return user.is_admin or notice.team_id is None or str(notice.team_id) == str(user.team_id)


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


@router.get("/read-status", response_model=List[NoticeReadStatusResponse])
def get_notice_read_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(403, detail="관리자만 읽음 현황을 볼 수 있습니다.")

    notices = db.query(Notice).order_by(Notice.is_pinned.desc(), Notice.created_at.asc()).all()
    users = db.query(User).order_by(User.username.asc()).all()
    reads = db.query(NoticeRead).all()

    users_by_id = {str(user.id): user for user in users}
    reads_by_notice = {}
    for read in reads:
        reads_by_notice.setdefault(str(read.notice_id), []).append(read)

    result = []
    for notice in notices:
        notice_id = str(notice.id)
        notice_reads = reads_by_notice.get(notice_id, [])
        read_user_ids = {str(read.user_id) for read in notice_reads}
        readers = []
        for read in notice_reads:
            reader = users_by_id.get(str(read.user_id))
            if reader:
                readers.append({
                    "user_id": str(reader.id),
                    "username": reader.username,
                    "email": reader.email,
                    "read_at": read.read_at,
                })
        unread_users = [
            {
                "user_id": str(user.id),
                "username": user.username,
                "email": user.email,
                "read_at": None,
            }
            for user in users
            if str(user.id) not in read_user_ids
        ]
        result.append({
            "notice_id": notice_id,
            "title": notice.title,
            "created_at": notice.created_at,
            "read_count": len(readers),
            "unread_count": len(unread_users),
            "total_users": len(users),
            "readers": readers,
            "unread_users": unread_users,
        })
    return result


@router.post("/{notice_id}/read")
def mark_notice_read(notice_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(404, detail="공지사항을 찾을 수 없습니다.")
    if not can_read_notice(notice, current_user):
        raise HTTPException(403, detail="이 공지를 읽을 수 없습니다.")

    read = db.query(NoticeRead).filter(
        NoticeRead.notice_id == notice_id,
        NoticeRead.user_id == current_user.id,
    ).first()
    if read:
        read.read_at = datetime.utcnow()
    else:
        db.add(NoticeRead(notice_id=notice.id, user_id=current_user.id))
    db.commit()
    return {"message": "읽음 처리되었습니다."}


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
