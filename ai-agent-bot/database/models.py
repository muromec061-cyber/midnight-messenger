from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    OWNER = "owner"


class User(BaseModel):
    id: str
    telegram_id: Optional[int] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: UserRole = UserRole.USER
    is_active: bool = True
    settings: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Project(BaseModel):
    id: str
    user_id: str
    name: str
    description: str = ""
    status: str = "active"
    tech_stack: list[str] = Field(default_factory=list)
    repo_url: Optional[str] = None
    deploy_url: Optional[str] = None
    settings: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Task(BaseModel):
    id: str
    project_id: Optional[str] = None
    user_id: str
    title: str
    description: str = ""
    status: str = "pending"
    priority: str = "medium"
    agent: str = "supervisor"
    payload: dict = Field(default_factory=dict)
    result: Optional[str] = None
    error: Optional[str] = None
    parent_task_id: Optional[str] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class Memory(BaseModel):
    id: str
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    type: str = "note"
    content: str
    embedding: Optional[list[float]] = None
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class Message(BaseModel):
    id: str
    user_id: str
    role: str
    content: str
    agent: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    created_at: Optional[datetime] = None


class Subscription(BaseModel):
    id: str
    user_id: str
    plan: str = "free"
    tokens_used: int = 0
    tokens_limit: int = 100000
    projects_limit: int = 3
    active: bool = True
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
