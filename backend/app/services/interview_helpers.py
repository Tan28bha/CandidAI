"""Shared interview session helpers for REST and WebSocket handlers."""

from sqlalchemy.orm import Session, selectinload

from app.models.interview import InterviewSession, InterviewTurn
from app.models.user import User
from app.services.interview_engine import TurnResult, process_answer
from app.services.summary import generate_session_summary


def question_limit(duration_minutes: int) -> int:
    return 3 if duration_minutes <= 30 else 4 if duration_minutes <= 60 else 5


import uuid

def get_owned_interview(interview_id: str, current_user: User, db: Session) -> InterviewSession:
    try:
        session_uuid = uuid.UUID(interview_id)
    except ValueError:
        raise ValueError("Interview session not found")
        
    interview = (
        db.query(InterviewSession)
        .options(selectinload(InterviewSession.turns))
        .filter(InterviewSession.id == session_uuid, InterviewSession.user_id == current_user.id)
        .first()
    )

    if not interview:
        raise ValueError("Interview session not found")
    return interview


def apply_answer_result(
    interview: InterviewSession,
    current_turn: InterviewTurn,
    turn_result: TurnResult,
    *,
    is_final: bool,
    next_number: int | None,
) -> InterviewTurn | None:
    current_turn.score = turn_result.score
    current_turn.feedback = turn_result.feedback
    if is_final:
        interview.status = "COMPLETED"
        interview.summary = generate_session_summary(interview)
        return None
    if turn_result.next_question and next_number is not None:
        return InterviewTurn(
            session_id=interview.id,
            turn_number=next_number,
            question=turn_result.next_question,
        )
    return None


def submit_turn(
    interview: InterviewSession,
    answer: str,
) -> tuple[InterviewTurn, TurnResult, bool, InterviewTurn | None]:
    if interview.status != "ACTIVE":
        raise ValueError("Start this interview before submitting an answer")
    current_turn = next(
        (turn for turn in sorted(interview.turns, key=lambda item: item.turn_number) if not turn.answer),
        None,
    )
    if not current_turn:
        raise ValueError("There is no question awaiting an answer")

    current_turn.answer = answer.strip()
    is_final = current_turn.turn_number >= question_limit(interview.duration_minutes)
    next_number = None if is_final else current_turn.turn_number + 1
    turn_result = process_answer(
        interview,
        current_turn.question,
        current_turn.answer,
        generate_next=not is_final,
        next_turn_number=next_number,
    )
    new_turn = apply_answer_result(
        interview,
        current_turn,
        turn_result,
        is_final=is_final,
        next_number=next_number,
    )
    return current_turn, turn_result, is_final, new_turn
