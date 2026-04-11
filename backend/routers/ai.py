from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from backend.core.deps import get_current_user
from backend.core.config import settings
from backend.models.database import AIUsage, User, get_db
from backend.models.schemas import AIAnalysisRequest
from groq import Groq

router = APIRouter()
DAILY_LIMIT = 5


def get_today():
    return datetime.utcnow().strftime("%Y-%m-%d")


@router.post("/analyze")
def analyze(body: AIAnalysisRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = get_today()
    usage = db.query(AIUsage).filter(
        AIUsage.user_id == str(current_user.id),
        AIUsage.date == today
    ).first()

    if usage and usage.count >= DAILY_LIMIT:
        raise HTTPException(429, detail=f"오늘 AI 분석 횟수({DAILY_LIMIT}회)를 초과했습니다.")

    if not settings.GROQ_API_KEY:
        raise HTTPException(500, detail="GROQ API 키가 설정되지 않았습니다.")

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)

        prompt = f"""당신은 카이스트(KAIST)와 서울대학교 입학사정관 출신 전문가입니다. 아래 학생의 생활기록부를 실제 입학사정관의 시각으로 엄격하게 평가해주세요.

[목표 학과]: {body.target_major}
[목표 대학]: {body.target_university or "미정"}
[관심 전형]: {body.target_admission or "미정"}

[생활기록부 / 활동 내역]:
{body.record_text}

입학사정관 관점에서 다음 항목으로 평가해주세요:
1. 강점 (목표 학과와 연관된 부분 - 구체적 근거 포함)
2. 부족한 점 (보완이 필요한 부분 - 실제 합격자 대비)
3. 포트폴리오 작성 방향 제안 (구체적으로)
4. 추천 활동 (앞으로 할 수 있는 활동 - 우선순위 포함)
5. 추천 입시 전형 및 이유
6. 종합 평가 및 합격 가능성 (솔직하게)

반드시 순수 한국어로만 작성하세요. 한자, 일본어, 중국어, 영어 단어를 절대 사용하지 마세요. 최소 각 항목당 200자 이상 작성하세요."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 한국어만 사용하는 입시 전문가입니다. 반드시 순수 한국어로만 답변하세요. 한자, 일본어, 중국어, 영어 단어, 외래어를 절대 사용하지 마세요. 영어 단어가 필요하면 반드시 한국어로 번역해서 쓰세요. 예: Participation → 참여, Theory → 이론, Ability → 능력, Project → 프로젝트"
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=2048,
        )

        result_text = response.choices[0].message.content

        if usage:
            usage.count += 1
            usage.last_used_at = datetime.utcnow()
        else:
            usage = AIUsage(user_id=str(current_user.id), date=today, count=1)
            db.add(usage)
        db.commit()

        return {"result": result_text, "remaining": DAILY_LIMIT - usage.count}

    except Exception as e:
        raise HTTPException(500, detail=f"AI 분석 실패: {str(e)}")


@router.get("/usage")
def get_usage(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = get_today()
    usage = db.query(AIUsage).filter(
        AIUsage.user_id == str(current_user.id),
        AIUsage.date == today
    ).first()
    used = usage.count if usage else 0
    return {"used": used, "remaining": DAILY_LIMIT - used, "limit": DAILY_LIMIT}