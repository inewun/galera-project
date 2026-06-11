from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import config


router = APIRouter(prefix="/api")


def _not_implemented() -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={
            "error": "Not implemented",
            "detail": f"WRITE_ENABLED={str(config.write_enabled).lower()}",
        },
    )


@router.post("/work-packages")
async def create_work_package() -> JSONResponse:
    return _not_implemented()


@router.patch("/work-packages/{work_package_id}")
async def update_work_package(work_package_id: str) -> JSONResponse:
    return _not_implemented()


@router.delete("/work-packages/{work_package_id}")
async def delete_work_package(work_package_id: str) -> JSONResponse:
    return _not_implemented()
