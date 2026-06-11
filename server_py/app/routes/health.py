from fastapi import APIRouter

from app.openproject.client import op_get


router = APIRouter(prefix="/api/health")


@router.get("")
async def health() -> dict[str, bool | str]:
    try:
        await op_get("/api/v3/users?pageSize=1")
        return {"ok": True, "op": "reachable"}
    except Exception:
        return {"ok": True, "op": "unreachable"}
