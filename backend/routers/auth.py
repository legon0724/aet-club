from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.core.deps import get_authenticated_user, get_current_user
from backend.core.security import create_access_token, hash_password, is_admin_email, is_allowed_email, verify_password
from backend.models.database import User, get_db
from backend.models.schemas import (
    BackgroundUpdateRequest,
    BackgroundResponse,
    LoginRequest,
    PasswordChangeRequest,
    TemporaryPasswordChangeRequest,
    PasswordResetCodeRequest,
    PasswordResetConfirmRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter()


def require_school_email(email: str):
    if not is_allowed_email(email):
        raise HTTPException(400, detail="@cam.hs.kr 학교 이메일 또는 허용된 관리자 이메일만 사용할 수 있습니다.")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_username(username: str) -> str:
    return username.strip()


def user_login_payload(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "is_admin": bool(user.is_admin and is_admin_email(user.email)),
        "team_id": str(user.team_id) if user.team_id else None,
        "must_change_password": bool(user.must_change_password),
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = normalize_email(body.email)
    username = normalize_username(body.username)
    require_school_email(email)
    if not body.privacy_consented:
        raise HTTPException(400, detail="개인정보 처리방침에 동의해주세요.")
    if not username:
        raise HTTPException(400, detail="닉네임을 입력해주세요.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, detail="이미 사용 중인 이메일입니다.")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(400, detail="이미 사용 중인 닉네임입니다.")

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(body.password),
        is_admin=is_admin_email(email),
        privacy_consented=body.privacy_consented,
    )
    db.add(user)
    db.commit()
    return {"message": "가입이 완료되었습니다."}


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(body.email)
    require_school_email(email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    return TokenResponse(
        access_token=create_access_token({"sub": str(user.id)}),
        user=user_login_payload(user),
    )


@router.post("/password-reset/request")
def request_password_reset(body: PasswordResetCodeRequest, db: Session = Depends(get_db)):
    email = normalize_email(body.email)
    require_school_email(email)
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.password_reset_requested_at = datetime.utcnow()
        db.commit()
    return {"message": "초기화 요청을 관리자에게 전달했습니다."}


@router.post("/password-reset/confirm")
def confirm_password_reset(body: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="이메일 인증 방식은 종료되었습니다. 관리자에게 초기화를 요청해주세요.",
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_authenticated_user)):
    return current_user


@router.patch("/me/password")
def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(400, detail="?? ????? ???? ????.")
    if len(body.new_password) < 8:
        raise HTTPException(400, detail="? ????? 8? ????? ???.")
    if verify_password(body.new_password, current_user.password_hash):
        raise HTTPException(400, detail="? ????? ?? ????? ??? ???.")

    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    current_user.temporary_password_issued_at = None
    current_user.password_reset_requested_at = None
    db.commit()
    return {"message": "????? ???????."}


@router.patch("/me/temporary-password")
def complete_temporary_password(
    body: TemporaryPasswordChangeRequest,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    if not current_user.must_change_password:
        raise HTTPException(400, detail="임시 비밀번호 변경 대상이 아닙니다.")
    if len(body.new_password) < 8:
        raise HTTPException(400, detail="새 비밀번호는 8자 이상으로 설정해주세요.")
    if verify_password(body.new_password, current_user.password_hash):
        raise HTTPException(400, detail="임시 비밀번호와 다른 비밀번호를 입력해주세요.")

    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    current_user.temporary_password_issued_at = None
    current_user.password_reset_requested_at = None
    db.commit()
    return {"message": "새 비밀번호가 저장되었습니다."}


@router.get("/me/background", response_model=BackgroundResponse)
def get_background(current_user: User = Depends(get_current_user)):
    return {"background_image": current_user.background_image}


@router.patch("/me/background", response_model=BackgroundResponse)
def update_background(
    body: BackgroundUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    background = body.background_image
    if background is not None:
        if not background.startswith(("data:image/webp;base64,", "data:image/jpeg;base64,")):
            raise HTTPException(400, detail="???? ?? ??? ?????.")
        if len(background) > 1_800_000:
            raise HTTPException(413, detail="??? ??? ?? ???.")

    current_user.background_image = background
    db.commit()
    db.refresh(current_user)
    return {"background_image": current_user.background_image}
