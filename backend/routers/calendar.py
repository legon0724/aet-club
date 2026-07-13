from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.core.deps import get_admin_user, get_current_user
from backend.models.database import CalendarEvent, User, get_db

router = APIRouter()


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


def serialize_event(event: CalendarEvent) -> dict:
    return {
        "id": str(event.id),
        "title": event.title,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "team_id": str(event.team_id) if event.team_id else None,
        "event_type": event.event_type,
    }


@router.get("/")
def get_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(CalendarEvent)
    if not current_user.is_admin and current_user.team_id:
        query = query.filter(or_(CalendarEvent.team_id.is_(None), CalendarEvent.team_id == str(current_user.team_id)))
    events = query.order_by(CalendarEvent.start_date.asc()).all()
    return [serialize_event(event) for event in events]


@router.post("/")
def create_event(body: CalendarEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    event = CalendarEvent(
        title=body.title.strip(),
        start_date=parse_date(body.start_date),
        end_date=parse_date(body.end_date),
        team_id=body.team_id or None,
        event_type=body.event_type or "일정",
        created_by=str(current_user.id),
    )
    if not event.title:
        raise HTTPException(400, detail="제목을 입력해 주세요.")
    db.add(event)
    db.commit()
    db.refresh(event)
    return serialize_event(event)


@router.delete("/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, detail="일정을 찾을 수 없습니다.")
    db.delete(event)
    db.commit()
    return {"message": "삭제되었습니다."}
