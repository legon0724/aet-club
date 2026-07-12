import os
import shutil
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.core.deps import get_admin_user, get_current_user
from backend.models.database import ActivityGalleryItem, User, get_db

router = APIRouter()

UPLOAD_DIR = os.path.join("uploads", "gallery")
os.makedirs(UPLOAD_DIR, exist_ok=True)

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
FILE_EXTENSIONS = IMAGE_EXTENSIONS | {"pdf", "ppt", "pptx", "doc", "docx", "hwp", "hwpx", "zip"}


def serialize_gallery_item(item: ActivityGalleryItem) -> dict:
    return {
        "id": str(item.id),
        "title": item.title,
        "description": item.description,
        "image_url": item.image_url,
        "file_url": item.file_url,
        "file_name": item.file_name,
        "link_url": item.link_url,
        "created_at": item.created_at,
    }


@router.get("/")
def get_gallery(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items = db.query(ActivityGalleryItem).order_by(ActivityGalleryItem.created_at.desc()).all()
    return [serialize_gallery_item(item) for item in items]


@router.post("/")
async def create_gallery_item(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    image_url = None
    file_url = None
    file_name = None

    if file and file.filename:
        ext = file.filename.split(".")[-1].lower()
        if ext not in FILE_EXTENSIONS:
            raise HTTPException(400, detail="지원하지 않는 파일 형식입니다.")

        save_name = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(UPLOAD_DIR, save_name)
        with open(save_path, "wb") as target:
            shutil.copyfileobj(file.file, target)

        file_name = file.filename
        if ext in IMAGE_EXTENSIONS:
            image_url = f"/api/gallery/files/{save_name}"
        else:
            file_url = f"/api/gallery/files/{save_name}"

    item = ActivityGalleryItem(
        title=title,
        description=description,
        image_url=image_url,
        file_url=file_url,
        file_name=file_name,
        link_url=link_url,
        created_by=str(current_user.id),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_gallery_item(item)


@router.get("/files/{filename}")
def get_gallery_file(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path)


@router.delete("/{item_id}")
def delete_gallery_item(
    item_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    item = db.query(ActivityGalleryItem).filter(ActivityGalleryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, detail="갤러리 항목을 찾을 수 없습니다.")

    media_url = item.image_url or item.file_url
    if media_url:
        path = os.path.join(UPLOAD_DIR, media_url.split("/")[-1])
        if os.path.exists(path):
            os.remove(path)

    db.delete(item)
    db.commit()
    return {"message": "삭제되었습니다."}
