import base64
import re
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.approvals.schemas import ApprovalRequest, ApprovalRequestCreate
from app.approvals.service import create_approval_request
from app.openproject.client import get_collection, id_from_href, op_get, op_patch, op_post
from app.openproject.mappers import map_work_package
from app.openproject.schemas import Task


router = APIRouter(prefix="/api/jira")


class JiraAuth(BaseModel):
    issueUrl: str = Field(min_length=2)
    apiToken: str = Field(min_length=1)
    email: str | None = None


class JiraPreviewRequest(JiraAuth):
    pass


class JiraImportRequest(JiraAuth):
    projectId: str = Field(min_length=1)
    typeId: str = Field(min_length=1)
    assigneeHref: str | None = None
    subject: str = Field(min_length=1, max_length=255)
    description: str | None = None
    startDate: str | None = None
    dueDate: str | None = None


class JiraUpdateRequest(JiraAuth):
    workPackageId: str = Field(min_length=1)
    subject: str = Field(min_length=1, max_length=255)
    description: str | None = None
    startDate: str | None = None
    dueDate: str | None = None
    assigneeHref: str | None = None


class OpenProjectType(BaseModel):
    id: str
    name: str
    isMilestone: bool = False


class OpenProjectAssignee(BaseModel):
    id: str
    name: str
    href: str
    assigneeType: Literal["user", "group", "placeholder"]


class JiraIssuePreview(BaseModel):
    key: str
    url: str
    subject: str
    description: str
    issueType: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee: str | None = None
    reporter: str | None = None
    startDate: str | None = None
    dueDate: str | None = None


class JiraImportResult(BaseModel):
    issue: JiraIssuePreview
    task: Task


class JiraUpdateResult(BaseModel):
    issue: JiraIssuePreview
    task: Task
    dueChanged: bool
    approvalRequest: ApprovalRequest | None = None


def _parse_issue_url(value: str) -> tuple[str, str]:
    trimmed = value.strip()
    parsed = urlparse(trimmed)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Введите полную ссылку на задачу Jira.")

    match = re.search(r"/browse/([A-Z][A-Z0-9]+-\d+)", parsed.path, re.IGNORECASE)
    if not match:
        match = re.search(r"/([A-Z][A-Z0-9]+-\d+)(?:$|[/?#])", trimmed, re.IGNORECASE)
    if not match:
        raise HTTPException(status_code=400, detail="Не удалось найти ключ задачи Jira в ссылке.")

    return f"{parsed.scheme}://{parsed.netloc}", match.group(1).upper()


def _jira_headers(auth: JiraAuth) -> dict[str, str]:
    email = (auth.email or "").strip()
    if email:
        token = base64.b64encode(f"{email}:{auth.apiToken}".encode("utf-8")).decode("ascii")
        authorization = f"Basic {token}"
    else:
        authorization = f"Bearer {auth.apiToken}"

    return {
        "Accept": "application/json",
        "Authorization": authorization,
    }


def _adf_to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(part for item in value if (part := _adf_to_text(item).strip()))
    if not isinstance(value, dict):
        return str(value)

    node_type = value.get("type")
    if node_type == "text":
        return str(value.get("text") or "")

    content = value.get("content")
    if not isinstance(content, list):
        return ""

    parts = [_adf_to_text(item) for item in content]
    joined = "".join(parts) if node_type in {"paragraph", "heading", "listItem"} else "\n".join(
        part for part in parts if part.strip()
    )
    return joined.strip()


def _field_name(value: Any) -> str | None:
    if isinstance(value, dict):
        name = value.get("displayName") or value.get("name")
        return str(name) if name else None
    return None


def _date_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        match = re.search(r"\d{4}-\d{2}-\d{2}", value)
        return match.group(0) if match else None
    if isinstance(value, dict):
        for key in ("startDate", "date", "value"):
            if found := _date_value(value.get(key)):
                return found
    return None


def _extract_jira_start_date(fields: dict[str, Any], names: dict[str, Any]) -> str | None:
    if found := _date_value(fields.get("customfield_10015")):
        return found

    candidate_ids = {"startDate", "startdate"}
    candidate_names = {
        "start date",
        "start",
        "planned start",
        "target start",
        "дата начала",
        "начало",
        "плановое начало",
    }

    for field_id, value in fields.items():
        normalized_id = str(field_id).lower()
        normalized_name = str(names.get(field_id) or "").strip().lower()
        if normalized_id in candidate_ids or normalized_name in candidate_names:
            if found := _date_value(value):
                return found

    return None


def _description(preview: JiraIssuePreview) -> str:
    lines = [preview.description.strip()]
    if (
        preview.issueType
        or preview.status
        or preview.priority
        or preview.assignee
        or preview.reporter
        or preview.startDate
        or preview.dueDate
    ):
        lines.extend(
            [
                "",
                "Поля Jira:",
                f"- Тип: {preview.issueType or '-'}",
                f"- Статус: {preview.status or '-'}",
                f"- Приоритет: {preview.priority or '-'}",
                f"- Исполнитель: {preview.assignee or '-'}",
                f"- Автор: {preview.reporter or '-'}",
                f"- Дата начала: {preview.startDate or '-'}",
                f"- Дата окончания: {preview.dueDate or '-'}",
            ]
        )
    return "\n".join(line for line in lines if line is not None).strip()


async def _load_jira_issue(auth: JiraAuth) -> JiraIssuePreview:
    base_url, issue_key = _parse_issue_url(auth.issueUrl)

    async with httpx.AsyncClient(headers=_jira_headers(auth), timeout=30.0) as client:
        response = await client.get(
            f"{base_url}/rest/api/3/issue/{issue_key}",
            params={"fields": "*all", "expand": "names"},
        )
        if response.status_code == 404:
            response = await client.get(
                f"{base_url}/rest/api/2/issue/{issue_key}",
                params={"fields": "*all", "expand": "names"},
            )

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail="Jira не приняла учетные данные.")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Задача Jira не найдена.")
    if not 200 <= response.status_code < 300:
        raise HTTPException(status_code=502, detail=f"Jira API error: {response.status_code} {response.text}")

    payload = response.json()
    fields_payload = payload.get("fields") or {}
    names_payload = payload.get("names") or {}
    issue_url = f"{base_url}/browse/{issue_key}"

    return JiraIssuePreview(
        key=str(payload.get("key") or issue_key),
        url=issue_url,
        subject=str(fields_payload.get("summary") or issue_key),
        description=_adf_to_text(fields_payload.get("description")),
        issueType=_field_name(fields_payload.get("issuetype")),
        status=_field_name(fields_payload.get("status")),
        priority=_field_name(fields_payload.get("priority")),
        assignee=_field_name(fields_payload.get("assignee")),
        reporter=_field_name(fields_payload.get("reporter")),
        startDate=_extract_jira_start_date(fields_payload, names_payload),
        dueDate=_date_value(fields_payload.get("duedate")),
    )


@router.post("/preview")
async def preview_jira_issue(request: JiraPreviewRequest) -> JiraIssuePreview:
    return await _load_jira_issue(request)


@router.get("/openproject/projects/{project_id}/types")
async def list_project_types(project_id: str) -> list[OpenProjectType]:
    raw = await get_collection(f"/api/v3/projects/{project_id}/types")
    return [
        OpenProjectType(
            id=str(item.get("id")),
            name=str(item.get("name") or item.get("id")),
            isMilestone=bool(item.get("isMilestone")),
        )
        for item in raw
    ]


def _assignee_type(value: dict[str, Any]) -> Literal["user", "group", "placeholder"]:
    raw_type = str(value.get("_type") or "").lower()
    href = (((value.get("_links") or {}).get("self") or {}).get("href") or "").lower()
    if raw_type == "group" or "/groups/" in href:
        return "group"
    if raw_type == "placeholderuser" or "/placeholder_users/" in href:
        return "placeholder"
    return "user"


@router.get("/openproject/projects/{project_id}/assignees")
async def list_project_assignees(project_id: str, typeId: str | None = None) -> list[OpenProjectAssignee]:
    body: dict[str, Any] = {"subject": "Jira import assignee lookup"}
    if typeId:
        body["_links"] = {"type": {"href": f"/api/v3/types/{typeId}"}}

    form = await op_post(f"/api/v3/projects/{project_id}/work_packages/form", body)
    assignee_schema = ((form.get("_embedded") or {}).get("schema") or {}).get("assignee") or {}
    embedded = (assignee_schema.get("_embedded") or {}).get("allowedValues")

    if isinstance(embedded, list):
        raw = embedded
    else:
        href = (((assignee_schema.get("_links") or {}).get("allowedValues") or {}).get("href"))
        raw = await get_collection(href) if href else []

    result: list[OpenProjectAssignee] = []
    for item in raw:
        links = item.get("_links") or {}
        self_link = links.get("self") or {}
        href = self_link.get("href")
        if not href:
            continue
        result.append(
            OpenProjectAssignee(
                id=str(item.get("id") or href.rsplit("/", 1)[-1]),
                name=str(item.get("name") or self_link.get("title") or href),
                href=str(href),
                assigneeType=_assignee_type(item),
            )
        )

    return result


@router.post("/import")
async def import_jira_issue(request: JiraImportRequest) -> JiraImportResult:
    issue = await _load_jira_issue(request)
    body: dict[str, Any] = {
        "subject": request.subject.strip(),
        "description": {
            "format": "markdown",
            "raw": (request.description or _description(issue)).strip(),
        },
        "_links": {
            "type": {"href": f"/api/v3/types/{request.typeId}"},
        },
    }
    if request.assigneeHref:
        body["_links"]["assignee"] = {"href": request.assigneeHref}
    if request.startDate:
        body["startDate"] = request.startDate
    if request.dueDate:
        body["dueDate"] = request.dueDate

    created = await op_post(f"/api/v3/projects/{request.projectId}/work_packages", body)
    return JiraImportResult(issue=issue, task=map_work_package(created))


@router.post("/update-openproject")
async def update_openproject_from_jira(request: JiraUpdateRequest) -> JiraUpdateResult:
    issue = await _load_jira_issue(request)
    current = await op_get(f"/api/v3/work_packages/{request.workPackageId}")
    links = current.get("_links") or {}
    project_link = links.get("project") or {}

    patch: dict[str, Any] = {
        "lockVersion": current.get("lockVersion"),
        "subject": request.subject.strip(),
        "description": {
            "format": "markdown",
            "raw": (request.description or _description(issue)).strip(),
        },
    }
    if request.startDate:
        patch["startDate"] = request.startDate
    if request.assigneeHref:
        patch["_links"] = {"assignee": {"href": request.assigneeHref}}

    updated = await op_patch(f"/api/v3/work_packages/{request.workPackageId}", patch)

    approval_request: ApprovalRequest | None = None
    due_changed = bool(request.dueDate) and request.dueDate != current.get("dueDate")
    if due_changed and request.dueDate:
        approval_request = await create_approval_request(
            ApprovalRequestCreate(
                taskId=str(request.workPackageId),
                taskSubject=request.subject.strip(),
                projectId=id_from_href(project_link.get("href")),
                projectName=project_link.get("title"),
                currentDue=current.get("dueDate"),
                proposedDue=request.dueDate,
                comment=f"Jira {issue.key}",
            )
        )
        updated = await op_get(f"/api/v3/work_packages/{request.workPackageId}")

    return JiraUpdateResult(
        issue=issue,
        task=map_work_package(updated),
        dueChanged=due_changed,
        approvalRequest=approval_request,
    )
