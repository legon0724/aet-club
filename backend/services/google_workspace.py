import base64
import json

from fastapi import HTTPException
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from backend.core.config import settings


DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
WORKSPACE_MIME_TYPES = {
    "docs": "application/vnd.google-apps.document",
    "sheets": "application/vnd.google-apps.spreadsheet",
    "slides": "application/vnd.google-apps.presentation",
}


def google_workspace_configured() -> bool:
    return bool(settings.GOOGLE_SERVICE_ACCOUNT_JSON.strip() and settings.GOOGLE_DELEGATED_USER.strip())


def _service_account_info() -> dict:
    raw = settings.GOOGLE_SERVICE_ACCOUNT_JSON.strip()
    if not raw or not settings.GOOGLE_DELEGATED_USER.strip():
        raise HTTPException(
            503,
            detail="Google Workspace 연결이 아직 완료되지 않았습니다. 관리자에게 Google 서비스 계정 연결을 요청해주세요.",
        )

    try:
        if raw.startswith("{"):
            return json.loads(raw)
        return json.loads(base64.b64decode(raw).decode("utf-8"))
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(503, detail="Google Workspace 인증 설정 형식이 올바르지 않습니다.") from exc


def drive_service():
    credentials = service_account.Credentials.from_service_account_info(
        _service_account_info(),
        scopes=[DRIVE_SCOPE],
    ).with_subject(settings.GOOGLE_DELEGATED_USER.strip().lower())
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _google_error(exc: HttpError):
    status = getattr(exc.resp, "status", 502)
    if status in {401, 403}:
        detail = "Google Workspace 권한이 부족합니다. 도메인 전체 위임과 Drive 권한을 확인해주세요."
    else:
        detail = "Google 문서를 만들지 못했습니다. 잠시 후 다시 시도해주세요."
    raise HTTPException(502, detail=detail) from exc


def create_assignment_template(title: str, workspace_type: str) -> dict:
    mime_type = WORKSPACE_MIME_TYPES.get(workspace_type)
    if not mime_type:
        raise HTTPException(400, detail="지원하지 않는 Google 문서 유형입니다.")

    try:
        return drive_service().files().create(
            body={"name": f"[NC 과제 원본] {title}", "mimeType": mime_type},
            fields="id,webViewLink",
        ).execute()
    except HttpError as exc:
        _google_error(exc)


def create_student_copy(template_id: str, assignment_title: str, student_email: str, student_name: str) -> dict:
    try:
        drive = drive_service()
        copied = drive.files().copy(
            fileId=template_id,
            body={"name": f"{assignment_title} - {student_name}"},
            fields="id,webViewLink",
        ).execute()
        drive.permissions().create(
            fileId=copied["id"],
            body={"type": "user", "role": "writer", "emailAddress": student_email.strip().lower()},
            sendNotificationEmail=False,
            fields="id",
        ).execute()
        return copied
    except HttpError as exc:
        _google_error(exc)

