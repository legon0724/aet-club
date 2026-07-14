from backend.models.database import (
    AIUsage,
    ActivityLog,
    ActivityGalleryItem,
    Assignment,
    Banner,
    CalendarEvent,
    ChatMessage,
    Notice,
    NoticeRead,
    PasswordResetCode,
    Portfolio,
    Project,
    SessionLocal,
    Submission,
    Team,
    User,
)


def main():
    db = SessionLocal()
    try:
        counts = {
            "chat_messages": db.query(ChatMessage).delete(),
            "notice_reads": db.query(NoticeRead).delete(),
            "activity_logs": db.query(ActivityLog).delete(),
            "ai_usage": db.query(AIUsage).delete(),
            "submissions": db.query(Submission).delete(),
            "portfolios": db.query(Portfolio).delete(),
            "password_reset_codes": db.query(PasswordResetCode).delete(),
            "assignments": db.query(Assignment).delete(),
            "notices": db.query(Notice).delete(),
            "banners": db.query(Banner).delete(),
            "activity_gallery": db.query(ActivityGalleryItem).delete(),
            "projects": db.query(Project).delete(),
            "calendar_events": db.query(CalendarEvent).delete(),
            "users": db.query(User).delete(),
            "teams": db.query(Team).delete(),
        }
        db.commit()
        for name, count in counts.items():
            print(f"{name}: {count}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
