from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict, List
from backend.core.security import decode_token
from backend.models.database import ChatMessage, User, get_db
import json

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, team_id: str, ws: WebSocket):
        await ws.accept()
        if team_id not in self.connections:
            self.connections[team_id] = []
        self.connections[team_id].append(ws)

    def disconnect(self, team_id: str, ws: WebSocket):
        if team_id in self.connections:
            if ws in self.connections[team_id]:
                self.connections[team_id].remove(ws)

    async def broadcast(self, team_id: str, message: dict):
        if team_id in self.connections:
            for ws in self.connections[team_id]:
                try:
                    await ws.send_json(message)
                except:
                    pass


manager = ConnectionManager()


@router.websocket("/ws/{team_id}")
async def websocket_endpoint(team_id: str, websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    db: Session = next(get_db())

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        await websocket.close(code=4001)
        db.close()
        return

    await manager.connect(team_id, websocket)

    # 최근 메시지 50개 전송
    messages = db.query(ChatMessage).filter(
        ChatMessage.team_id == team_id
    ).order_by(ChatMessage.created_at.desc()).limit(50).all()
    messages.reverse()

    for msg in messages:
        await websocket.send_json({
            "id": str(msg.id),
            "username": msg.username,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
            "user_id": str(msg.user_id),
        })

    try:
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data)
            content = parsed.get("content", "").strip()
            if not content:
                continue

            msg = ChatMessage(
                team_id=team_id,
                user_id=str(user.id),
                username=user.username,
                content=content,
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)

            await manager.broadcast(team_id, {
                "id": str(msg.id),
                "username": msg.username,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
                "user_id": str(user.id),
            })

    except WebSocketDisconnect:
        manager.disconnect(team_id, websocket)
    finally:
        db.close()