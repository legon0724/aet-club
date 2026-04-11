from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.core.deps import get_admin_user, get_current_user
from backend.models.database import Team, User, get_db
from backend.models.schemas import TeamSchema

router = APIRouter()


@router.get("/")
def get_teams(db: Session = Depends(get_db)):
    return db.query(Team).all()


@router.post("/")
def create_team(body: TeamSchema, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    team = Team(name=body.name, description=body.description, color=body.color)
    db.add(team)
    db.commit()
    return {"message": "팀이 생성되었습니다."}


@router.delete("/{team_id}")
def delete_team(team_id: str, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(404, detail="팀을 찾을 수 없습니다.")
    db.delete(team)
    db.commit()
    return {"message": "삭제되었습니다."}