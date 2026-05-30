from sqlalchemy.orm import Session

from app.models.organization_unit import OrganizationUnit
from app.schemas.organization_unit import OrganizationUnitCreate, OrganizationUnitUpdate


class CRUDOrganizationUnit:
    """CRUD operations for OrganizationUnit."""

    @staticmethod
    def create(db: Session, data: OrganizationUnitCreate) -> OrganizationUnit:
        obj = OrganizationUnit(**data.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get_by_id(db: Session, obj_id: int) -> OrganizationUnit | None:
        return db.get(OrganizationUnit, obj_id)

    @staticmethod
    def get_multi(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[OrganizationUnit]:
        return (
            db.query(OrganizationUnit)
            .order_by(OrganizationUnit.id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        db_obj: OrganizationUnit,
        data: OrganizationUnitUpdate,
    ) -> OrganizationUnit:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj
