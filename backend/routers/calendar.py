from datetime import datetime
from threading import Lock
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, inspect, or_, text
from sqlalchemy.orm import Session

from backend.core.deps import get_admin_user, get_current_user
from backend.models.database import CalendarEvent, User, get_db

router = APIRouter()

_calendar_schema_ready = False
_calendar_schema_lock = Lock()


class CalendarEventCreate(BaseModel):
    title: str
    start_date: str
    end_date: Optional[str] = None
    event_type: str = "일정"
    team_id: Optional[str] = None


def parse_date(value: Optional[str]):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, detail="날짜 형식이 올바르지 않습니다.")


def ensure_calendar_columns(db: Session):
    global _calendar_schema_ready
    if _calendar_schema_ready:
        return
    with _calendar_schema_lock:
        if _calendar_schema_ready:
            return
        existing = {column["name"] for column in inspect(db.bind).get_columns("calendar_events")}
        if "is_public" not in existing:
            db.execute(text("ALTER TABLE calendar_events ADD COLUMN is_public BOOLEAN DEFAULT TRUE"))
        db.execute(text("UPDATE calendar_events SET is_public = TRUE WHERE is_public IS NULL"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_calendar_owner_start ON calendar_events (created_by, start_date)"))
        db.commit()
        _calendar_schema_ready = True


def serialize_event(event: CalendarEvent, current_user: User) -> dict:
    is_public = getattr(event, "is_public", True) is not False
    is_owner = str(event.created_by) == str(current_user.id) if event.created_by else False
    return {
        "id": str(event.id),
        "title": event.title,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "team_id": str(event.team_id) if event.team_id else None,
        "event_type": event.event_type,
        "created_by": str(event.created_by) if event.created_by else None,
        "is_public": is_public,
        "is_owner": is_owner,
        "editable": bool(is_owner and not is_public),
    }


@router.get("/")
def get_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_calendar_columns(db)
    query = db.query(CalendarEvent)
    public_events = or_(CalendarEvent.is_public.is_(True), CalendarEvent.is_public.is_(None))
    if not current_user.is_admin and current_user.team_id:
        public_events = and_(public_events, or_(CalendarEvent.team_id.is_(None), CalendarEvent.team_id == str(current_user.team_id)))
    personal_events = and_(CalendarEvent.is_public.is_(False), CalendarEvent.created_by == str(current_user.id))
    query = query.filter(or_(public_events, personal_events))
    events = query.order_by(CalendarEvent.start_date.asc()).all()
    return [serialize_event(event, current_user) for event in events]


@router.get("/admin")
def get_admin_events(db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    ensure_calendar_columns(db)
    events = (
        db.query(CalendarEvent)
        .filter(or_(CalendarEvent.is_public.is_(True), CalendarEvent.is_public.is_(None)))
        .order_by(CalendarEvent.start_date.asc())
        .all()
    )
    return [serialize_event(event, current_user) for event in events]


@router.post("/")
def create_event(body: CalendarEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    ensure_calendar_columns(db)
    event = CalendarEvent(
        title=body.title.strip(),
        start_date=parse_date(body.start_date),
        end_date=parse_date(body.end_date),
        team_id=body.team_id or None,
        event_type=body.event_type or "일정",
        created_by=str(current_user.id),
        is_public=True,
    )
    if not event.title:
        raise HTTPException(400, detail="제목을 입력해 주세요.")
    db.add(event)
    db.commit()
    db.refresh(event)
    return serialize_event(event, current_user)


@router.post("/personal")
def create_personal_event(body: CalendarEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_calendar_columns(db)
    event = CalendarEvent(
        title=body.title.strip(),
        start_date=parse_date(body.start_date),
        end_date=parse_date(body.end_date),
        team_id=None,
        event_type=body.event_type or "개인",
        created_by=str(current_user.id),
        is_public=False,
    )
    if not event.title:
        raise HTTPException(400, detail="제목을 입력해 주세요.")
    db.add(event)
    db.commit()
    db.refresh(event)
    return serialize_event(event, current_user)


@router.delete("/personal/{event_id}")
def delete_personal_event(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_calendar_columns(db)
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, detail="일정을 찾을 수 없습니다.")
    if getattr(event, "is_public", True) is not False or str(event.created_by) != str(current_user.id):
        raise HTTPException(403, detail="관리자 일정은 변경할 수 없습니다.")
    db.delete(event)
    db.commit()
    return {"message": "삭제되었습니다."}


@router.delete("/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    ensure_calendar_columns(db)
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, detail="일정을 찾을 수 없습니다.")
    if getattr(event, "is_public", True) is False:
        raise HTTPException(403, detail="개인 일정은 관리자 화면에서 삭제할 수 없습니다.")
    db.delete(event)
    db.commit()
    return {"message": "삭제되었습니다."}
