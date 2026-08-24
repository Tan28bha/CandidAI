from types import SimpleNamespace

from app.services.interview_engine import (
    _deterministic_evaluate,
    _deterministic_question,
    process_answer,
    question_for,
)


def _session(**overrides):
    defaults = {
        "interview_type": "technical",
        "target_role": "Software Engineer",
        "difficulty": "mid",
        "focus_areas": ["React", "APIs"],
        "turns": [],
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_deterministic_question_includes_focus_on_first_turn():
    session = _session()
    question = _deterministic_question(session, 1)
    assert "Software Engineer" in question
    assert "React" in question


def test_deterministic_question_follows_bank():
    session = _session(focus_areas=[])
    question = _deterministic_question(session, 2)
    assert "tradeoff" in question.lower()


def test_deterministic_evaluate_scores_long_structured_answers_higher():
    short_score, _ = _deterministic_evaluate("I used React because it was fast.")
    long_answer = (
        "I chose React because the team already knew it and it reduced delivery risk. "
        "The tradeoff was bundle size versus velocity. We validated impact with a metric "
        "on time-to-interactive and ran tests around hydration edge cases. "
        "The result was a measurable improvement in developer throughput."
    )
    long_score, feedback = _deterministic_evaluate(long_answer)
    assert long_score >= short_score
    assert feedback


def test_question_for_falls_back_without_api_key(monkeypatch):
    monkeypatch.setattr("app.services.interview_engine.llm_available", lambda: False)
    session = _session()
    assert question_for(session, 1) == _deterministic_question(session, 1)


def test_process_answer_returns_next_question_without_api_key(monkeypatch):
    monkeypatch.setattr("app.services.interview_engine.llm_available", lambda: False)
    session = _session()
    result = process_answer(
        session,
        "Tell me about a recent project.",
        "I built an API because users needed faster data access. The tradeoff was cache freshness versus latency.",
        generate_next=True,
        next_turn_number=2,
    )
    assert 1 <= result.score <= 5
    assert result.feedback
    assert result.next_question == _deterministic_question(session, 2)


def test_process_answer_skips_next_question_on_final_turn(monkeypatch):
    monkeypatch.setattr("app.services.interview_engine.llm_available", lambda: False)
    session = _session()
    result = process_answer(
        session,
        "Final question?",
        "Here is my final answer with enough detail about tradeoffs and results.",
        generate_next=False,
    )
    assert result.next_question is None
