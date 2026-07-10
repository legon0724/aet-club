from backend.models.database import (
    AIUsage,
    ActivityLog,
    ChatMessage,
    PasswordResetCode,
    Portfolio,
    SessionLocal,
    Submission,
    User,
)


def main():
    db = SessionLocal()
    try:
        counts = {
            "chat_messages": db.query(ChatMessage).delete(),
            "activity_logs": db.query(ActivityLog).delete(),
            "ai_usage": db.query(AIUsage).delete(),
            "submissions": db.query(Submission).delete(),
            "portfolios": db.query(Portfolio).delete(),
            "password_reset_codes": db.query(PasswordResetCode).delete(),
            "users": db.query(User).delete(),
        }
        db.commit()
        for name, count in counts.items():
            print(f"{name}: {count}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
