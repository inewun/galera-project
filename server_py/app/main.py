from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import REPO_ROOT, config
from app.openproject.client import OpenProjectError
from app.routes import approval_requests, groups, health, hierarchy, projects, users, work_packages, write_stubs


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
app.include_router(write_stubs.router)


@app.exception_handler(OpenProjectError)
async def openproject_error_handler(_request: Request, exc: OpenProjectError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": "OpenProject API error", "detail": str(exc)},
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
