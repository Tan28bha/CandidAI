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
from app.db.session import SessionLocal
from app.models.profile import CandidateProfile
from app.services.resume_service import search_matching_chunks


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


def _get_resume_context(session: dict) -> str:
    user_id = session.get("user_id")
    if not user_id:
        return ""
    focus_areas = session.get("focus_areas") or []
    
    db = SessionLocal()
    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            return ""
        
        query = " ".join(focus_areas) if focus_areas else session.get("target_role", "")
        chunks = search_matching_chunks(db, profile.id, query, limit=2)
        if not chunks:
            return ""
            
        context = "\n\nCandidate's Resume Excerpts (use these to customize questions and ask about specific projects/technologies mentioned):\n"
        for i, chunk in enumerate(chunks, 1):
            context += f"Excerpt {i}: {chunk}\n"
        context += "Refer to these resume details naturally when starting or probing, but do not list or recite them directly.\n"
        return context
    except Exception:
        return ""
    finally:
        db.close()


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
    
    resume_context = _get_resume_context(state["session"])
    system = SystemMessage(content=INTERVIEWER_SYSTEM.format(**labels) + resume_context)

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
    
    resume_context = _get_resume_context(state["session"])
    system_text = EVALUATOR_SYSTEM.format(**labels)
    if resume_context:
        system_text += (
            "\n\nHere are some relevant excerpts from the candidate's resume:\n"
            f"{resume_context}\n"
            "Use these details to check if the candidate is describing real projects from their experience "
            "and evaluate the depth of their answer accordingly."
        )
        
    system = SystemMessage(content=system_text)
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

