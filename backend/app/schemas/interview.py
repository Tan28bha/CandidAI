import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class InterviewCreate(BaseModel):
    interview_type: str = Field(pattern="^(technical|dsa|system_design|behavioral)$")
    target_role: str = Field(min_length=2, max_length=150)
    difficulty: str = Field(pattern="^(junior|mid|senior)$")
    duration_minutes: int = Field(ge=15, le=120)
    focus_areas: list[str] = Field(default_factory=list, max_length=8)


class InterviewResponse(InterviewCreate):
    id: uuid.UUID
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
