from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import inspect, or_, text
from sqlalchemy.orm import Session
from typing import List, Optional
from threading import Lock
import shutil, os, uuid
from backend.core.deps import get_current_user
from backend.models.database import Assignment, Submission, ActivityLog, User, get_db
from backend.models.schemas import SubmissionResponse
from backend.services.google_workspace import create_student_copy

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

_submission_schema_ready = False
_submission_schema_lock = Lock()


class AssignmentWorkDraft(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    link_url: Optional[str] = None
    work_content: Optional[str] = ""


def ensure_submission_columns(db: Session):
    global _submission_schema_ready
    if _submission_schema_ready:
        return
    with _submission_schema_lock:
        if _submission_schema_ready:
            return
        existing = {column["name"] for column in inspect(db.bind).get_columns("submissions")}
        columns = {
            "assignment_id": "VARCHAR(36)",
            "assignment_title": "VARCHAR(255)",
            "work_content": "TEXT",
            "status": "VARCHAR(20) DEFAULT 'submitted'",
            "updated_at": "TIMESTAMP",
        }
        for name, definition in columns.items():
            if name not in existing:
                db.execute(text(f"ALTER TABLE submissions ADD COLUMN {name} {definition}"))
        db.commit()
        _submission_schema_ready = True


def serialize_submission(submission: Submission, db: Session, users: Optional[dict] = None) -> SubmissionResponse:
    user = users.get(str(submission.user_id)) if users is not None else db.query(User).filter(User.id == str(submission.user_id)).first()
    return SubmissionResponse(
        id=str(submission.id),
        title=submission.title,
        content=submission.content,
        assignment_id=str(submission.assignment_id) if submission.assignment_id else None,
        assignment_title=submission.assignment_title,
        work_content=submission.work_content,
        file_url=submission.file_url,
        file_name=submission.file_name,
        link_url=submission.link_url,
        status=submission.status or "submitted",
        created_at=submission.created_at,
        updated_at=submission.updated_at or submission.created_at,
        username=user.username if user else None,
    )


def find_user_assignment_work(db: Session, user_id: str, assignment_id: str):
    return db.query(Submission).filter(
        Submission.user_id == str(user_id),
        Submission.assignment_id == assignment_id,
    ).first()


@router.get("/", response_model=List[SubmissionResponse])
def get_submissions(team_id: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_submission_columns(db)
    query = db.query(Submission)
    if team_id:
        query = query.filter(or_(Submission.team_id == team_id, Submission.team_id.is_(None)))
    if current_user.is_admin:
        query = query.filter(or_(Submission.status == "submitted", Submission.status.is_(None)))
    else:
        query = query.filter(Submission.user_id == str(current_user.id))
    submissions = query.order_by(Submission.created_at.desc()).all()
    user_ids = {str(item.user_id) for item in submissions if item.user_id}
    users = {str(user.id): user for user in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return [serialize_submission(item, db, users) for item in submissions]


@router.get("/work/{assignment_id}", response_model=SubmissionResponse)
def get_assignment_work(assignment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_submission_columns(db)
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="과제를 찾을 수 없습니다.")

    work = find_user_assignment_work(db, str(current_user.id), assignment_id)
    if work:
        return serialize_submission(work, db)

    workspace_type = getattr(assignment, "workspace_type", None) or "none"
    template_id = getattr(assignment, "google_template_id", None)
    if workspace_type != "none" and template_id:
        copied = create_student_copy(
            template_id,
            assignment.title,
            current_user.email,
            current_user.username,
        )
        work = Submission(
            user_id=str(current_user.id),
            team_id=str(assignment.team_id) if assignment.team_id else None,
            assignment_id=assignment_id,
            assignment_title=assignment.title,
            title=assignment.title,
            link_url=copied.get("webViewLink"),
            work_content="",
            status="draft",
            updated_at=datetime.utcnow(),
        )
        db.add(work)
        db.commit()
        db.refresh(work)
        return serialize_submission(work, db)

    return SubmissionResponse(
        id=f"draft-{assignment_id}",
        title=assignment.title,
        content="",
        assignment_id=assignment_id,
        assignment_title=assignment.title,
        work_content="",
        file_url=None,
        file_name=None,
        link_url=None,
        status="draft",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        username=current_user.username,
    )


@router.put("/work/{assignment_id}", response_model=SubmissionResponse)
def save_assignment_work(
    assignment_id: str,
    body: AssignmentWorkDraft,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_submission_columns(db)
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(404, detail="과제를 찾을 수 없습니다.")

    work = find_user_assignment_work(db, str(current_user.id), assignment_id)
    if not work:
        work = Submission(
            user_id=str(current_user.id),
            team_id=str(assignment.team_id) if assignment.team_id else None,
            assignment_id=assignment_id,
            assignment_title=assignment.title,
            title=body.title or assignment.title,
            status="draft",
        )
        db.add(work)

    work.title = body.title or assignment.title
    work.content = body.content
    if body.link_url is not None:
        work.link_url = body.link_url
    work.work_content = body.work_content or ""
    work.assignment_title = assignment.title
    work.team_id = str(assignment.team_id) if assignment.team_id else work.team_id
    if work.status != "submitted":
        work.status = "draft"
    work.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(work)
    return serialize_submission(work, db)


@router.post("/")
async def create_submission(
    title: str = Form(...),
    content: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    assignment_id: Optional[str] = Form(None),
    assignment_title: Optional[str] = Form(None),
    work_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ensure_submission_columns(db)
    file_url = None
    file_name = None

    if file and file.filename:
        ext = file.filename.split('.')[-1].lower()
        allowed = ['pdf', 'hwp', 'hwpx', 'docx', 'doc', 'txt', 'pptx', 'xlsx', 'png', 'jpg', 'jpeg', 'zip']
        if ext not in allowed:
            raise HTTPException(400, detail="지원하지 않는 파일 형식입니다.")

        save_name = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(UPLOAD_DIR, save_name)
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        file_url = f"/api/submissions/files/{save_name}"
        file_name = file.filename

    assignment = None
    if assignment_id:
        assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()

    submission = None
    if assignment_id:
        submission = find_user_assignment_work(db, str(current_user.id), assignment_id)

    if not submission:
        submission = Submission(user_id=str(current_user.id))
        db.add(submission)

    submission.team_id = team_id or (str(assignment.team_id) if assignment and assignment.team_id else None)
    submission.assignment_id = assignment_id
    submission.assignment_title = assignment_title or (assignment.title if assignment else None)
    submission.title = title
    submission.content = content
    submission.work_content = work_content if work_content is not None else submission.work_content
    if link_url is not None:
        submission.link_url = link_url
    if file_url:
        submission.file_url = file_url
        submission.file_name = file_name
    submission.status = "submitted"
    submission.updated_at = datetime.utcnow()

    log = ActivityLog(user_id=str(current_user.id), action_type="submission")
    db.add(log)
    db.commit()
    return {"message": "제출되었습니다."}


@router.get("/files/{filename}")
def download_file(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path)


@router.delete("/{submission_id}")
def delete_submission(submission_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_submission_columns(db)
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(404, detail="찾을 수 없습니다.")
    if str(submission.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(403, detail="권한이 없습니다.")
    assignment = None
    if submission.assignment_id:
        assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    if assignment and (getattr(assignment, "workspace_type", None) or "none") != "none":
        submission.status = "draft"
        submission.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "제출을 취소했습니다."}
    if submission.file_url:
        filename = submission.file_url.split('/')[-1]
        path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(path):
            os.remove(path)
    db.delete(submission)
    db.commit()
    return {"message": "삭제되었습니다."}
