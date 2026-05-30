from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud.organization_unit import CRUDOrganizationUnit
from app.db.session import get_db
from app.schemas.organization_unit import (
    OrganizationUnitCreate,
    OrganizationUnitRead,
    OrganizationUnitUpdate,
)

router = APIRouter(prefix="/organization-units", tags=["Organization Units"])


@router.post("/", response_model=OrganizationUnitRead, status_code=status.HTTP_201_CREATED)
def create_organization_unit(
    data: OrganizationUnitCreate,
    db: Session = Depends(get_db),
):
    """Create a new organization unit."""
    return CRUDOrganizationUnit.create(db=db, data=data)


@router.get("/", response_model=list[OrganizationUnitRead])
def list_organization_units(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List organization units with pagination."""
    return CRUDOrganizationUnit.get_multi(db=db, skip=skip, limit=limit)


@router.get("/{obj_id}", response_model=OrganizationUnitRead)
def get_organization_unit(
    obj_id: int,
    db: Session = Depends(get_db),
):
    """Get an organization unit by ID."""
    obj = CRUDOrganizationUnit.get_by_id(db=db, obj_id=obj_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization unit not found",
        )
    return obj


@router.patch("/{obj_id}", response_model=OrganizationUnitRead)
def update_organization_unit(
    obj_id: int,
    data: OrganizationUnitUpdate,
    db: Session = Depends(get_db),
):
    """Update an organization unit."""
    db_obj = CRUDOrganizationUnit.get_by_id(db=db, obj_id=obj_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization unit not found",
        )
    return CRUDOrganizationUnit.update(db=db, db_obj=db_obj, data=data)
