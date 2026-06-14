from typing import Literal

from pydantic import BaseModel


ApprovalStatus = Literal["pending", "approved", "rejected"]
ArchiveGroupBy = Literal["all", "project", "department", "group"]
ArchivePruneUnit = Literal["month", "year"]


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
    comment: str | None = None


class ApprovalRequest(ApprovalRequestCreate):
    id: str
    status: ApprovalStatus
    createdAt: str
    decidedAt: str | None


class ApprovalDecision(BaseModel):
    comment: str | None = None


class ApprovalArchiveItem(ApprovalRequest):
    decidedBy: str | None = None
    decisionComment: str | None = None


class ApprovalArchiveSummaryItem(BaseModel):
    key: str
    label: str
    total: int
    approved: int
    rejected: int
    averageShiftDays: int | None


class ApprovalArchiveResponse(BaseModel):
    items: list[ApprovalArchiveItem]
    total: int
    approved: int
    rejected: int
    averageShiftDays: int | None
    summary: list[ApprovalArchiveSummaryItem]


class ApprovalArchiveDeleteResult(BaseModel):
    deleted: int
