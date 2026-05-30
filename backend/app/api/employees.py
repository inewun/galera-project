from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud.employee import CRUDEmployee
from app.db.session import get_db
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeRead,
    EmployeeUpdate,
)

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
):
    """Create a new employee."""
    return CRUDEmployee.create(db=db, data=data)


@router.get("/", response_model=list[EmployeeRead])
def list_employees(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List employees with pagination."""
    return CRUDEmployee.get_multi(db=db, skip=skip, limit=limit)


@router.get("/{obj_id}", response_model=EmployeeRead)
def get_employee(
    obj_id: int,
    db: Session = Depends(get_db),
):
    """Get an employee by ID."""
    obj = CRUDEmployee.get_by_id(db=db, obj_id=obj_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return obj


@router.patch("/{obj_id}", response_model=EmployeeRead)
def update_employee(
    obj_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
):
    """Update an employee."""
    db_obj = CRUDEmployee.get_by_id(db=db, obj_id=obj_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return CRUDEmployee.update(db=db, db_obj=db_obj, data=data)
