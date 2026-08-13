import os
import shutil
import uuid
from datetime import datetime
from threading import Lock
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.core.deps import get_admin_user, get_current_user
from backend.models.database import Assignment, Team, User, get_db
from backend.services.google_workspace import WORKSPACE_MIME_TYPES

router = APIRouter()

UPLOAD_DIR = os.path.join("uploads", "assignments")
os.makedirs(UPLOAD_DIR, exist_ok=True)

_assignment_schema_ready = False
_assignment_schema_lock = Lock()


def ensure_assignment_columns(db: Session):
    global _assignment_schema_ready
    if _assignment_schema_ready:
        return
    with _assignment_schema_lock:
        if _assignment_schema_ready:
            return
        existing = {column["name"] for column in inspect(db.bind).get_columns("assignments")}
        columns = {
            "resource_url": "TEXT",
            "copy_mode": "VARCHAR(30) DEFAULT 'site'",
            "points": "INTEGER",
            "workspace_type": "VARCHAR(20) DEFAULT 'none'",
            "google_template_id": "VARCHAR(255)",
            "request_key": "VARCHAR(100)",
            "start_at": "VARCHAR(50)",
        }
        for name, definition in columns.items():
            if name not in existing:
                db.execute(text(f"ALTER TABLE assignments ADD COLUMN {name} {definition}"))
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_assignments_request_key ON assignments (request_key) WHERE request_key IS NOT NULL"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_assignments_team_created_at ON assignments (team_id, created_at)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_assignments_created_at ON assignments (created_at)"))
        db.commit()
        _assignment_schema_ready = True


def serialize_assignment(assignment: Assignment, db: Session, creators: Optional[dict] = None) -> dict:
    creator = creators.get(str(assignment.created_by)) if creators is not None and assignment.created_by else None
    if creators is None and assignment.created_by:
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
        "workspace_type": getattr(assignment, "workspace_type", None) or "none",
        "start_at": getattr(assignment, "start_at", None),
        "due_at": assignment.due_at,
        "created_by": creator.username if creator else "관리자",
        "created_at": assignment.created_at,
    }


@router.get("/workspace-status")
def get_workspace_status(_: User = Depends(get_current_user)):
    return {"configured": True, "mode": "manual_copy"}


@router.get("/")
def get_assignments(
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_assignment_columns(db)
    query = db.query(Assignment)
    if team_id:
        if not current_user.is_admin and str(current_user.team_id or "") != team_id:
            raise HTTPException(403, detail="소속 팀의 과제만 확인할 수 있습니다.")
        query = query.filter(Assignment.team_id == team_id)
    else:
        query = query.filter(Assignment.team_id.is_(None))
    assignments = query.order_by(Assignment.created_at.desc()).all()
    creator_ids = {str(item.created_by) for item in assignments if item.created_by}
    creators = {str(user.id): user for user in db.query(User).filter(User.id.in_(creator_ids)).all()} if creator_ids else {}
    return [serialize_assignment(item, db, creators) for item in assignments]


@router.post("/")
async def create_assignment(
    title: str = Form(...),
    content: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    start_at: Optional[str] = Form(None),
    due_at: Optional[str] = Form(None),
    resource_url: Optional[str] = Form(None),
    copy_mode: str = Form("site"),
    workspace_type: str = Form("none"),
    points: Optional[int] = Form(None),
    request_key: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    ensure_assignment_columns(db)
    if team_id and not db.query(Team).filter(Team.id == team_id).first():
        raise HTTPException(404, detail="선택한 팀을 찾을 수 없습니다.")
    allowed_modes = {"site", "student_copy", "material"}
    if copy_mode not in allowed_modes:
        raise HTTPException(400, detail="지원하지 않는 과제 방식입니다.")
    if workspace_type not in {"none", *WORKSPACE_MIME_TYPES.keys()}:
        raise HTTPException(400, detail="지원하지 않는 Google 문서 유형입니다.")
    if start_at and due_at:
        try:
            if datetime.fromisoformat(due_at) < datetime.fromisoformat(start_at):
                raise HTTPException(400, detail="마감일은 시작일보다 빠를 수 없습니다.")
        except ValueError:
            raise HTTPException(400, detail="과제 날짜 형식이 올바르지 않습니다.")

    normalized_request_key = request_key.strip()[:100] if request_key else None
    if normalized_request_key:
        existing_assignment = db.query(Assignment).filter(Assignment.request_key == normalized_request_key).first()
        if existing_assignment:
            return serialize_assignment(existing_assignment, db)

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

    if workspace_type != "none":
        normalized_resource_url = (resource_url or "").strip()
        if not normalized_resource_url or "docs.google.com" not in normalized_resource_url:
            raise HTTPException(400, detail="Google Docs, Sheets 또는 Slides 원본 링크를 입력해주세요.")
        resource_url = normalized_resource_url
        copy_mode = "student_copy"

    assignment = Assignment(
        team_id=team_id or None,
        title=title,
        content=content,
        file_url=file_url,
        file_name=file_name,
        resource_url=resource_url,
        copy_mode=copy_mode,
        points=points,
        workspace_type=workspace_type,
        google_template_id=None,
        request_key=normalized_request_key,
        start_at=start_at,
        due_at=due_at,
        created_by=str(current_user.id),
    )
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if normalized_request_key:
            existing_assignment = db.query(Assignment).filter(Assignment.request_key == normalized_request_key).first()
            if existing_assignment:
                return serialize_assignment(existing_assignment, db)
        raise
    db.refresh(assignment)
    return serialize_assignment(assignment, db)


@router.get("/files/{filename}")
def download_assignment_file(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path)


@router.patch("/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    title: str = Form(...),
    content: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    start_at: Optional[str] = Form(None),
    due_at: Optional[str] = Form(None),
    resource_url: Optional[str] = Form(None),
    copy_mode: str = Form("site"),
    workspace_type: str = Form("none"),
    points: Optional[str] = Form(None),
    remove_file: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    ensure_assignment_columns(db)
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="과제를 찾을 수 없습니다.")

    normalized_title = title.strip()
    normalized_team_id = (team_id or "").strip() or None
    normalized_resource_url = (resource_url or "").strip() or None
    if not normalized_title:
        raise HTTPException(400, detail="과제 제목을 입력해주세요.")
    if normalized_team_id and not db.query(Team).filter(Team.id == normalized_team_id).first():
        raise HTTPException(404, detail="선택한 팀을 찾을 수 없습니다.")
    if copy_mode not in {"site", "student_copy", "material"}:
        raise HTTPException(400, detail="지원하지 않는 과제 방식입니다.")
    if workspace_type not in {"none", *WORKSPACE_MIME_TYPES.keys()}:
        raise HTTPException(400, detail="지원하지 않는 Google 문서 유형입니다.")
    if start_at and due_at:
        try:
            if datetime.fromisoformat(due_at) < datetime.fromisoformat(start_at):
                raise HTTPException(400, detail="마감일은 시작일보다 빠를 수 없습니다.")
        except ValueError:
            raise HTTPException(400, detail="과제 날짜 형식이 올바르지 않습니다.")
    if workspace_type != "none":
        if not normalized_resource_url or "docs.google.com" not in normalized_resource_url:
            raise HTTPException(400, detail="Google Docs, Sheets 또는 Slides 원본 링크를 입력해주세요.")
        copy_mode = "student_copy"

    normalized_points = None
    if points not in (None, ""):
        try:
            normalized_points = int(points)
        except ValueError:
            raise HTTPException(400, detail="배점은 숫자로 입력해주세요.")
        if normalized_points < 0:
            raise HTTPException(400, detail="배점은 0점 이상이어야 합니다.")

    old_file_path = None
    if assignment.file_url and (remove_file or (file and file.filename)):
        old_file_path = os.path.join(UPLOAD_DIR, assignment.file_url.split("/")[-1])

    new_file_path = None
    if file and file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        allowed = ["pdf", "hwp", "hwpx", "docx", "doc", "txt", "pptx", "xlsx", "png", "jpg", "jpeg", "zip"]
        if ext not in allowed:
            raise HTTPException(400, detail="지원하지 않는 파일 형식입니다.")
        save_name = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(UPLOAD_DIR, save_name)
        with open(save_path, "wb") as target:
            shutil.copyfileobj(file.file, target)
        new_file_path = save_path
        assignment.file_url = f"/api/assignments/files/{save_name}"
        assignment.file_name = file.filename
    elif remove_file:
        assignment.file_url = None
        assignment.file_name = None

    assignment.title = normalized_title
    assignment.content = (content or "").strip() or None
    assignment.team_id = normalized_team_id
    assignment.start_at = start_at or None
    assignment.due_at = due_at or None
    assignment.resource_url = normalized_resource_url
    assignment.copy_mode = copy_mode
    assignment.workspace_type = workspace_type
    assignment.points = normalized_points
    try:
        db.commit()
    except Exception:
        db.rollback()
        if new_file_path and os.path.exists(new_file_path):
            os.remove(new_file_path)
        raise
    db.refresh(assignment)

    if old_file_path and os.path.exists(old_file_path):
        os.remove(old_file_path)

    return serialize_assignment(assignment, db)


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
