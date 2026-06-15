import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import REPO_ROOT, config
from app.openproject.client import OpenProjectError
from app.routes import approval_requests, groups, health, hierarchy, jira_import, projects, users, work_packages, write_stubs


app = FastAPI(title="OpenProject Gantt API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.client_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(work_packages.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(projects.router)
app.include_router(hierarchy.router)
app.include_router(approval_requests.router)
if config.jira_enabled:
    app.include_router(jira_import.router)
app.include_router(write_stubs.router)


def _collect_openproject_messages(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return []

    nested_errors = value.get("_embedded", {}).get("errors", [])
    nested_messages: list[str] = []
    if isinstance(nested_errors, list):
        for error in nested_errors:
            nested_messages.extend(_collect_openproject_messages(error))

    message = value.get("message")
    direct_messages = [message] if isinstance(message, str) and message.strip() else []
    return nested_messages + direct_messages


def _openproject_error_message(error: str) -> str:
    json_start = error.find("{")
    if json_start == -1:
        return error

    try:
        payload = json.loads(error[json_start:])
    except json.JSONDecodeError:
        return error

    messages = list(dict.fromkeys(message.strip() for message in _collect_openproject_messages(payload) if message.strip()))
    return " ".join(messages) if messages else error


@app.exception_handler(OpenProjectError)
async def openproject_error_handler(_request: Request, exc: OpenProjectError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": "OpenProject API error", "message": _openproject_error_message(str(exc)), "detail": str(exc)},
    )


CLIENT_DIST = REPO_ROOT / "client" / "dist"

if config.node_env == "production" and CLIENT_DIST.exists():
    assets_dir = CLIENT_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa_fallback(path: str) -> FileResponse:
        requested = (CLIENT_DIST / path).resolve()
        if requested.is_file() and CLIENT_DIST in requested.parents:
            return FileResponse(requested)
        return FileResponse(CLIENT_DIST / "index.html")
