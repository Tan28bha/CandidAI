from typing import Literal, TypedDict


class SessionContext(TypedDict):
    interview_type: str
    target_role: str
    difficulty: str
    focus_areas: list[str]
    user_id: str



class PriorTurn(TypedDict):
    turn_number: int
    question: str
    answer: str
    score: int | None
    feedback: str | None


class AgentState(TypedDict, total=False):
    session: SessionContext
    prior_turns: list[PriorTurn]
    turn_number: int
    current_question: str
    current_answer: str
    score: int | None
    feedback: str | None
    probe_areas: list[str]
    next_question: str | None
    generate_next: bool
    research_notes: str
    mode: Literal["question", "evaluate"]
