from fastapi import APIRouter, HTTPException

from app.approvals.schemas import ApprovalRequest, ApprovalRequestCreate, ApprovalStatus
from app.approvals.service import create_approval_request, decide_approval_request, list_approval_requests


router = APIRouter(prefix="/api/approval-requests")


@router.get("")
async def get_approval_requests(status: ApprovalStatus | None = None) -> list[ApprovalRequest]:
    return await list_approval_requests(status)


@router.post("")
async def post_approval_request(body: ApprovalRequestCreate) -> ApprovalRequest:
    return await create_approval_request(body)


@router.post("/{request_id}/approve")
async def approve_approval_request(request_id: str) -> ApprovalRequest:
    request = await decide_approval_request(request_id, "approved")
    if request is None:
        raise HTTPException(status_code=404, detail={"error": "Approval request not found"})
    return request


@router.post("/{request_id}/reject")
async def reject_approval_request(request_id: str) -> ApprovalRequest:
    request = await decide_approval_request(request_id, "rejected")
    if request is None:
        raise HTTPException(status_code=404, detail={"error": "Approval request not found"})
    return request
