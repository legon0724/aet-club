from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil, os, uuid
from backend.core.deps import get_current_user
from backend.models.database import Submission, ActivityLog, User, get_db
from backend.models.schemas import SubmissionResponse

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/", response_model=List[SubmissionResponse])
def get_submissions(team_id: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Submission)
    if team_id:
        query = query.filter(Submission.team_id == team_id)
    submissions = query.order_by(Submission.created_at.desc()).all()
    result = []
    for s in submissions:
        user = db.query(User).filter(User.id == str(s.user_id)).first()
        result.append(SubmissionResponse(
            id=str(s.id), title=s.title, content=s.content,
            file_url=s.file_url, file_name=s.file_name,
            link_url=s.link_url,
            created_at=s.created_at, username=user.username if user else None
        ))
    return result


@router.post("/")
async def create_submission(
    title: str = Form(...),
    content: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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

    submission = Submission(
        user_id=str(current_user.id),
        team_id=team_id,
        title=title,
        content=content,
        file_url=file_url,
        file_name=file_name,
        link_url=link_url,
    )
    db.add(submission)
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
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(404, detail="찾을 수 없습니다.")
    if str(submission.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(403, detail="권한이 없습니다.")
    if submission.file_url:
        filename = submission.file_url.split('/')[-1]
        path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(path):
            os.remove(path)
    db.delete(submission)
    db.commit()
    return {"message": "삭제되었습니다."}