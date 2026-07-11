import os
import shutil
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from backend.core.deps import get_admin_user, get_current_user
from backend.models.database import Assignment, User, get_db

router = APIRouter()

UPLOAD_DIR = os.path.join("uploads", "assignments")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def ensure_assignment_columns(db: Session):
    existing = {column["name"] for column in inspect(db.bind).get_columns("assignments")}
    columns = {
        "resource_url": "TEXT",
        "copy_mode": "VARCHAR(30) DEFAULT 'site'",
        "points": "INTEGER",
    }
    for name, definition in columns.items():
        if name not in existing:
            db.execute(text(f"ALTER TABLE assignments ADD COLUMN {name} {definition}"))
    db.commit()


def serialize_assignment(assignment: Assignment, db: Session) -> dict:
    creator = None
    if assignment.created_by:
        creator = db.query(User).filter(User.id == str(assignment.created_by)).first()
    return {
        "id": str(assignment.id),
        "team_id": str(assignment.team_id) if assignment.team_id else None,
        "title": assignment.title,
        "content": assignment.content,
        "file_url": assignment.file_url,
        "file_name": assignment.file_name,
        "resource_url": getattr(assignment, "resource_url", None),
        "copy_mode": getattr(assignment, "copy_mode", None) or "site",
        "points": getattr(assignment, "points", None),
        "due_at": assignment.due_at,
        "created_by": creator.username if creator else "관리자",
        "created_at": assignment.created_at,
    }


@router.get("/")
def get_assignments(
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ensure_assignment_columns(db)
    query = db.query(Assignment)
    if team_id:
        query = query.filter(Assignment.team_id == team_id)
    assignments = query.order_by(Assignment.created_at.desc()).all()
    return [serialize_assignment(item, db) for item in assignments]


@router.post("/")
async def create_assignment(
    title: str = Form(...),
    content: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    due_at: Optional[str] = Form(None),
    resource_url: Optional[str] = Form(None),
    copy_mode: str = Form("site"),
    points: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    ensure_assignment_columns(db)
    allowed_modes = {"site", "student_copy", "material"}
    if copy_mode not in allowed_modes:
        raise HTTPException(400, detail="지원하지 않는 과제 방식입니다.")

    file_url = None
    file_name = None

    if file and file.filename:
        ext = file.filename.split(".")[-1].lower()
        allowed = ["pdf", "hwp", "hwpx", "docx", "doc", "txt", "pptx", "xlsx", "png", "jpg", "jpeg", "zip"]
        if ext not in allowed:
            raise HTTPException(400, detail="지원하지 않는 파일 형식입니다.")

        save_name = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(UPLOAD_DIR, save_name)
        with open(save_path, "wb") as target:
            shutil.copyfileobj(file.file, target)

        file_url = f"/api/assignments/files/{save_name}"
        file_name = file.filename

    assignment = Assignment(
        team_id=team_id or None,
        title=title,
        content=content,
        file_url=file_url,
        file_name=file_name,
        resource_url=resource_url,
        copy_mode=copy_mode,
        points=points,
        due_at=due_at,
        created_by=str(current_user.id),
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return serialize_assignment(assignment, db)


@router.get("/files/{filename}")
def download_assignment_file(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path)


@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    ensure_assignment_columns(db)
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="과제를 찾을 수 없습니다.")

    if assignment.file_url:
        filename = assignment.file_url.split("/")[-1]
        path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(path):
            os.remove(path)

    db.delete(assignment)
    db.commit()
    return {"message": "삭제되었습니다."}
