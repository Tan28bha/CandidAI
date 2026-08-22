import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr


class UserRegister(UserBase):
    password: str = Field(min_length=6, description="Password must be at least 6 characters")
    full_name: Optional[str] = None
    role: str = Field(default="CANDIDATE", description="Role: CANDIDATE, RECRUITER, ADMIN")


class UserLogin(UserBase):
    password: str


class UserResponse(UserBase):
    id: uuid.UUID
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
