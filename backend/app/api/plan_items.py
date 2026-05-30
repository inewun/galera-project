from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud.plan_item import CRUDPlanItem
from app.crud.plan_link import CRUDPlanLink
from app.db.session import get_db
from app.models.enums import PlanItemType, PlanStatus
from app.schemas.plan_item import (
    PlanItemCreate,
    PlanItemRead,
    PlanItemReschedule,
    PlanItemUpdate,
)
from app.schemas.plan_link import (
    PlanItemLinksRead,
    PlanLinkIncomingInfo,
    PlanLinkItemInfo,
)

router = APIRouter(prefix="/plan-items", tags=["Plan Items"])


@router.post("/", response_model=PlanItemRead, status_code=status.HTTP_201_CREATED)
def create_plan_item(
    data: PlanItemCreate,
    db: Session = Depends(get_db),
):
    """Create a new plan item. Automatically creates an EventLog entry."""
    return CRUDPlanItem.create(db=db, data=data)


@router.get("/", response_model=list[PlanItemRead])
def list_plan_items(
    skip: int = 0,
    limit: int = 100,
    type: PlanItemType | None = Query(default=None),
    status: PlanStatus | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    organization_unit_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """List plan items with optional filters and pagination."""
    return CRUDPlanItem.get_multi(
        db=db,
        skip=skip,
        limit=limit,
        type=type,
        status=status,
        employee_id=employee_id,
        organization_unit_id=organization_unit_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/{obj_id}/", response_model=PlanItemRead)
def get_plan_item(
    obj_id: int,
    db: Session = Depends(get_db),
):
    """Get a plan item by ID."""
    obj = CRUDPlanItem.get_by_id(db=db, obj_id=obj_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan item not found",
        )
    return obj


@router.patch("/{obj_id}/", response_model=PlanItemRead)
def update_plan_item(
    obj_id: int,
    data: PlanItemUpdate,
    db: Session = Depends(get_db),
):
    """Update a plan item. Automatically creates EventLog entries for status/deadline changes."""
    db_obj = CRUDPlanItem.get_by_id(db=db, obj_id=obj_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan item not found",
        )
    return CRUDPlanItem.update(db=db, db_obj=db_obj, data=data)


@router.post("/{obj_id}/reschedule/", response_model=PlanItemRead)
def reschedule_plan_item(
    obj_id: int,
    data: PlanItemReschedule,
    db: Session = Depends(get_db),
):
    """Reschedule a plan item with a mandatory reason. Creates an EventLog entry."""
    db_obj = CRUDPlanItem.get_by_id(db=db, obj_id=obj_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan item not found",
        )
    return CRUDPlanItem.reschedule(db=db, db_obj=db_obj, data=data)


@router.get("/{obj_id}/links", response_model=PlanItemLinksRead)
def get_plan_item_links(
    obj_id: int,
    db: Session = Depends(get_db),
):
    """Get all links (incoming and outgoing) for a plan item."""
    obj = CRUDPlanItem.get_by_id(db=db, obj_id=obj_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan item not found",
        )

    outgoing, incoming = CRUDPlanLink.get_plan_item_links(db=db, plan_item_id=obj_id)

    return PlanItemLinksRead(
        plan_item_id=obj_id,
        outgoing_links=[
            PlanLinkItemInfo(
                id=link.id,
                target_plan_item_id=link.target_plan_item_id,
                link_type=link.link_type,
                is_active=link.is_active,
            )
            for link in outgoing
        ],
        incoming_links=[
            PlanLinkIncomingInfo(
                id=link.id,
                source_plan_item_id=link.source_plan_item_id,
                link_type=link.link_type,
                is_active=link.is_active,
            )
            for link in incoming
        ],
    )
