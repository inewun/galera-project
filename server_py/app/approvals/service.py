from fastapi import HTTPException

from app.approvals import local_store, op_store
from app.approvals.schemas import ApprovalRequest, ApprovalRequestCreate, ApprovalStatus
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


async def decide_approval_request(request_id: str, status: ApprovalStatus) -> ApprovalRequest | None:
    return await _store().decide_approval_request(request_id, status)
