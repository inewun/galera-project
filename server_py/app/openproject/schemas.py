from typing import Literal

from pydantic import BaseModel


class Task(BaseModel):
    id: str
    subject: str
    start: str | None
    due: str | None
    progress: int | float
    status: str
    typeName: str
    assigneeId: str | None
    assigneeType: Literal["user", "group"] | None
    parentId: str | None
    projectId: str | None
    dependencies: list[str]


class User(BaseModel):
    id: str
    name: str
    email: str | None
    avatarUrl: str | None
    groupIds: list[str]


class Group(BaseModel):
    id: str
    name: str
    memberIds: list[str]
    createdAt: str | None


class Project(BaseModel):
    id: str
    name: str
