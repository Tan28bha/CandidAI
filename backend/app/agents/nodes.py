from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.agents.state import AgentState
from app.llm.provider import get_chat_model
from app.prompts.evaluator import EVALUATOR_SYSTEM, EVALUATOR_USER
from app.prompts.interviewer import (
    INTERVIEWER_SYSTEM,
    INTERVIEWER_USER_FOLLOWUP,
    INTERVIEWER_USER_INITIAL,
)


class EvaluationResult(BaseModel):
    score: int = Field(ge=1, le=5)
    feedback: str = Field(max_length=500)
    probe_areas: list[str] = Field(default_factory=list, max_length=3)


def _session_labels(session: dict) -> dict[str, str]:
    focus = ", ".join(session.get("focus_areas") or []) or "general skills"
    return {
        "interview_type": session["interview_type"].replace("_", " "),
        "target_role": session["target_role"],
        "difficulty": session["difficulty"],
        "focus_areas": focus,
    }


def _format_prior_turns(turns: list[dict]) -> str:
    if not turns:
        return "No prior turns."
    lines: list[str] = []
    for turn in turns:
        lines.append(f"Q{turn['turn_number']}: {turn['question']}")
        if turn.get("answer"):
            lines.append(f"A{turn['turn_number']}: {turn['answer']}")
        if turn.get("score") is not None:
            lines.append(f"Score: {turn['score']}/5 — {turn.get('feedback', '')}")
    return "\n".join(lines)


def build_interviewer_messages(state: AgentState) -> list:
    labels = _session_labels(state["session"])
    turn_number = state.get("turn_number", 1)
    prior = state.get("prior_turns") or []
    system = SystemMessage(content=INTERVIEWER_SYSTEM.format(**labels))
    if turn_number == 1 and not prior:
        user = HumanMessage(content=INTERVIEWER_USER_INITIAL)
    else:
        probe_areas = ", ".join(state.get("probe_areas") or []) or "deeper reasoning and concrete examples"
        user = HumanMessage(
            content=INTERVIEWER_USER_FOLLOWUP.format(
                prior_turns=_format_prior_turns(prior),
                probe_areas=probe_areas,
                turn_number=turn_number,
            )
        )
    return [system, user]


def stream_interviewer_tokens(state: AgentState):
    llm = get_chat_model()
    for chunk in llm.stream(build_interviewer_messages(state)):
        text = chunk.content
        if text:
            yield text


def interviewer_node(state: AgentState) -> dict:
    response = get_chat_model().invoke(build_interviewer_messages(state))
    question = response.content.strip()
    return {"next_question": question}


def evaluator_node(state: AgentState) -> dict:
    labels = _session_labels(state["session"])
    llm = get_chat_model().with_structured_output(EvaluationResult)
    system = SystemMessage(content=EVALUATOR_SYSTEM.format(**labels))
    user = HumanMessage(
        content=EVALUATOR_USER.format(
            question=state["current_question"],
            answer=state["current_answer"],
        )
    )
    result: EvaluationResult = llm.invoke([system, user])
    return {
        "score": result.score,
        "feedback": result.feedback,
        "probe_areas": result.probe_areas,
    }
