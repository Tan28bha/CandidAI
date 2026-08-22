import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ProfileBase(BaseModel):
    phone: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    current_title: Optional[str] = None
    years_of_experience: Optional[int] = 0
    skills: Optional[List[str]] = Field(default_factory=list)
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None


class ProfileUpdate(ProfileBase):
    pass


class ProfileResponse(ProfileBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
