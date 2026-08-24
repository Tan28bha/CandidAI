"""Generate post-interview debrief summaries."""

from langchain_core.messages import HumanMessage, SystemMessage

from app.llm.provider import get_chat_model, llm_available
from app.models.interview import InterviewSession

SUMMARY_SYSTEM = """You write concise interview debriefs for candidates.
Cover: overall signal (1 paragraph), top strengths (2 bullets), priority improvements (2 bullets), and one next practice focus.
Keep the tone constructive and specific. Max 220 words."""

SUMMARY_USER = """Interview type: {interview_type}
Role: {target_role} | Level: {difficulty}
Average score: {average_score}/5

Turns:
{turns}

Write the debrief."""


def _format_turns(session: InterviewSession) -> str:
    lines: list[str] = []
    for turn in sorted(session.turns, key=lambda item: item.turn_number):
        if not turn.answer:
            continue
        lines.append(f"Q{turn.turn_number}: {turn.question}")
        lines.append(f"A: {turn.answer[:500]}")
        lines.append(f"Score: {turn.score}/5 — {turn.feedback}")
        lines.append("")
    return "\n".join(lines) or "No completed turns."


def _average_score(session: InterviewSession) -> float:
    scored = [turn.score for turn in session.turns if turn.score is not None]
    if not scored:
        return 0.0
    return round(sum(scored) / len(scored), 1)


def _deterministic_summary(session: InterviewSession) -> str:
    average = _average_score(session)
    scored_turns = [turn for turn in session.turns if turn.score is not None]
    strong = [turn for turn in scored_turns if (turn.score or 0) >= 4]
    weak = [turn for turn in scored_turns if (turn.score or 0) <= 2]
    strengths = (
        f"You showed clear reasoning on question {strong[0].turn_number}."
        if strong
        else "You stayed engaged across the full session."
    )
    improvement = (
        weak[0].feedback
        if weak
        else "Add more concrete examples, metrics, and explicit tradeoffs in each answer."
    )
    return (
        f"You completed a {session.interview_type.replace('_', ' ')} interview for {session.target_role} "
        f"with an average score of {average}/5 across {len(scored_turns)} responses. "
        f"{strengths} "
        f"Priority improvement: {improvement} "
        f"Next practice focus: deepen one answer with a measurable outcome and the tradeoff you rejected."
    )


def generate_session_summary(session: InterviewSession) -> str:
    if not llm_available():
        return _deterministic_summary(session)

    try:
        llm = get_chat_model()
        response = llm.invoke(
            [
                SystemMessage(content=SUMMARY_SYSTEM),
                HumanMessage(
                    content=SUMMARY_USER.format(
                        interview_type=session.interview_type.replace("_", " "),
                        target_role=session.target_role,
                        difficulty=session.difficulty,
                        average_score=_average_score(session),
                        turns=_format_turns(session),
                    )
                ),
            ]
        )
        summary = response.content.strip()
        return summary or _deterministic_summary(session)
    except Exception:
        return _deterministic_summary(session)
