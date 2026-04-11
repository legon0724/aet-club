from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.core.deps import get_current_user, get_admin_user
from backend.models.database import Banner, User, get_db
from backend.models.schemas import BannerCreate, BannerResponse

router = APIRouter()


@router.get("/", response_model=List[BannerResponse])
def get_banners(db: Session = Depends(get_db)):
    return db.query(Banner).filter(Banner.is_active == True).order_by(Banner.order_num).all()


@router.post("/")
def create_banner(body: BannerCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    banner = Banner(**body.model_dump())
    db.add(banner)
    db.commit()
    return {"message": "배너가 등록되었습니다."}


@router.put("/{banner_id}")
def update_banner(banner_id: str, body: BannerCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(404, detail="찾을 수 없습니다.")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(banner, key, value)
    db.commit()
    return {"message": "수정되었습니다."}


@router.delete("/{banner_id}")
def delete_banner(banner_id: str, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(404, detail="찾을 수 없습니다.")
    db.delete(banner)
    db.commit()
    return {"message": "삭제되었습니다."}