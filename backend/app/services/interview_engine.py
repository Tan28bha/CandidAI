"""Interview orchestration with LangGraph multi-agent AI and deterministic fallback."""

from dataclasses import dataclass

from app.agents.graph import interview_graph
from app.agents.state import PriorTurn, SessionContext
from app.llm.provider import llm_available
from app.models.interview import InterviewSession
from app.services.question_banks import pick_question


@dataclass
class TurnResult:
    score: int
    feedback: str
    next_question: str | None = None


def _session_context(session: InterviewSession) -> SessionContext:
    return SessionContext(
        interview_type=session.interview_type,
        target_role=session.target_role,
        difficulty=session.difficulty,
        focus_areas=list(session.focus_areas or []),
        user_id=str(session.user_id),
    )



def _prior_turns(session: InterviewSession) -> list[PriorTurn]:
    turns: list[PriorTurn] = []
    for turn in sorted(session.turns, key=lambda item: item.turn_number):
        if turn.answer is None:
            continue
        turns.append(
            PriorTurn(
                turn_number=turn.turn_number,
                question=turn.question,
                answer=turn.answer,
                score=turn.score,
                feedback=turn.feedback,
            )
        )
    return turns


def _deterministic_question(session: InterviewSession, turn_number: int) -> str:
    return pick_question(
        session.interview_type,
        list(session.focus_areas or []),
        turn_number,
        session.target_role,
    )


def _deterministic_evaluate(answer: str) -> tuple[int, str]:
    words = len(answer.split())
    lower = answer.lower()
    signals = sum(term in lower for term in ("because", "tradeoff", "metric", "test", "impact", "result", "example"))
    score = min(5, max(1, 2 + (words >= 45) + (words >= 100) + (signals >= 2)))
    if score >= 4:
        feedback = "Strong signal: you gave supporting detail and connected your reasoning to outcomes. Keep making the tradeoffs explicit."
    elif score >= 3:
        feedback = "Solid foundation. Add a concrete example, measurable impact, or a specific tradeoff to make this answer more convincing."
    else:
        feedback = "This is a start, but it needs more structure. State your decision, why you made it, and the result or validation signal."
    return score, feedback


def question_for(session: InterviewSession, turn_number: int) -> str:
    if not llm_available():
        return _deterministic_question(session, turn_number)

    result = interview_graph.invoke(
        {
            "mode": "question",
            "session": _session_context(session),
            "prior_turns": _prior_turns(session),
            "turn_number": turn_number,
            "probe_areas": [],
        }
    )
    return result["next_question"] or _deterministic_question(session, turn_number)


def evaluate_answer(question: str, answer: str, session: InterviewSession) -> tuple[int, str]:
    if not llm_available():
        return _deterministic_evaluate(answer)

    result = interview_graph.invoke(
        {
            "mode": "evaluate",
            "session": _session_context(session),
            "current_question": question,
            "current_answer": answer,
            "generate_next": False,
        }
    )
    score = result.get("score")
    feedback = result.get("feedback")
    if score is None or not feedback:
        return _deterministic_evaluate(answer)
    return score, feedback


def process_answer(
    session: InterviewSession,
    question: str,
    answer: str,
    *,
    generate_next: bool,
    next_turn_number: int | None = None,
) -> TurnResult:
    """Evaluate an answer and optionally generate the next adaptive question in one agent pass."""
    if not llm_available():
        score, feedback = _deterministic_evaluate(answer)
        next_question = None
        if generate_next and next_turn_number is not None:
            next_question = _deterministic_question(session, next_turn_number)
        return TurnResult(score=score, feedback=feedback, next_question=next_question)

    result = interview_graph.invoke(
        {
            "mode": "evaluate",
            "session": _session_context(session),
            "prior_turns": _prior_turns(session),
            "current_question": question,
            "current_answer": answer,
            "generate_next": generate_next,
            "turn_number": next_turn_number or 1,
            "probe_areas": [],
        }
    )
    score = result.get("score")
    feedback = result.get("feedback")
    if score is None or not feedback:
        score, feedback = _deterministic_evaluate(answer)
    next_question = result.get("next_question") if generate_next else None
    if generate_next and not next_question and next_turn_number is not None:
        next_question = _deterministic_question(session, next_turn_number)
    return TurnResult(score=score, feedback=feedback, next_question=next_question)
