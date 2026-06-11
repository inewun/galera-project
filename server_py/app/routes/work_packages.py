from fastapi import APIRouter

from app.openproject.client import get_collection
from app.openproject.mappers import map_work_package
from app.openproject.schemas import Task


router = APIRouter(prefix="/api/work-packages")


@router.get("")
async def list_work_packages(projectId: str | None = None) -> list[Task]:
    path = f"/api/v3/projects/{projectId}/work_packages" if projectId else "/api/v3/work_packages"
    raw = await get_collection(path)
    return [map_work_package(item) for item in raw]
