from app.services.experience_agent import design_interview_experience
from app.services.question_banks import pick_question
from app.services.question_research import research_notes_for_session
from app.services.resume_agents import extract_resume_without_llm


def test_stack_specific_question_uses_react_bank():
    question = pick_question("technical", ["React"], 1, "Frontend Engineer")
    assert "React" in question or "state" in question.lower()
    assert "Frontend Engineer" in question


def test_research_notes_fallback_without_network(monkeypatch):
    monkeypatch.setattr("app.services.question_research.llm_available", lambda: False)
    monkeypatch.setattr("app.services.question_research.gather_public_themes", lambda session: [])
    notes = research_notes_for_session(
        {
            "interview_type": "technical",
            "target_role": "Software Engineer",
            "difficulty": "mid",
            "focus_areas": ["Python"],
        }
    )
    assert "Python" in notes or "FastAPI" in notes or "question bank" in notes.lower()


def test_experience_architect_fallback_without_llm(monkeypatch):
    monkeypatch.setattr("app.services.experience_agent.llm_available", lambda: False)
    design = design_interview_experience(
        interview_type="system_design",
        target_role="Staff Engineer",
        difficulty="senior",
        focus_areas=["Distributed systems"],
    )
    assert design["opening_script"]
    assert design["camera_presence_tips"]
    assert "Staff Engineer" in design["opening_script"]


def test_extract_resume_without_llm_finds_skills():
    text = "Senior engineer using React, Python, PostgreSQL, and Docker to ship APIs."
    result = extract_resume_without_llm(text)
    assert "React" in result["skills"]
    assert "Python" in result["skills"]
    assert result["bio"]
