from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
import re


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    language: str = Field(default="en", max_length=10)
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, underscores and hyphens')
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    language: Optional[str] = Field(None, max_length=10)
    settings: Optional[dict] = None
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, underscores and hyphens')
        return v


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    language: str = "en"
    settings: dict = Field(default_factory=dict)
    is_active: bool = True
    is_admin: bool = False
    is_banned: bool = False
    banned_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    permissions: Optional[dict] = None


class APIKeyResponse(BaseModel):
    id: UUID
    name: str
    permissions: dict = Field(default_factory=dict)
    is_agent: bool = False
    created_at: datetime
    last_used: Optional[datetime] = None

    class Config:
        from_attributes = True


class APIKeyCreatedResponse(APIKeyResponse):
    key: str
