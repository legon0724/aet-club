from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import shutil, os, uuid
from backend.core.deps import get_current_user
from backend.models.database import Banner, User, get_db
from backend.models.schemas import BannerResponse

router = APIRouter()

UPLOAD_DIR = "uploads/banners"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/", response_model=List[BannerResponse])
def get_banners(db: Session = Depends(get_db)):
    banners = db.query(Banner).order_by(Banner.order_num.asc()).all()
    return [BannerResponse(
        id=str(b.id), title=b.title, image_url=b.image_url,
        link_url=b.link_url, order_num=b.order_num, is_active=b.is_active
    ) for b in banners]


@router.post("/")
async def create_banner(
    title: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    order_num: int = Form(0),
    image_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(403, detail="관리자만 가능합니다.")

    image_url = None
    if image_file and image_file.filename:
        ext = image_file.filename.split('.')[-1].lower()
        if ext not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            raise HTTPException(400, detail="이미지 파일만 가능합니다.")
        save_name = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(UPLOAD_DIR, save_name)
        with open(save_path, "wb") as f:
            shutil.copyfileobj(image_file.file, f)
        image_url = f"/api/banners/images/{save_name}"

    banner = Banner(title=title, image_url=image_url, link_url=link_url, order_num=order_num)
    db.add(banner)
    db.commit()
    return {"message": "추가되었습니다."}


@router.get("/images/{filename}")
def get_image(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404)
    return FileResponse(path)


@router.patch("/{banner_id}")
def update_banner(banner_id: str, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(403)
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(404)
    for k, v in body.items():
        setattr(banner, k, v)
    db.commit()
    return {"message": "수정되었습니다."}


@router.delete("/{banner_id}")
def delete_banner(banner_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(403)
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(404)
    if banner.image_url:
        filename = banner.image_url.split('/')[-1]
        path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(path):
            os.remove(path)
    db.delete(banner)
    db.commit()
    return {"message": "삭제되었습니다."}