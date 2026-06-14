from fastapi import APIRouter, HTTPException

from app.approvals.schemas import (
    ApprovalArchiveDeleteResult,
    ApprovalArchiveResponse,
    ApprovalDecision,
    ApprovalRequest,
    ApprovalRequestCreate,
    ApprovalStatus,
    ArchiveGroupBy,
    ArchivePruneUnit,
)
from app.approvals.service import (
    create_approval_request,
    decide_approval_request,
    delete_approval_archive_item,
    list_approval_archive,
    list_approval_requests,
    prune_approval_archive,
)


router = APIRouter(prefix="/api/approval-requests")


@router.get("")
async def get_approval_requests(status: ApprovalStatus | None = None) -> list[ApprovalRequest]:
    return await list_approval_requests(status)


@router.post("")
async def post_approval_request(body: ApprovalRequestCreate) -> ApprovalRequest:
    return await create_approval_request(body)


@router.post("/{request_id}/approve")
async def approve_approval_request(request_id: str, body: ApprovalDecision | None = None) -> ApprovalRequest:
    request = await decide_approval_request(request_id, "approved", body or ApprovalDecision())
    if request is None:
        raise HTTPException(status_code=404, detail={"error": "Approval request not found"})
    return request


@router.post("/{request_id}/reject")
async def reject_approval_request(request_id: str, body: ApprovalDecision | None = None) -> ApprovalRequest:
    request = await decide_approval_request(request_id, "rejected", body or ApprovalDecision())
    if request is None:
        raise HTTPException(status_code=404, detail={"error": "Approval request not found"})
    return request


@router.get("/archive")
async def get_approval_archive(
    year: int | None = None,
    month: int | None = None,
    groupBy: ArchiveGroupBy = "all",
    status: ApprovalStatus | None = None,
    projectId: str | None = None,
    departmentId: str | None = None,
    groupId: str | None = None,
) -> ApprovalArchiveResponse:
    return await list_approval_archive(
        year=year,
        month=month,
        group_by=groupBy,
        status=status,
        project_id=projectId,
        department_id=departmentId,
        group_id=groupId,
    )


@router.delete("/archive")
async def delete_old_approval_archive(
    olderThanUnit: ArchivePruneUnit,
    olderThanCount: int,
) -> ApprovalArchiveDeleteResult:
    return await prune_approval_archive(olderThanUnit, olderThanCount)


@router.delete("/archive/{item_id}")
async def delete_approval_archive_row(item_id: str) -> ApprovalArchiveDeleteResult:
    result = await delete_approval_archive_item(item_id)
    if result.deleted == 0:
        raise HTTPException(status_code=404, detail={"error": "Archive item not found"})
    return result
