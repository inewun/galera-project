import sqlite3
from datetime import date, datetime, timezone
from uuid import uuid4

from app.approvals.schemas import (
    ApprovalArchiveItem,
    ApprovalArchiveResponse,
    ApprovalArchiveSummaryItem,
    ArchivePruneUnit,
    ArchiveGroupBy,
    ApprovalRequest,
    ApprovalStatus,
)
from app.config import REPO_ROOT


DATA_DIR = REPO_ROOT / "data"
DB_PATH = DATA_DIR / "approval_archive.sqlite3"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS approval_archive (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            task_subject TEXT NOT NULL,
            project_id TEXT,
            project_name TEXT,
            department_id TEXT,
            department_name TEXT,
            group_id TEXT,
            group_name TEXT,
            current_due TEXT,
            proposed_due TEXT,
            request_comment TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            decided_at TEXT NOT NULL,
            decided_by TEXT,
            decision_comment TEXT
        )
        """
    )
    return conn


def _row_to_item(row: sqlite3.Row) -> ApprovalArchiveItem:
    return ApprovalArchiveItem(
        id=row["id"],
        taskId=row["task_id"],
        taskSubject=row["task_subject"],
        projectId=row["project_id"],
        projectName=row["project_name"],
        departmentId=row["department_id"],
        departmentName=row["department_name"],
        groupId=row["group_id"],
        groupName=row["group_name"],
        currentDue=row["current_due"],
        proposedDue=row["proposed_due"],
        comment=row["request_comment"],
        status=row["status"],
        createdAt=row["created_at"],
        decidedAt=row["decided_at"],
        decidedBy=row["decided_by"],
        decisionComment=row["decision_comment"],
    )


def _shift_days(item: ApprovalArchiveItem) -> int | None:
    if item.currentDue is None or item.proposedDue is None:
        return None
    try:
        current = date.fromisoformat(item.currentDue)
        proposed = date.fromisoformat(item.proposedDue)
    except ValueError:
        return None
    return (proposed - current).days


def _avg(values: list[int]) -> int | None:
    if not values:
        return None
    return round(sum(values) / len(values))


def _date_or_dash(value: str | None) -> str:
    return value or "-"


def format_decision_comment(
    request: ApprovalRequest,
    status: ApprovalStatus,
    comment: str | None,
) -> str:
    decision = "Согласовано" if status == "approved" else "Не согласовано"
    cleaned_comment = (comment or "").strip() or "-"
    return (
        f"{decision} перенос даты с {_date_or_dash(request.currentDue)} "
        f"на {_date_or_dash(request.proposedDue)}. Комментарий: {cleaned_comment}"
    )


def _summary(items: list[ApprovalArchiveItem], group_by: ArchiveGroupBy) -> list[ApprovalArchiveSummaryItem]:
    if group_by == "all":
        return []

    buckets: dict[str, list[ApprovalArchiveItem]] = {}
    for item in items:
        if group_by == "project":
            key = item.projectId or "none"
            label = item.projectName or "Без проекта"
        elif group_by == "department":
            key = item.departmentId or "none"
            label = item.departmentName or "Без департамента"
        else:
            key = item.groupId or "none"
            label = item.groupName or "Без отдела"
        buckets.setdefault(f"{key}\0{label}", []).append(item)

    result: list[ApprovalArchiveSummaryItem] = []
    for packed_key, bucket_items in buckets.items():
        key, label = packed_key.split("\0", 1)
        shifts = [value for item in bucket_items if (value := _shift_days(item)) is not None]
        result.append(
            ApprovalArchiveSummaryItem(
                key=key,
                label=label,
                total=len(bucket_items),
                approved=sum(1 for item in bucket_items if item.status == "approved"),
                rejected=sum(1 for item in bucket_items if item.status == "rejected"),
                averageShiftDays=_avg(shifts),
            )
        )

    return sorted(result, key=lambda item: (-item.total, item.label))


async def add_archive_item(
    request: ApprovalRequest,
    status: ApprovalStatus,
    decided_by: str | None,
    decision_comment: str | None,
) -> ApprovalArchiveItem:
    if status not in ("approved", "rejected"):
        raise ValueError("Archive can store only approved/rejected decisions")

    item = ApprovalArchiveItem(
        **request.model_dump(exclude={"id", "status", "decidedAt"}),
        id=str(uuid4()),
        status=status,
        decidedAt=_now_iso(),
        decidedBy=decided_by,
        decisionComment=format_decision_comment(request, status, decision_comment),
    )

    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO approval_archive (
                id, task_id, task_subject, project_id, project_name, department_id, department_name,
                group_id, group_name, current_due, proposed_due, request_comment, status,
                created_at, decided_at, decided_by, decision_comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item.id,
                item.taskId,
                item.taskSubject,
                item.projectId,
                item.projectName,
                item.departmentId,
                item.departmentName,
                item.groupId,
                item.groupName,
                item.currentDue,
                item.proposedDue,
                item.comment,
                item.status,
                item.createdAt,
                item.decidedAt,
                item.decidedBy,
                item.decisionComment,
            ),
        )
    return item


async def list_task_ids_missing_metadata() -> list[str]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT task_id
            FROM approval_archive
            WHERE (department_id IS NULL AND group_id IS NULL) OR created_at = ''
            """
        ).fetchall()
    return [row["task_id"] for row in rows]


async def update_metadata_for_task(
    task_id: str,
    department_id: str | None,
    department_name: str | None,
    group_id: str | None,
    group_name: str | None,
    created_at: str | None,
) -> int:
    with _connect() as conn:
        cursor = conn.execute(
            """
            UPDATE approval_archive
            SET department_id = ?,
                department_name = ?,
                group_id = ?,
                group_name = ?,
                created_at = CASE WHEN created_at = '' THEN ? ELSE created_at END
            WHERE task_id = ?
            """,
            (department_id, department_name, group_id, group_name, created_at or "", task_id),
        )
        return cursor.rowcount


async def list_archive(
    year: int | None = None,
    month: int | None = None,
    group_by: ArchiveGroupBy = "all",
    status: ApprovalStatus | None = None,
    project_id: str | None = None,
    department_id: str | None = None,
    group_id: str | None = None,
) -> ApprovalArchiveResponse:
    where: list[str] = []
    params: list[str] = []

    if year is not None:
        where.append("substr(decided_at, 1, 4) = ?")
        params.append(f"{year:04d}")
    if month is not None:
        where.append("substr(decided_at, 6, 2) = ?")
        params.append(f"{month:02d}")
    if status is not None:
        where.append("status = ?")
        params.append(status)
    if project_id:
        where.append("project_id = ?")
        params.append(project_id)
    if department_id:
        where.append("department_id = ?")
        params.append(department_id)
    if group_id:
        where.append("group_id = ?")
        params.append(group_id)

    query = "SELECT * FROM approval_archive"
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY decided_at DESC"

    with _connect() as conn:
        rows = conn.execute(query, params).fetchall()

    items = [_row_to_item(row) for row in rows]
    shifts = [value for item in items if (value := _shift_days(item)) is not None]
    return ApprovalArchiveResponse(
        items=items,
        total=len(items),
        approved=sum(1 for item in items if item.status == "approved"),
        rejected=sum(1 for item in items if item.status == "rejected"),
        averageShiftDays=_avg(shifts),
        summary=_summary(items, group_by),
    )


async def delete_archive_item(item_id: str) -> int:
    with _connect() as conn:
        cursor = conn.execute("DELETE FROM approval_archive WHERE id = ?", (item_id,))
        return cursor.rowcount


async def prune_archive(unit: ArchivePruneUnit, count: int) -> int:
    if count < 1:
        return 0
    modifier = f"-{count} {'months' if unit == 'month' else 'years'}"
    with _connect() as conn:
        cursor = conn.execute(
            "DELETE FROM approval_archive WHERE decided_at < datetime('now', ?)",
            (modifier,),
        )
        return cursor.rowcount
