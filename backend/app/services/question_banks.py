"""Curated interview question banks, including tech-stack specific probes."""

TYPE_BANKS: dict[str, list[str]] = {
    "technical": [
        "Walk me through a recent feature you owned. What problem did it solve, and how did you decide on the implementation?",
        "What tradeoff did you make in that work, and what signal would tell you it was the wrong tradeoff?",
        "How would you make the most failure-prone part of that system observable in production?",
        "Describe how you would test this before release, including one edge case that is easy to miss.",
        "If usage increased tenfold tomorrow, what would you change first and why?",
        "How do you decide when to refactor versus shipping a pragmatic fix under a deadline?",
        "Tell me how you would debug a production issue you cannot reproduce locally.",
    ],
    "dsa": [
        "You need to find the first non-repeating item in a stream. Talk through your approach, complexity, and assumptions.",
        "How would your approach change if the input cannot fit in memory?",
        "Give an example that would break a naive implementation, then explain how you would guard against it.",
        "Can you derive an alternative solution with a different time-space tradeoff?",
        "How would you validate the correctness of your implementation under pressure?",
        "Design an LRU cache. What data structures do you need, and why those?",
        "How would you detect a cycle in a directed graph, and what is the complexity?",
    ],
    "system_design": [
        "Design a service for your target role that must handle unpredictable bursts of traffic. Start with the core components.",
        "Where are the likely bottlenecks, and how would you scale each one independently?",
        "What consistency model would you choose for the critical data, and why?",
        "How would you handle a downstream dependency failing during peak load?",
        "Which metrics and alerts would prove the design is meeting its goals?",
        "How would you design rate limiting for a public API used by millions of clients?",
        "Walk through how you would add a cache layer without serving stale critical data.",
    ],
    "behavioral": [
        "Tell me about a time you disagreed with a technical decision. How did you influence the outcome?",
        "What was the result, and what would you do differently if the situation happened again?",
        "Describe a time you had to create clarity when requirements were ambiguous.",
        "How did you bring stakeholders along when priorities conflicted?",
        "What did that experience teach you about how you lead?",
        "Tell me about a time you mentored someone through a difficult technical problem.",
        "Describe a failure you owned. How did you communicate it and recover?",
    ],
}

STACK_BANKS: dict[str, list[str]] = {
    "react": [
        "How do you decide between lifting state, context, and a dedicated store in a React app?",
        "Explain React rendering: what causes a re-render, and how would you prevent unnecessary work?",
        "How would you design data fetching for a dashboard that must stay fresh without blocking the UI?",
        "Walk through how you would debug a hydration mismatch in a Next.js app.",
    ],
    "python": [
        "How do you structure a Python service so it stays testable as business rules grow?",
        "When would you choose async Python versus threads or processes, and what can go wrong?",
        "How would you profile a slow FastAPI endpoint and decide what to optimize first?",
        "Explain how you would handle retries, timeouts, and idempotency in a Python worker.",
    ],
    "databases": [
        "How do you decide between adding an index, denormalizing, or caching a slow query?",
        "Walk through how you would migrate a large table with zero downtime.",
        "What isolation level would you choose for a payments-like write path, and why?",
        "How would you detect and prevent N+1 query problems in an ORM-heavy codebase?",
    ],
    "apis": [
        "How do you version a public API without breaking existing clients?",
        "Design error handling for an API: status codes, error bodies, and retry semantics.",
        "How would you authenticate internal services versus end-user traffic?",
        "What would you put in an API contract review before shipping a breaking change?",
    ],
    "leadership": [
        "How do you give feedback when a teammate's design would create long-term operational risk?",
        "Describe how you prioritize engineering work when every stakeholder wants something this week.",
        "How do you decide which incidents need a postmortem and who should own the follow-ups?",
    ],
    "distributed systems": [
        "How would you design idempotent consumers for an at-least-once message queue?",
        "What happens in your system if a replica lags or a partition splits the cluster?",
        "How do you choose between saga orchestration and a simpler outbox pattern?",
        "How would you make a fan-out notification path survive a downstream outage?",
    ],
}


def normalize_focus(area: str) -> str:
    return " ".join(area.lower().replace("-", " ").replace("_", " ").split())


def questions_for_session(interview_type: str, focus_areas: list[str] | None) -> list[str]:
    type_questions = list(TYPE_BANKS.get(interview_type, TYPE_BANKS["technical"]))
    stack_questions: list[str] = []
    for area in focus_areas or []:
        key = normalize_focus(area)
        stack_questions.extend(STACK_BANKS.get(key, []))
    if not stack_questions:
        return type_questions
    # Interleave stack-specific probes with format-level questions so fallbacks stay relevant.
    mixed: list[str] = []
    for index in range(max(len(stack_questions), len(type_questions))):
        if index < len(stack_questions):
            mixed.append(stack_questions[index])
        if index < len(type_questions):
            mixed.append(type_questions[index])
    seen: set[str] = set()
    unique: list[str] = []
    for question in mixed:
        if question not in seen:
            seen.add(question)
            unique.append(question)
    return unique


def pick_question(interview_type: str, focus_areas: list[str] | None, turn_number: int, target_role: str = "") -> str:
    questions = questions_for_session(interview_type, focus_areas)
    base = questions[min(max(turn_number, 1) - 1, len(questions) - 1)]
    if turn_number == 1 and focus_areas:
        focus = ", ".join(focus_areas[:3])
        prefix = f"For {target_role}" if target_role else "For this role"
        return f"{prefix}, with focus on {focus}: {base}"
    return base
