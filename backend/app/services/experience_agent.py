"""Experience Architect Agent: designs a better live interview session for the candidate."""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.llm.provider import get_chat_model, llm_available

logger = logging.getLogger("experience_agent")


class ExperienceDesign(BaseModel):
    session_arc: str = Field(description="How the mock loop should feel from first question to debrief.")
    opening_script: str = Field(description="A short interviewer opening the candidate will see.")
    pacing_notes: str = Field(description="How long to spend on intro, deep dive, and wrap-up.")
    follow_up_style: str = Field(description="How the interviewer should probe after weak or strong answers.")
    camera_presence_tips: list[str] = Field(default_factory=list, max_length=4)
    round_structure: list[str] = Field(default_factory=list, max_length=5)


def _fallback_experience(interview_type: str, difficulty: str, role: str, focus_areas: list[str]) -> dict:
    focus = ", ".join(focus_areas[:3]) if focus_areas else "your core stack"
    return {
        "session_arc": (
            f"Open with a concrete {interview_type.replace('_', ' ')} question tied to {role}, "
            f"then deepen one tradeoff, then close with a production or leadership probe."
        ),
        "opening_script": (
            f"Welcome. This is a {difficulty}-level {interview_type.replace('_', ' ')} loop for {role}. "
            f"Keep your camera on, think out loud, and ground answers in {focus}."
        ),
        "pacing_notes": "Spend the first turn on context, the middle turns on depth, and the last turn on impact or recovery.",
        "follow_up_style": "If an answer is vague, ask for a metric, a failed alternative, or a production incident. If it is strong, ask what would break at 10x load.",
        "camera_presence_tips": [
            "Keep your face and upper body in frame.",
            "Look at the camera when you state your decision.",
            "Pause instead of filler words when you need to think.",
        ],
        "round_structure": [
            "Turn 1: context from resume or stack",
            "Turn 2: core technical or design depth",
            "Turn 3: tradeoff / failure mode",
            "Final turn: impact, testing, or leadership",
        ],
    }


def design_interview_experience(
    *,
    interview_type: str,
    target_role: str,
    difficulty: str,
    focus_areas: list[str] | None,
    resume_profile: dict | None = None,
    projects: list[dict] | None = None,
) -> dict:
    fallback = _fallback_experience(interview_type, difficulty, target_role, focus_areas or [])
    if not llm_available():
        return fallback

    try:
        architect = get_chat_model().with_structured_output(ExperienceDesign)
        project_lines = ""
        for project in (projects or [])[:4]:
            project_lines += (
                f"- {project.get('name')}: {project.get('challenge')} "
                f"[{', '.join(project.get('tech_stack') or [])}]\n"
            )
        result: ExperienceDesign = architect.invoke(
            [
                SystemMessage(
                    content=(
                        "You are an Interview Experience Architect. Design a realistic, high-signal mock interview. "
                        "Optimize for candidate confidence, camera presence, and adaptive probing. "
                        "Keep the opening under 60 words. Be specific to the role and stack."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Type: {interview_type}\nRole: {target_role}\nDifficulty: {difficulty}\n"
                        f"Focus: {', '.join(focus_areas or []) or 'general'}\n"
                        f"Title: {(resume_profile or {}).get('current_title')}\n"
                        f"Skills: {', '.join((resume_profile or {}).get('skills') or [])}\n"
                        f"Projects:\n{project_lines or 'none'}"
                    )
                ),
            ]
        )
        return result.model_dump()
    except Exception as exc:
        logger.warning("Experience architect failed: %s", exc)
        return fallback
