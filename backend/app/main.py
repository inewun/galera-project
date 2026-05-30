from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

from app.api.analytics import router as analytics_router
from app.api.approvals import router as approvals_router
from app.api.db_check import router as db_check_router
from app.api.employees import router as employees_router
from app.api.event_logs import router as event_logs_router
from app.api.health import router as health_router
from app.api.organization_units import router as organization_units_router
from app.api.plan_items import router as plan_items_router
from app.api.plan_link import router as plan_link_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(db_check_router)
app.include_router(organization_units_router)
app.include_router(employees_router)
app.include_router(plan_items_router)
app.include_router(plan_link_router)
app.include_router(approvals_router)
app.include_router(event_logs_router)
app.include_router(analytics_router)
