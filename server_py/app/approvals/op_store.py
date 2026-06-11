from fastapi import HTTPException

from app.approvals.schemas import ApprovalRequest, ApprovalRequestCreate, ApprovalStatus
from app.config import config


def _not_configured() -> HTTPException:
    return HTTPException(
        status_code=501,
        detail={
            "error": "OP approval custom fields are not configured",
            "detail": "Create custom fields in OpenProject, fill OP_APPROVAL_* env values, then set APPROVALS_SOURCE=op.",
        },
    )


def _has_required_config() -> bool:
    return all(
        [
            config.op_approval_status_field,
            config.op_approval_status_pending_href,
            config.op_approval_status_approved_href,
            config.op_approval_status_rejected_href,
            config.op_approval_proposed_due_field,
            config.op_approval_previous_due_field,
            config.op_approval_request_id_field,
        ]
    )


async def list_approval_requests(status: ApprovalStatus | None = None) -> list[ApprovalRequest]:
    if not _has_required_config():
        raise _not_configured()
    raise _not_configured()


async def create_approval_request(data: ApprovalRequestCreate) -> ApprovalRequest:
    if not _has_required_config():
        raise _not_configured()
    raise _not_configured()


async def decide_approval_request(request_id: str, status: ApprovalStatus) -> ApprovalRequest | None:
    if not _has_required_config():
        raise _not_configured()
    raise _not_configured()
