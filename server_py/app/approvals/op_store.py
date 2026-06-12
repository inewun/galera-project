from datetime import date
from typing import Any

from fastapi import HTTPException

from app.approvals.schemas import ApprovalRequest, ApprovalRequestCreate, ApprovalStatus
from app.config import config
from app.openproject.client import get_collection, op_get, op_patch
from app.openproject.mappers import id_from_href


STATUS_BY_HREF: dict[str, ApprovalStatus] = {
    config.op_approval_status_pending_href: "pending",
    config.op_approval_status_approved_href: "approved",
    config.op_approval_status_rejected_href: "rejected",
}


def _not_configured() -> HTTPException:
    return HTTPException(
        status_code=501,
        detail={
            "error": "OP approval custom fields are not configured",
            "detail": "Fill OP_APPROVAL_* env values, then set APPROVALS_SOURCE=op.",
        },
    )


def _write_disabled() -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={
            "error": "OpenProject writes are disabled",
            "detail": "Set WRITE_ENABLED=true only when OP approval write-back is intended.",
        },
    )


def _has_required_config() -> bool:
    return all(
        [
            config.op_approval_status_field,
            config.op_approval_status_none_href,
            config.op_approval_status_pending_href,
            config.op_approval_status_approved_href,
            config.op_approval_status_rejected_href,
            config.op_approval_proposed_due_field,
            config.op_approval_comment_field,
            config.op_approval_requested_at_field,
            config.op_approval_requested_by_field,
            config.op_approval_decided_at_field,
            config.op_approval_decided_by_field,
        ]
    )


def _ensure_configured() -> None:
    if not _has_required_config():
        raise _not_configured()


def _ensure_write_enabled() -> None:
    if not config.write_enabled:
        raise _write_disabled()


def _today() -> str:
    return date.today().isoformat()


def _link_href(wp: dict[str, Any], key: str) -> str | None:
    value = ((wp.get("_links") or {}).get(key) or {}).get("href")
    return value if isinstance(value, str) else None


def _status_from_wp(wp: dict[str, Any]) -> ApprovalStatus | None:
    href = _link_href(wp, config.op_approval_status_field)
    if href == config.op_approval_status_none_href:
        return None
    return STATUS_BY_HREF.get(href or "")


def _map_wp(wp: dict[str, Any]) -> ApprovalRequest | None:
    status = _status_from_wp(wp)
    if status is None:
        return None

    links = wp.get("_links") or {}
    project = links.get("project") or {}
    proposed_due = wp.get(config.op_approval_proposed_due_field)
    created_at = wp.get(config.op_approval_requested_at_field) or ""
    decided_at = wp.get(config.op_approval_decided_at_field)

    return ApprovalRequest(
        id=str(wp.get("id")),
        taskId=str(wp.get("id")),
        taskSubject=wp.get("subject") or "",
        projectId=id_from_href(project.get("href")),
        projectName=project.get("title"),
        departmentId=None,
        departmentName=None,
        groupId=None,
        groupName=None,
        currentDue=wp.get("dueDate"),
        proposedDue=proposed_due if isinstance(proposed_due, str) else None,
        status=status,
        createdAt=created_at,
        decidedAt=decided_at if isinstance(decided_at, str) else None,
    )


def _approval_patch(
    wp: dict[str, Any],
    status_href: str,
    fields: dict[str, Any],
) -> dict[str, Any]:
    return {
        "lockVersion": wp.get("lockVersion"),
        **fields,
        "_links": {
            config.op_approval_status_field: {"href": status_href},
        },
    }


async def _get_work_package(task_id: str) -> dict[str, Any]:
    return await op_get(f"/api/v3/work_packages/{task_id}")


async def _patch_work_package(task_id: str, body: dict[str, Any]) -> dict[str, Any]:
    return await op_patch(f"/api/v3/work_packages/{task_id}", body)


async def list_approval_requests(status: ApprovalStatus | None = None) -> list[ApprovalRequest]:
    _ensure_configured()
    raw = await get_collection("/api/v3/work_packages")
    items = [item for wp in raw if (item := _map_wp(wp)) is not None]
    if status is None:
        return items
    return [item for item in items if item.status == status]


async def create_approval_request(data: ApprovalRequestCreate) -> ApprovalRequest:
    _ensure_configured()
    _ensure_write_enabled()

    wp = await _get_work_package(data.taskId)
    patch = _approval_patch(
        wp,
        config.op_approval_status_pending_href,
        {
            config.op_approval_proposed_due_field: data.proposedDue,
            config.op_approval_comment_field: {"raw": ""},
            config.op_approval_requested_at_field: _today(),
            config.op_approval_requested_by_field: "Galera Gantt",
            config.op_approval_decided_at_field: None,
            config.op_approval_decided_by_field: None,
        },
    )
    updated = await _patch_work_package(data.taskId, patch)
    mapped = _map_wp(updated)
    if mapped is None:
        raise HTTPException(status_code=500, detail={"error": "Failed to map created approval request"})
    return mapped


async def decide_approval_request(request_id: str, status: ApprovalStatus) -> ApprovalRequest | None:
    _ensure_configured()
    _ensure_write_enabled()

    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail={"error": "Only approved/rejected decisions are supported"})

    wp = await _get_work_package(request_id)
    if _status_from_wp(wp) is None:
        return None

    status_href = (
        config.op_approval_status_approved_href
        if status == "approved"
        else config.op_approval_status_rejected_href
    )
    patch = _approval_patch(
        wp,
        status_href,
        {
            config.op_approval_decided_at_field: _today(),
            config.op_approval_decided_by_field: "Galera Gantt",
        },
    )
    updated = await _patch_work_package(request_id, patch)
    return _map_wp(updated)
