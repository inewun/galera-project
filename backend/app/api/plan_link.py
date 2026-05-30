from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud.plan_link import CRUDPlanLink
from app.db.session import get_db
from app.models.enums import PlanLinkType
from app.schemas.plan_link import (
    PlanLinkCreate,
    PlanLinkRead,
    PlanLinkUpdate,
)

router = APIRouter(prefix="/plan-links", tags=["Plan Links"])


@router.post("/", response_model=PlanLinkRead, status_code=status.HTTP_201_CREATED)
def create_plan_link(
    data: PlanLinkCreate,
    db: Session = Depends(get_db),
):
    """Create a link between two plan items.

    Validates:
    - source != target
    - both plan items exist
    - both plan items are not archived
    """
    if data.source_plan_item_id == data.target_plan_item_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="source_plan_item_id and target_plan_item_id must be different",
        )

    # Validate both plan items exist
    from app.crud.plan_item import CRUDPlanItem as CRUDPlanItem_

    source = CRUDPlanItem_.get_by_id(db=db, obj_id=data.source_plan_item_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source plan item (id={data.source_plan_item_id}) not found",
        )
    target = CRUDPlanItem_.get_by_id(db=db, obj_id=data.target_plan_item_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target plan item (id={data.target_plan_item_id}) not found",
        )

    if source.is_archived:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Source plan item is archived",
        )
    if target.is_archived:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Target plan item is archived",
        )

    return CRUDPlanLink.create(db=db, data=data)


@router.get("/", response_model=list[PlanLinkRead])
def list_plan_links(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    source_plan_item_id: int | None = Query(None),
    target_plan_item_id: int | None = Query(None),
    link_type: PlanLinkType | None = Query(None),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    """List plan links with optional filters."""
    return CRUDPlanLink.get_multi(
        db=db,
        skip=skip,
        limit=limit,
        source_plan_item_id=source_plan_item_id,
        target_plan_item_id=target_plan_item_id,
        link_type=link_type,
        is_active=is_active,
    )


@router.get("/{link_id}", response_model=PlanLinkRead)
def get_plan_link(
    link_id: int,
    db: Session = Depends(get_db),
):
    """Get a plan link by ID."""
    obj = CRUDPlanLink.get_by_id(db=db, link_id=link_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan link not found",
        )
    return obj


@router.patch("/{link_id}", response_model=PlanLinkRead)
def update_plan_link(
    link_id: int,
    data: PlanLinkUpdate,
    db: Session = Depends(get_db),
):
    """Update a plan link (link_type, is_active)."""
    db_obj = CRUDPlanLink.get_by_id(db=db, link_id=link_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan link not found",
        )
    return CRUDPlanLink.update(db=db, db_obj=db_obj, data=data)


@router.delete("/{link_id}", response_model=PlanLinkRead)
def delete_plan_link(
    link_id: int,
    db: Session = Depends(get_db),
):
    """Soft delete a plan link: sets is_active=false.

    The link record is NOT physically removed from the database.
    An EventLog LINK_DEACTIVATED entry is created.
    """
    db_obj = CRUDPlanLink.get_by_id(db=db, link_id=link_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan link not found",
        )
    return CRUDPlanLink.soft_delete(db=db, db_obj=db_obj)
