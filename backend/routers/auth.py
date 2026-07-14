import random
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr
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


def require_school_email(email: str):
    if not is_allowed_email(email):
        raise HTTPException(400, detail="@cam.hs.kr 학교 이메일만 사용할 수 있습니다.")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_username(username: str) -> str:
    return username.strip()


def smtp_setting(*names: str) -> str:
    for name in names:
        value = getattr(settings, name, "")
        if value:
            return value
    return ""


def send_reset_email(to_email: str, code: str):
    smtp_host = smtp_setting("SMTP_HOST", "EMAIL_HOST", "MAIL_SERVER")
    smtp_port = int(smtp_setting("SMTP_PORT", "EMAIL_PORT", "MAIL_PORT") or 587)
    smtp_username = smtp_setting("SMTP_USERNAME", "EMAIL_HOST_USER", "EMAIL_USERNAME", "MAIL_USERNAME")
    smtp_password = smtp_setting("SMTP_PASSWORD", "EMAIL_HOST_PASSWORD", "EMAIL_PASSWORD", "MAIL_PASSWORD")
    sender = smtp_setting("SMTP_FROM_EMAIL", "DEFAULT_FROM_EMAIL", "MAIL_FROM", "EMAIL_FROM") or smtp_username
    sender_name = smtp_setting("SMTP_FROM_NAME", "MAIL_FROM_NAME") or "NC"

    if not smtp_host or not smtp_username or not smtp_password or not sender:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="이메일 서버 설정이 아직 연결되지 않았습니다. 관리자에게 SMTP 설정을 확인해달라고 알려주세요.",
        )

    message = EmailMessage()
    message["Subject"] = "NC 비밀번호 재설정 인증번호"
    message["From"] = formataddr((sender_name, sender))
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

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(smtp_username, smtp_password)
            smtp.send_message(message)
    except smtplib.SMTPException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="이메일 서버에서 인증번호 발송을 거절했습니다. SMTP 계정 정보를 확인해주세요.",
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="이메일 서버에 연결하지 못했습니다. SMTP 주소와 포트를 확인해주세요.",
        ) from exc


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
    return TokenResponse(access_token=create_access_token({"sub": str(user.id)}))


@router.post("/password-reset/request")
def request_password_reset(body: PasswordResetCodeRequest, db: Session = Depends(get_db)):
    email = normalize_email(body.email)
    require_school_email(email)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, detail="가입된 이메일을 찾을 수 없습니다.")

    code = f"{random.randint(0, 999999):06d}"
    db.query(PasswordResetCode).filter(
        PasswordResetCode.email == email,
        PasswordResetCode.used == False,
    ).update({"used": True})
    db.add(
        PasswordResetCode(
            email=email,
            code_hash=hash_password(code),
            expires_at=datetime.utcnow() + timedelta(minutes=10),
        )
    )
    try:
        send_reset_email(email, code)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    return {"message": "비밀번호 재설정 인증번호를 이메일로 보냈습니다."}


@router.post("/password-reset/confirm")
def confirm_password_reset(body: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    email = normalize_email(body.email)
    require_school_email(email)
    reset_code = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.email == email, PasswordResetCode.used == False)
        .order_by(PasswordResetCode.created_at.desc())
        .first()
    )
    if not reset_code or reset_code.expires_at < datetime.utcnow():
        raise HTTPException(400, detail="인증번호가 만료되었거나 유효하지 않습니다.")
    if not verify_password(body.code, reset_code.code_hash):
        raise HTTPException(400, detail="인증번호가 올바르지 않습니다.")
    if len(body.new_password) < 8:
        raise HTTPException(400, detail="비밀번호는 8자 이상으로 설정해주세요.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, detail="가입된 이메일을 찾을 수 없습니다.")

    user.password_hash = hash_password(body.new_password)
    reset_code.used = True
    db.commit()
    return {"message": "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
