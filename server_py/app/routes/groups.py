from fastapi import APIRouter

from app.openproject.client import get_collection
from app.openproject.mappers import map_group
from app.openproject.schemas import Group


router = APIRouter(prefix="/api/groups")


@router.get("")
async def list_groups() -> list[Group]:
    raw = await get_collection("/api/v3/groups")
    return [map_group(item) for item in raw]
