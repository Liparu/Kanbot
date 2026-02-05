from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.tag import TagResponse
from app.schemas.user import UserResponse


class TaskCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    position: Optional[int] = None


class TaskUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=1, max_length=1000)
    completed: Optional[bool] = None
    position: Optional[int] = None


class TaskResponse(BaseModel):
    id: UUID
    text: str
    completed: bool
    position: int
    created_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class CommentResponse(BaseModel):
    id: UUID
    card_id: UUID
    user_id: Optional[UUID]
    content: str
    actor_type: str
    actor_name: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_edited: bool = False
    is_deleted: bool = False

    class Config:
        from_attributes = True


class CardCreate(BaseModel):
    column_id: UUID
    name: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=50000)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=500)
    position: Optional[int] = None
    metadata_json: Optional[dict] = None
    waiting_on: Optional[str] = Field(None, max_length=500)
    assignee_ids: Optional[List[UUID]] = None
    tag_ids: Optional[List[UUID]] = None
    tag_names: Optional[List[str]] = None  # Create/find tags by name


class CardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=50000)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=500)
    position: Optional[int] = None
    metadata_json: Optional[dict] = None
    waiting_on: Optional[str] = Field(None, max_length=500)
    approver_id: Optional[UUID] = None
    assignee_ids: Optional[List[UUID]] = None
    tag_ids: Optional[List[UUID]] = None
    tag_names: Optional[List[str]] = None  # Create/find tags by name


class CardMove(BaseModel):
    column_id: UUID
    position: Optional[int] = None


class CardTagResponse(BaseModel):
    tag: TagResponse

    class Config:
        from_attributes = True


class SimpleUserResponse(BaseModel):
    id: UUID
    username: str
    email: str

    class Config:
        from_attributes = True


class CardResponse(BaseModel):
    id: UUID
    column_id: UUID
    name: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    position: int = 0
    task_counter: int = 0
    task_completed_counter: int = 0
    metadata_json: dict = Field(default_factory=dict)
    last_column_id: Optional[UUID] = None
    waiting_on: Optional[str] = None
    approver_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    tags: List[CardTagResponse] = Field(default_factory=list)
    assignees: List[SimpleUserResponse] = Field(default_factory=list)
    creator: Optional[SimpleUserResponse] = None

    class Config:
        from_attributes = True


class CardWithTasksResponse(CardResponse):
    tasks: List[TaskResponse] = Field(default_factory=list)


class CardDetailResponse(CardResponse):
    tasks: List[TaskResponse] = Field(default_factory=list)
    comments: List[CommentResponse] = Field(default_factory=list)


class CardHistoryResponse(BaseModel):
    id: UUID
    card_id: UUID
    action: str
    changes: dict = Field(default_factory=dict)
    actor_type: str
    actor_id: str
    actor_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
