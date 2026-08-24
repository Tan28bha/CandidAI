"""Streaming events for live interview WebSocket sessions."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterator
from typing import Any

from app.agents.graph import interview_graph
from app.agents.nodes import stream_interviewer_tokens
from app.agents.state import PriorTurn, SessionContext
from app.llm.provider import llm_available
from app.models.interview import InterviewSession
from app.services.interview_engine import (
    TurnResult,
    _deterministic_evaluate,
    _deterministic_question,
    _prior_turns,
    _session_context,
)


def _chunk_text(text: str, size: int = 12) -> Iterator[str]:
    for index in range(0, len(text), size):
        yield text[index : index + size]


async def stream_process_answer(
    session: InterviewSession,
    question: str,
    answer: str,
    *,
    generate_next: bool,
    next_turn_number: int | None = None,
) -> AsyncIterator[dict[str, Any]]:
    yield {"type": "status", "stage": "evaluating"}

    score: int
    feedback: str
    probe_areas: list[str] = []

    if llm_available():
        result = await asyncio.to_thread(
            interview_graph.invoke,
            {
                "mode": "evaluate",
                "session": _session_context(session),
                "prior_turns": _prior_turns(session),
                "current_question": question,
                "current_answer": answer,
                "generate_next": False,
            },
        )
        score = result.get("score") or 0
        feedback = result.get("feedback") or ""
        probe_areas = list(result.get("probe_areas") or [])
        if not score or not feedback:
            score, feedback = _deterministic_evaluate(answer)
    else:
        score, feedback = _deterministic_evaluate(answer)
        await asyncio.sleep(0.15)

    for chunk in _chunk_text(feedback):
        yield {"type": "feedback_delta", "text": chunk}
        await asyncio.sleep(0.02)

    yield {"type": "evaluation", "score": score, "feedback": feedback}

    next_question: str | None = None
    if generate_next and next_turn_number is not None:
        yield {"type": "status", "stage": "generating_question"}
        if llm_available():
            prior = _prior_turns(session)
            prior.append(
                PriorTurn(
                    turn_number=next_turn_number - 1,
                    question=question,
                    answer=answer,
                    score=score,
                    feedback=feedback,
                )
            )
            stream_state = {
                "session": _session_context(session),
                "prior_turns": prior,
                "turn_number": next_turn_number,
                "probe_areas": probe_areas,
            }
            parts: list[str] = []
            for token in await asyncio.to_thread(lambda: list(stream_interviewer_tokens(stream_state))):
                parts.append(token)
                yield {"type": "question_delta", "text": token}
                await asyncio.sleep(0.01)
            next_question = "".join(parts).strip()
        else:
            next_question = _deterministic_question(session, next_turn_number)
            for chunk in _chunk_text(next_question, size=18):
                yield {"type": "question_delta", "text": chunk}
                await asyncio.sleep(0.02)

        if not next_question:
            next_question = _deterministic_question(session, next_turn_number)

    yield {
        "type": "turn_result",
        "result": TurnResult(score=score, feedback=feedback, next_question=next_question),
    }
