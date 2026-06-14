from datetime import date
from typing import Any

from fastapi import HTTPException

from app.approvals import archive_store
from app.approvals.schemas import ApprovalDecision, ApprovalRequest, ApprovalRequestCreate, ApprovalStatus
from app.config import config
from app.hierarchy.store import HierarchyMap, read_hierarchy
from app.openproject.client import get_collection, op_get, op_patch
from app.openproject.mappers import id_from_href, map_group
from app.openproject.schemas import Group


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


def _text_value(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        raw = value.get("raw")
        return raw if isinstance(raw, str) else None
    return None


def _status_from_wp(wp: dict[str, Any]) -> ApprovalStatus | None:
    href = _link_href(wp, config.op_approval_status_field)
    if href == config.op_approval_status_none_href:
        return None
    return STATUS_BY_HREF.get(href or "")


async def _load_org_context() -> tuple[list[Group], HierarchyMap]:
    raw_groups = await get_collection("/api/v3/groups")
    return [map_group(item) for item in raw_groups], await read_hierarchy()


def _is_department(group: Group, hierarchy: HierarchyMap) -> bool:
    return hierarchy.get(group.id) is None


def _org_fields_from_wp(
    wp: dict[str, Any],
    groups: list[Group] | None,
    hierarchy: HierarchyMap | None,
) -> dict[str, str | None]:
    result = {
        "departmentId": None,
        "departmentName": None,
        "groupId": None,
        "groupName": None,
    }
    if groups is None or hierarchy is None:
        return result

    links = wp.get("_links") or {}
    assignee_href = (links.get("assignee") or {}).get("href")
    assignee_id = id_from_href(assignee_href)
    if assignee_id is None:
        return result

    group_by_id = {group.id: group for group in groups}
    assigned_group: Group | None = None

    if assignee_href and "/groups/" in assignee_href:
        assigned_group = group_by_id.get(assignee_id)
    elif assignee_href and "/users/" in assignee_href:
        member_groups = [group for group in groups if assignee_id in group.memberIds]
        office_groups = [group for group in member_groups if not _is_department(group, hierarchy)]
        candidates = office_groups or member_groups
        assigned_group = sorted(candidates, key=lambda group: group.name)[0] if candidates else None

    if assigned_group is None:
        return result

    if _is_department(assigned_group, hierarchy):
        result["departmentId"] = assigned_group.id
        result["departmentName"] = assigned_group.name
        return result

    department_id = hierarchy.get(assigned_group.id)
    department = group_by_id.get(department_id) if department_id else None
    result["departmentId"] = department.id if department else department_id
    result["departmentName"] = department.name if department else None
    result["groupId"] = assigned_group.id
    result["groupName"] = assigned_group.name
    return result


def _map_wp(
    wp: dict[str, Any],
    groups: list[Group] | None = None,
    hierarchy: HierarchyMap | None = None,
) -> ApprovalRequest | None:
    status = _status_from_wp(wp)
    if status is None:
        return None

    links = wp.get("_links") or {}
    project = links.get("project") or {}
    proposed_due = wp.get(config.op_approval_proposed_due_field)
    created_at = wp.get(config.op_approval_requested_at_field) or wp.get("createdAt") or ""
    decided_at = wp.get(config.op_approval_decided_at_field)
    comment = _text_value(wp.get(config.op_approval_comment_field))
    org_fields = _org_fields_from_wp(wp, groups, hierarchy)

    return ApprovalRequest(
        id=str(wp.get("id")),
        taskId=str(wp.get("id")),
        taskSubject=wp.get("subject") or "",
        projectId=id_from_href(project.get("href")),
        projectName=project.get("title"),
        departmentId=org_fields["departmentId"],
        departmentName=org_fields["departmentName"],
        groupId=org_fields["groupId"],
        groupName=org_fields["groupName"],
        currentDue=wp.get("dueDate"),
        proposedDue=proposed_due if isinstance(proposed_due, str) else None,
        comment=comment,
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


def _clear_approval_fields_patch(wp: dict[str, Any], extra_fields: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "lockVersion": wp.get("lockVersion"),
        **(extra_fields or {}),
        config.op_approval_proposed_due_field: None,
        config.op_approval_comment_field: {"raw": ""},
        config.op_approval_requested_at_field: None,
        config.op_approval_requested_by_field: None,
        "_links": {
            config.op_approval_status_field: {"href": config.op_approval_status_none_href},
        },
    }


def _decision_approval_fields_patch(
    wp: dict[str, Any],
    status_href: str,
    decision_comment: str,
    extra_fields: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "lockVersion": wp.get("lockVersion"),
        **(extra_fields or {}),
        config.op_approval_proposed_due_field: None,
        config.op_approval_comment_field: {"raw": decision_comment},
        config.op_approval_requested_at_field: None,
        config.op_approval_requested_by_field: None,
        "_links": {
            config.op_approval_status_field: {"href": status_href},
        },
    }


async def list_approval_requests(status: ApprovalStatus | None = None) -> list[ApprovalRequest]:
    _ensure_configured()
    raw = await get_collection("/api/v3/work_packages")
    groups, hierarchy = await _load_org_context()
    items = [item for wp in raw if (item := _map_wp(wp, groups, hierarchy)) is not None]
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
        },
    )
    updated = await _patch_work_package(data.taskId, patch)
    groups, hierarchy = await _load_org_context()
    mapped = _map_wp(updated, groups, hierarchy)
    if mapped is None:
        raise HTTPException(status_code=500, detail={"error": "Failed to map created approval request"})
    return mapped


async def decide_approval_request(
    request_id: str,
    status: ApprovalStatus,
    decision: ApprovalDecision | None = None,
) -> ApprovalRequest | None:
    _ensure_configured()
    _ensure_write_enabled()

    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail={"error": "Only approved/rejected decisions are supported"})

    wp = await _get_work_package(request_id)
    groups, hierarchy = await _load_org_context()
    mapped = _map_wp(wp, groups, hierarchy)
    if mapped is None:
        return None

    fields: dict[str, Any] = {}
    if status == "approved" and mapped.proposedDue is not None:
        fields["dueDate"] = mapped.proposedDue
    status_href = (
        config.op_approval_status_approved_href
        if status == "approved"
        else config.op_approval_status_rejected_href
    )
    decision_comment = archive_store.format_decision_comment(
        mapped,
        status,
        decision.comment if decision else None,
    )
    await _patch_work_package(
        request_id,
        _decision_approval_fields_patch(wp, status_href, decision_comment, fields),
    )
    archive_item = await archive_store.add_archive_item(
        mapped,
        status,
        decided_by="Galera Gantt",
        decision_comment=(decision.comment if decision else None),
    )
    return archive_item


async def backfill_archive_org_metadata() -> None:
    task_ids = await archive_store.list_task_ids_missing_metadata()
    if not task_ids:
        return

    groups, hierarchy = await _load_org_context()
    for task_id in task_ids:
        try:
            wp = await _get_work_package(task_id)
        except Exception:
            continue
        org_fields = _org_fields_from_wp(wp, groups, hierarchy)
        created_at = wp.get(config.op_approval_requested_at_field) or wp.get("createdAt")
        if org_fields["departmentId"] is None and org_fields["groupId"] is None and not created_at:
            continue
        await archive_store.update_metadata_for_task(
            task_id,
            org_fields["departmentId"],
            org_fields["departmentName"],
            org_fields["groupId"],
            org_fields["groupName"],
            created_at if isinstance(created_at, str) else None,
        )
