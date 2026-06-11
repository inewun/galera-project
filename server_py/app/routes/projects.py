from fastapi import APIRouter

from app.openproject.client import get_collection
from app.openproject.mappers import map_project
from app.openproject.schemas import Project


router = APIRouter(prefix="/api/projects")


@router.get("")
async def list_projects() -> list[Project]:
    raw = await get_collection("/api/v3/projects")
    return [map_project(item) for item in raw]
