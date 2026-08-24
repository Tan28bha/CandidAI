import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import selectinload

from app.api.deps import get_user_from_token
from app.db.session import SessionLocal
from app.models.interview import InterviewSession
from app.schemas.interview import AnswerCreate, InterviewDetail, InterviewTurnResponse
from app.services.interview_helpers import apply_answer_result, get_owned_interview, question_limit
from app.services.interview_stream import stream_process_answer

logger = logging.getLogger("ws")
router = APIRouter()


def _serialize_session(interview: InterviewSession) -> dict:
    return InterviewDetail.model_validate(interview).model_dump(mode="json")


@router.websocket("/ws/interviews/{interview_id}")
async def interview_socket(websocket: WebSocket, interview_id: UUID):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401, reason="Missing token")
        return

    await websocket.accept()
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        get_owned_interview(str(interview_id), user, db)
    except Exception as exc:
        logger.warning("WebSocket auth failed: %s", exc)
        await websocket.send_json({"type": "error", "message": "Authentication failed"})
        await websocket.close(code=4401, reason="Authentication failed")
        db.close()
        return

    await websocket.send_json({"type": "connected", "interview_id": str(interview_id)})

    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") != "submit_answer":
                await websocket.send_json({"type": "error", "message": "Unsupported message type"})
                continue

            try:
                answer_payload = AnswerCreate(answer=payload.get("answer", ""))
            except ValidationError as exc:
                await websocket.send_json({"type": "error", "message": exc.errors()[0]["msg"]})
                continue

            interview = (
                db.query(InterviewSession)
                .options(selectinload(InterviewSession.turns))
                .filter(InterviewSession.id == interview_id, InterviewSession.user_id == user.id)
                .first()
            )
            if not interview:
                await websocket.send_json({"type": "error", "message": "Interview session not found"})
                continue
            if interview.status != "ACTIVE":
                await websocket.send_json({"type": "error", "message": "Start this interview before submitting an answer"})
                continue

            current_turn = next(
                (turn for turn in sorted(interview.turns, key=lambda item: item.turn_number) if not turn.answer),
                None,
            )
            if not current_turn:
                await websocket.send_json({"type": "error", "message": "There is no question awaiting an answer"})
                continue

            current_turn.answer = answer_payload.answer.strip()
            is_final = current_turn.turn_number >= question_limit(interview.duration_minutes)
            next_number = None if is_final else current_turn.turn_number + 1

            turn_result = None
            async for event in stream_process_answer(
                interview,
                current_turn.question,
                current_turn.answer,
                generate_next=not is_final,
                next_turn_number=next_number,
            ):
                if event["type"] == "turn_result":
                    turn_result = event["result"]
                    continue
                await websocket.send_json(event)

            if turn_result is None:
                await websocket.send_json({"type": "error", "message": "Unable to process this answer"})
                continue

            new_turn = apply_answer_result(
                interview,
                current_turn,
                turn_result,
                is_final=is_final,
                next_number=next_number,
            )
            if new_turn:
                db.add(new_turn)
            db.commit()

            refreshed = get_owned_interview(str(interview_id), user, db)
            pending = next((turn for turn in refreshed.turns if turn.answer is None), None)
            await websocket.send_json(
                {
                    "type": "complete",
                    "session": _serialize_session(refreshed),
                    "next_question": InterviewTurnResponse.model_validate(pending).model_dump(mode="json")
                    if pending
                    else None,
                    "summary": refreshed.summary,
                }
            )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for interview %s", interview_id)
    except Exception as exc:
        logger.exception("WebSocket error for interview %s: %s", interview_id, exc)
        try:
            await websocket.send_json({"type": "error", "message": "Unexpected server error"})
        except Exception:
            pass
    finally:
        db.close()
