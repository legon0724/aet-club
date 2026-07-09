import random
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.core.config import settings
from backend.core.deps import get_current_user
from backend.core.security import create_access_token, hash_password, is_admin_email, is_allowed_email, verify_password
from backend.models.database import PasswordResetCode, User, get_db
from backend.models.schemas import (
    LoginRequest,
    PasswordResetCodeRequest,
    PasswordResetConfirmRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter()


def send_reset_email(to_email: str, code: str):
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="이메일 발송 설정이 아직 연결되지 않았습니다.",
        )

    sender = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    message = EmailMessage()
    message["Subject"] = "NC 비밀번호 재설정 인증번호"
    message["From"] = f"{settings.SMTP_FROM_NAME} <{sender}>"
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                "NC 비밀번호 재설정 인증번호입니다.",
                "",
                f"인증번호: {code}",
                "",
                "이 번호는 10분 동안만 사용할 수 있습니다.",
                "본인이 요청하지 않았다면 이 메일을 무시해주세요.",
            ]
        )
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        smtp.starttls()
        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


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


@router.post("/password-reset/request")
def request_password_reset(body: PasswordResetCodeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(404, detail="가입된 이메일을 찾을 수 없습니다.")

    code = f"{random.randint(0, 999999):06d}"
    db.query(PasswordResetCode).filter(
        PasswordResetCode.email == body.email,
        PasswordResetCode.used == False,
    ).update({"used": True})
    db.add(
        PasswordResetCode(
            email=body.email,
            code_hash=hash_password(code),
            expires_at=datetime.utcnow() + timedelta(minutes=10),
        )
    )
    send_reset_email(body.email, code)
    db.commit()
    return {"message": "비밀번호 재설정 인증번호를 이메일로 보냈습니다."}


@router.post("/password-reset/confirm")
def confirm_password_reset(body: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    reset_code = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.email == body.email, PasswordResetCode.used == False)
        .order_by(PasswordResetCode.created_at.desc())
        .first()
    )
    if not reset_code or reset_code.expires_at < datetime.utcnow():
        raise HTTPException(400, detail="인증번호가 만료되었거나 유효하지 않습니다.")
    if not verify_password(body.code, reset_code.code_hash):
        raise HTTPException(400, detail="인증번호가 올바르지 않습니다.")
    if len(body.new_password) < 8:
        raise HTTPException(400, detail="비밀번호는 8자 이상으로 설정해주세요.")

    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(404, detail="가입된 이메일을 찾을 수 없습니다.")

    user.password_hash = hash_password(body.new_password)
    reset_code.used = True
    db.commit()
    return {"message": "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
