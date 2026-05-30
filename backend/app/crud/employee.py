from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate


class CRUDEmployee:
    """CRUD operations for Employee."""

    @staticmethod
    def create(db: Session, data: EmployeeCreate) -> Employee:
        obj = Employee(**data.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get_by_id(db: Session, obj_id: int) -> Employee | None:
        return db.get(Employee, obj_id)

    @staticmethod
    def get_multi(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Employee]:
        return (
            db.query(Employee)
            .order_by(Employee.id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        db_obj: Employee,
        data: EmployeeUpdate,
    ) -> Employee:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj
