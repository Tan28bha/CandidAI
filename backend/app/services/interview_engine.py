"""Deterministic interview orchestration used until an LLM provider is connected."""

from app.models.interview import InterviewSession

QUESTION_BANK = {
    "technical": [
        "Walk me through a recent feature you owned. What problem did it solve, and how did you decide on the implementation?",
        "What tradeoff did you make in that work, and what signal would tell you it was the wrong tradeoff?",
        "How would you make the most failure-prone part of that system observable in production?",
        "Describe how you would test this before release, including one edge case that is easy to miss.",
        "If usage increased tenfold tomorrow, what would you change first and why?",
    ],
    "dsa": [
        "You need to find the first non-repeating item in a stream. Talk through your approach, complexity, and assumptions.",
        "How would your approach change if the input cannot fit in memory?",
        "Give an example that would break a naive implementation, then explain how you would guard against it.",
        "Can you derive an alternative solution with a different time-space tradeoff?",
        "How would you validate the correctness of your implementation under pressure?",
    ],
    "system_design": [
        "Design a service for your target role that must handle unpredictable bursts of traffic. Start with the core components.",
        "Where are the likely bottlenecks, and how would you scale each one independently?",
        "What consistency model would you choose for the critical data, and why?",
        "How would you handle a downstream dependency failing during peak load?",
        "Which metrics and alerts would prove the design is meeting its goals?",
    ],
    "behavioral": [
        "Tell me about a time you disagreed with a technical decision. How did you influence the outcome?",
        "What was the result, and what would you do differently if the situation happened again?",
        "Describe a time you had to create clarity when requirements were ambiguous.",
        "How did you bring stakeholders along when priorities conflicted?",
        "What did that experience teach you about how you lead?",
    ],
}


def question_for(session: InterviewSession, turn_number: int) -> str:
    questions = QUESTION_BANK[session.interview_type]
    base = questions[min(turn_number - 1, len(questions) - 1)]
    if turn_number == 1 and session.focus_areas:
        return f"For {session.target_role}, with focus on {', '.join(session.focus_areas[:2])}: {base}"
    return base


def evaluate_answer(answer: str) -> tuple[int, str]:
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
