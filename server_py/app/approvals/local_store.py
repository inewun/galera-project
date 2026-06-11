import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from app.approvals.schemas import ApprovalRequest, ApprovalRequestCreate, ApprovalStatus
from app.config import REPO_ROOT


DATA_DIR = REPO_ROOT / "data"
FILE_PATH = DATA_DIR / "approval_requests.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _read_raw() -> list[dict]:
    if not FILE_PATH.exists():
        return []
    value = json.loads(FILE_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError("Invalid approval requests file: expected a list")
    return value


def _write_raw(items: list[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    FILE_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


async def list_approval_requests(status: ApprovalStatus | None = None) -> list[ApprovalRequest]:
    items = [ApprovalRequest.model_validate(item) for item in _read_raw()]
    if status is None:
        return items
    return [item for item in items if item.status == status]


async def create_approval_request(data: ApprovalRequestCreate) -> ApprovalRequest:
    items = _read_raw()
    request = ApprovalRequest(
        **data.model_dump(),
        id=str(uuid4()),
        status="pending",
        createdAt=_now_iso(),
        decidedAt=None,
    )
    items.append(request.model_dump())
    _write_raw(items)
    return request


async def decide_approval_request(request_id: str, status: Literal["approved", "rejected"]) -> ApprovalRequest | None:
    items = _read_raw()
    for index, item in enumerate(items):
        if item.get("id") != request_id:
            continue
        updated = ApprovalRequest.model_validate(
            {
                **item,
                "status": status,
                "decidedAt": _now_iso(),
            }
        )
        items[index] = updated.model_dump()
        _write_raw(items)
        return updated
    return None
