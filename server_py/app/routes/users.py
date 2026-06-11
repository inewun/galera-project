from fastapi import APIRouter

from app.openproject.client import get_collection
from app.openproject.mappers import map_user
from app.openproject.schemas import User


router = APIRouter(prefix="/api/users")


@router.get("")
async def list_users() -> list[User]:
    raw = await get_collection("/api/v3/users")
    return [map_user(item) for item in raw]
