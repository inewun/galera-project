from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud.analytics import CRUDAnalytics
from app.db.session import get_db
from app.models.enums import PlanItemType
from app.schemas.analytics import (
    EmployeeSummary,
    OrgUnitSummary,
    PlanFactItem,
    PlanFactResponse,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/plan-fact/", response_model=PlanFactResponse)
def get_plan_fact(
    type: PlanItemType | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    organization_unit_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Return plan-fact analysis data with reschedule counts."""
    items_data = CRUDAnalytics.get_plan_fact(
        db=db,
        type=type,
        employee_id=employee_id,
        organization_unit_id=organization_unit_id,
        date_from=date_from,
        date_to=date_to,
    )
    # Convert dicts to PlanFactItem models
    items = [PlanFactItem(**row) for row in items_data]
    return PlanFactResponse(total=len(items), items=items)


@router.get(
    "/employees/{employee_id}/summary/",
    response_model=EmployeeSummary,
)
def get_employee_summary(
    employee_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    type: PlanItemType | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Return summary statistics for a specific employee."""
    data = CRUDAnalytics.get_employee_summary(
        db=db,
        employee_id=employee_id,
        date_from=date_from,
        date_to=date_to,
        type=type,
    )
    return EmployeeSummary(**data)


@router.get(
    "/organization-units/{unit_id}/summary/",
    response_model=OrgUnitSummary,
)
def get_org_unit_summary(
    unit_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    type: PlanItemType | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Return summary statistics for a specific organization unit."""
    data = CRUDAnalytics.get_org_unit_summary(
        db=db,
        unit_id=unit_id,
        date_from=date_from,
        date_to=date_to,
        type=type,
    )
    return OrgUnitSummary(**data)