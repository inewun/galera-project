from fastapi import HTTPException

from app.approvals import archive_store, local_store, op_store
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
from app.config import config


def _store():
    if config.approvals_source == "local":
        return local_store
    if config.approvals_source == "op":
        return op_store
    raise HTTPException(
        status_code=500,
        detail={"error": f"Unsupported APPROVALS_SOURCE={config.approvals_source}"},
    )


async def list_approval_requests(status: ApprovalStatus | None = None) -> list[ApprovalRequest]:
    return await _store().list_approval_requests(status)


async def create_approval_request(data: ApprovalRequestCreate) -> ApprovalRequest:
    return await _store().create_approval_request(data)


async def decide_approval_request(
    request_id: str,
    status: ApprovalStatus,
    decision: ApprovalDecision,
) -> ApprovalRequest | None:
    return await _store().decide_approval_request(request_id, status, decision)


async def list_approval_archive(
    year: int | None = None,
    month: int | None = None,
    group_by: ArchiveGroupBy = "all",
    status: ApprovalStatus | None = None,
    project_id: str | None = None,
    department_id: str | None = None,
    group_id: str | None = None,
) -> ApprovalArchiveResponse:
    if config.approvals_source == "op":
        await op_store.backfill_archive_org_metadata()
    return await archive_store.list_archive(
        year=year,
        month=month,
        group_by=group_by,
        status=status,
        project_id=project_id,
        department_id=department_id,
        group_id=group_id,
    )


async def delete_approval_archive_item(item_id: str) -> ApprovalArchiveDeleteResult:
    return ApprovalArchiveDeleteResult(deleted=await archive_store.delete_archive_item(item_id))


async def prune_approval_archive(unit: ArchivePruneUnit, count: int) -> ApprovalArchiveDeleteResult:
    return ApprovalArchiveDeleteResult(deleted=await archive_store.prune_archive(unit, count))
