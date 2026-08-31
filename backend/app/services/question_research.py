"""Research Agent: gather public interview themes for the candidate's tech stack."""

from __future__ import annotations

import logging
import re
from functools import lru_cache

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.llm.provider import get_chat_model, llm_available
from app.services.question_banks import questions_for_session

logger = logging.getLogger("question_research")

RESEARCHER_SYSTEM = """You are a Question Research Agent for mock technical interviews.
Given public interview themes (titles/snippets) and the candidate's stack, produce original questions.
Do not copy any source verbatim. Rewrite into concise interviewer questions (under 80 words).
Match difficulty and interview type. Prefer questions that test reasoning, tradeoffs, and real systems."""


class ResearchedQuestions(BaseModel):
    themes: list[str] = Field(default_factory=list, max_length=6)
    questions: list[str] = Field(default_factory=list, max_length=6)


def _search_duckduckgo(query: str, limit: int = 5) -> list[str]:
    try:
        with httpx.Client(timeout=6.0, follow_redirects=True, headers={"User-Agent": "CandidAI/1.0"}) as client:
            response = client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query},
            )
            response.raise_for_status()
    except Exception as exc:
        logger.info("Question research search skipped: %s", exc)
        return []

    titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', response.text, flags=re.IGNORECASE | re.DOTALL)
    snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</(?:a|td)>', response.text, flags=re.IGNORECASE | re.DOTALL)
    cleaned: list[str] = []
    for raw in titles + snippets:
        text = re.sub(r"<[^>]+>", " ", raw)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) < 24:
            continue
        cleaned.append(text)
        if len(cleaned) >= limit:
            break
    return cleaned


def _queries_for(session: dict) -> list[str]:
    interview_type = (session.get("interview_type") or "technical").replace("_", " ")
    role = session.get("target_role") or "software engineer"
    difficulty = session.get("difficulty") or "mid"
    stacks = session.get("focus_areas") or ["general software engineering"]
    queries = []
    for stack in stacks[:3]:
        queries.append(f"{stack} {interview_type} interview questions {difficulty} {role}")
    return queries


def gather_public_themes(session: dict) -> list[str]:
    themes: list[str] = []
    seen: set[str] = set()
    for query in _queries_for(session):
        for item in _search_duckduckgo(query):
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            themes.append(item)
        if len(themes) >= 8:
            break
    return themes[:8]


def _fallback_notes(session: dict) -> str:
    questions = questions_for_session(session.get("interview_type") or "technical", session.get("focus_areas") or [])
    lines = ["Curated tech-stack question bank (offline research fallback):"]
    for question in questions[:6]:
        lines.append(f"- {question}")
    return "\n".join(lines)


def research_question_notes(session: dict) -> str:
    """Return interviewer-ready research notes for this session's stack."""
    themes = gather_public_themes(session)
    bank = _fallback_notes(session)
    if not llm_available():
        if not themes:
            return bank
        theme_lines = "\n".join(f"- {theme}" for theme in themes)
        return f"Public interview themes for this stack:\n{theme_lines}\n\n{bank}"

    try:
        researcher = get_chat_model().with_structured_output(ResearchedQuestions)
        result: ResearchedQuestions = researcher.invoke(
            [
                SystemMessage(content=RESEARCHER_SYSTEM),
                HumanMessage(
                    content=(
                        f"Interview type: {session.get('interview_type')}\n"
                        f"Role: {session.get('target_role')}\n"
                        f"Difficulty: {session.get('difficulty')}\n"
                        f"Tech stack / focus: {', '.join(session.get('focus_areas') or []) or 'general'}\n\n"
                        f"Public themes:\n"
                        + ("\n".join(f"- {theme}" for theme in themes) or "- none retrieved")
                        + "\n\nAlso consider this curated bank:\n"
                        + bank
                    )
                ),
            ]
        )
        lines = ["Question Research Agent notes:"]
        for theme in result.themes:
            lines.append(f"Theme: {theme}")
        for question in result.questions:
            lines.append(f"Candidate question: {question}")
        return "\n".join(lines) if result.questions or result.themes else bank
    except Exception as exc:
        logger.warning("Question research agent failed: %s", exc)
        return bank


@lru_cache(maxsize=64)
def cached_research_notes(
    interview_type: str,
    target_role: str,
    difficulty: str,
    focus_key: str,
) -> str:
    session = {
        "interview_type": interview_type,
        "target_role": target_role,
        "difficulty": difficulty,
        "focus_areas": [item for item in focus_key.split("|") if item],
    }
    return research_question_notes(session)


def research_notes_for_session(session: dict) -> str:
    focus = tuple(session.get("focus_areas") or [])
    return cached_research_notes(
        session.get("interview_type") or "technical",
        session.get("target_role") or "Software Engineer",
        session.get("difficulty") or "mid",
        "|".join(focus),
    )
