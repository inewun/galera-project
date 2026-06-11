from typing import Literal

from pydantic import BaseModel


ApprovalStatus = Literal["pending", "approved", "rejected"]


class ApprovalRequestCreate(BaseModel):
    taskId: str
    taskSubject: str
    projectId: str | None = None
    projectName: str | None = None
    departmentId: str | None = None
    departmentName: str | None = None
    groupId: str | None = None
    groupName: str | None = None
    currentDue: str | None = None
    proposedDue: str | None = None


class ApprovalRequest(ApprovalRequestCreate):
    id: str
    status: ApprovalStatus
    createdAt: str
    decidedAt: str | None
