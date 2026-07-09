from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.core.deps import get_current_user
from backend.core.security import create_access_token, hash_password, is_admin_email, is_allowed_email, verify_password
from backend.models.database import User, get_db
from backend.models.schemas import LoginRequest, PasswordResetRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if not is_allowed_email(body.email):
        raise HTTPException(400, detail="@cam.hs.kr 학교 이메일만 가입 가능합니다.")
    if not body.privacy_consented:
        raise HTTPException(400, detail="개인정보 처리방침에 동의해주세요.")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, detail="이미 사용 중인 이메일입니다.")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, detail="이미 사용 중인 닉네임입니다.")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        is_admin=is_admin_email(body.email),
        privacy_consented=body.privacy_consented,
    )
    db.add(user)
    db.commit()
    return {"message": "가입이 완료되었습니다."}


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    return TokenResponse(access_token=create_access_token({"sub": str(user.id)}))


@router.post("/reset-password")
def reset_password(body: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or user.username != body.username:
        raise HTTPException(404, detail="이메일과 닉네임이 일치하는 계정을 찾을 수 없습니다.")
    if len(body.new_password) < 8:
        raise HTTPException(400, detail="비밀번호는 8자 이상으로 설정해주세요.")

    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
