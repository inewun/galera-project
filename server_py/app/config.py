from dataclasses import dataclass
from pathlib import Path
import os


REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = REPO_ROOT / ".env"


def _load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


_env_file = _load_dotenv(ENV_PATH)


def _get_env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, _env_file.get(name, default))
    if required and (value is None or value.strip() == ""):
        raise RuntimeError(f"[config] FATAL: {name} is not set. Check your .env file.")
    return "" if value is None else value.strip()


def _strip_trailing_slash(url: str) -> str:
    return url.rstrip("/")


@dataclass(frozen=True)
class Config:
    op_base_url: str
    op_api_key: str
    port: int
    client_origin: str
    auth_enabled: bool
    write_enabled: bool
    session_secret: str
    node_env: str
    approvals_source: str
    op_approval_status_field: str
    op_approval_status_none_href: str
    op_approval_status_pending_href: str
    op_approval_status_approved_href: str
    op_approval_status_rejected_href: str
    op_approval_proposed_due_field: str
    op_approval_comment_field: str
    op_approval_requested_at_field: str
    op_approval_requested_by_field: str


config = Config(
    op_base_url=_strip_trailing_slash(_get_env("OP_BASE_URL", required=True)),
    op_api_key=_get_env("OP_API_KEY", required=True),
    port=int(_get_env("PORT", "4000")),
    client_origin=_get_env("CLIENT_ORIGIN", "http://localhost:3100"),
    auth_enabled=_get_env("AUTH_ENABLED", "false") == "true",
    write_enabled=_get_env("WRITE_ENABLED", "false") == "true",
    session_secret=_get_env("SESSION_SECRET", "change_me_later"),
    node_env=_get_env("NODE_ENV", "development"),
    approvals_source=_get_env("APPROVALS_SOURCE", "local"),
    op_approval_status_field=_get_env("OP_APPROVAL_STATUS_FIELD", ""),
    op_approval_status_none_href=_get_env("OP_APPROVAL_STATUS_NONE_HREF", ""),
    op_approval_status_pending_href=_get_env("OP_APPROVAL_STATUS_PENDING_HREF", ""),
    op_approval_status_approved_href=_get_env("OP_APPROVAL_STATUS_APPROVED_HREF", ""),
    op_approval_status_rejected_href=_get_env("OP_APPROVAL_STATUS_REJECTED_HREF", ""),
    op_approval_proposed_due_field=_get_env("OP_APPROVAL_PROPOSED_DUE_FIELD", ""),
    op_approval_comment_field=_get_env("OP_APPROVAL_COMMENT_FIELD", ""),
    op_approval_requested_at_field=_get_env("OP_APPROVAL_REQUESTED_AT_FIELD", ""),
    op_approval_requested_by_field=_get_env("OP_APPROVAL_REQUESTED_BY_FIELD", ""),
)
