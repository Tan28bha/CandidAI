import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage
from app.llm import get_chat_model

logger = logging.getLogger("resume_agents")


# --- Stage 1 schemas ---
class TechnicalProfile(BaseModel):
    current_title: str = Field(description="The primary professional title extracted from the resume.")
    years_of_experience: int = Field(description="Total years of professional experience.")
    skills: List[str] = Field(description="List of key technical skills (languages, frameworks, databases).")
    bio: str = Field(description="A concise professional bio (under 100 words).")


# --- Stage 2 schemas ---
class ProjectDetail(BaseModel):
    name: str = Field(description="Name of the project.")
    challenge: str = Field(description="The core problem or system challenge addressed.")
    tech_stack: List[str] = Field(description="Technologies utilized in this specific project.")
    outcomes: str = Field(description="Measurable metrics, business outcomes, or technical benefits achieved.")


class ProjectAnalysis(BaseModel):
    projects: List[ProjectDetail] = Field(description="Analyzed key projects from the candidate's history.")


# --- Stage 3 schemas ---
class InterviewDesign(BaseModel):
    suggested_role: str = Field(description="Highly optimized target role matching the candidate's level.")
    suggested_difficulty: str = Field(description="Suggested difficulty level (junior, mid, or senior).")
    recommended_focus_areas: List[str] = Field(description="Top 3 technical focus areas to evaluate (e.g. React Hooks, Redis Caching, DB Indexes).")
    tailored_questions: List[str] = Field(description="3 custom behavioral/technical questions specifically testing the candidate on their resume project claims and tech choices.")


def run_resume_analysis_agents(text: str) -> dict:
    """
    Executes a multi-agent resume analysis pipeline:
    1. Technical Profiler Agent: Extracts title, exp, skills, and bio.
    2. Project & Metrics Agent: Extracts project challenges and outcomes.
    3. Interview Architect Agent: Synthesizes both reports to design a custom mock interview blueprint.
    """
    logger.info("Initializing resume analysis agents...")
    
    # 1. Technical Profiler Agent
    logger.info("Agent 1: Extracting technical profile...")
    profiler = get_chat_model().with_structured_output(TechnicalProfile)
    profile_result = profiler.invoke([
        SystemMessage(content="You are a Technical Profiler Agent. Extract the primary title, experience years, skills, and a concise summary bio from the resume."),
        HumanMessage(content=f"Resume Excerpt:\n{text[:8000]}")
    ])
    
    # 2. Project & Metrics Agent
    logger.info("Agent 2: Extracting project challenges and outcomes...")
    project_analyzer = get_chat_model().with_structured_output(ProjectAnalysis)
    project_result = project_analyzer.invoke([
        SystemMessage(content="You are a Project & Metrics Agent. Analyze the resume and extract key projects, their core system challenges, and measurable engineering outcomes."),
        HumanMessage(content=f"Resume Excerpt:\n{text[:8000]}")
    ])
    
    # 3. Interview Architect Agent
    logger.info("Agent 3: Designing personalized mock interview blueprint...")
    architect = get_chat_model().with_structured_output(InterviewDesign)
    
    architect_input = (
        f"Technical Profile:\n"
        f" - Title: {profile_result.current_title}\n"
        f" - Exp: {profile_result.years_of_experience} years\n"
        f" - Skills: {', '.join(profile_result.skills)}\n\n"
        f"Projects Analyzed:\n"
    )
    for p in project_result.projects:
        architect_input += (
            f" - Project: {p.name}\n"
            f"   Challenge: {p.challenge}\n"
            f"   Tech: {', '.join(p.tech_stack)}\n"
            f"   Outcome: {p.outcomes}\n"
        )
        
    design_result = architect.invoke([
        SystemMessage(content=(
            "You are an Interview Architect Agent. Take the profile details and project analysis, "
            "and design a custom interview blueprint. Suggest the matching role, level, "
            "focus areas, and generate 3 custom behavioral/technical questions that target their specific project claims."
        )),
        HumanMessage(content=architect_input)
    ])
    
    logger.info("Multi-agent resume analysis completed successfully.")
    
    return {
        "profile": {
            "current_title": profile_result.current_title,
            "years_of_experience": profile_result.years_of_experience,
            "skills": profile_result.skills,
            "bio": profile_result.bio,
        },
        "projects": [p.model_dump() for p in project_result.projects],
        "interview_plan": {
            "suggested_role": design_result.suggested_role,
            "suggested_difficulty": design_result.suggested_difficulty,
            "recommended_focus_areas": design_result.recommended_focus_areas,
            "tailored_questions": design_result.tailored_questions,
        }
    }
