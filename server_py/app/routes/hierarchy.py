from fastapi import APIRouter, Body, HTTPException

from app.hierarchy.store import HierarchyMap, read_hierarchy, write_hierarchy


router = APIRouter(prefix="/api/hierarchy")


def _is_valid_hierarchy(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    return all(isinstance(item, str) or item is None for item in value.values())


@router.get("")
async def get_hierarchy() -> HierarchyMap:
    return await read_hierarchy()


@router.put("")
async def put_hierarchy(body: object = Body(...)) -> HierarchyMap:
    if not _is_valid_hierarchy(body):
        raise HTTPException(status_code=400, detail={"error": "Invalid hierarchy"})
    return await write_hierarchy(body)
