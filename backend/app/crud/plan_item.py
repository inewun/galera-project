from datetime import date

from sqlalchemy.orm import Session

from app.crud.utils import create_event_log
from app.models.enums import EventType, PlanItemType, PlanStatus
from app.models.plan_item import PlanItem
from app.schemas.plan_item import PlanItemCreate, PlanItemReschedule, PlanItemUpdate


class CRUDPlanItem:
    """CRUD operations for PlanItem with automatic EventLog creation."""

    @staticmethod
    def create(db: Session, data: PlanItemCreate) -> PlanItem:
        obj = PlanItem(**data.model_dump())
        db.add(obj)
        db.flush()

        # Auto-create EventLog: PLAN_CREATED
        create_event_log(
            db,
            event_type=EventType.PLAN_CREATED,
            plan_item_id=obj.id,
            new_value={
                "type": obj.type.value,
                "title": obj.title,
                "status": obj.status.value,
            },
        )

        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get_by_id(db: Session, obj_id: int) -> PlanItem | None:
        return db.get(PlanItem, obj_id)

    @staticmethod
    def get_multi(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        type: PlanItemType | None = None,
        status: PlanStatus | None = None,
        employee_id: int | None = None,
        organization_unit_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[PlanItem]:
        query = db.query(PlanItem)

        if type is not None:
            query = query.filter(PlanItem.type == type)
        if status is not None:
            query = query.filter(PlanItem.status == status)
        if employee_id is not None:
            query = query.filter(PlanItem.responsible_employee_id == employee_id)
        if organization_unit_id is not None:
            query = query.filter(PlanItem.organization_unit_id == organization_unit_id)
        if date_from is not None:
            query = query.filter(PlanItem.current_end_date >= date_from)
        if date_to is not None:
            query = query.filter(PlanItem.current_end_date <= date_to)

        return (
            query
            .order_by(PlanItem.id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        db_obj: PlanItem,
        data: PlanItemUpdate,
    ) -> PlanItem:
        update_data = data.model_dump(exclude_unset=True)
        old_values: dict = {}
        new_values: dict = {}

        status_changed = False
        deadline_changed = False

        # Detect status change
        if "status" in update_data and update_data["status"] != db_obj.status:
            old_values["status"] = db_obj.status.value
            new_values["status"] = update_data["status"].value
            status_changed = True

        # Detect deadline changes (current_start_date / current_end_date)
        for date_field in ("current_start_date", "current_end_date"):
            if date_field in update_data:
                old_val = getattr(db_obj, date_field)
                new_val = update_data[date_field]
                if old_val != new_val:
                    old_values[date_field] = str(old_val) if old_val else None
                    new_values[date_field] = str(new_val) if new_val else None
                    deadline_changed = True

        # Apply updates
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.flush()

        # Auto-create EventLog entries
        if status_changed:
            create_event_log(
                db,
                event_type=EventType.STATUS_CHANGED,
                plan_item_id=db_obj.id,
                old_value={"status": old_values.get("status")},
                new_value={"status": new_values.get("status")},
            )

        if deadline_changed:
            create_event_log(
                db,
                event_type=EventType.DEADLINE_CHANGED,
                plan_item_id=db_obj.id,
                old_value={
                    k: v for k, v in old_values.items()
                    if k in ("current_start_date", "current_end_date")
                },
                new_value={
                    k: v for k, v in new_values.items()
                    if k in ("current_start_date", "current_end_date")
                },
            )

        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def reschedule(
        db: Session,
        db_obj: PlanItem,
        data: PlanItemReschedule,
    ) -> PlanItem:
        """Reschedule a plan item with a mandatory reason."""
        old_values: dict = {}
        new_values: dict = {}

        # Save old dates
        if data.new_start_date is not None:
            old_values["current_start_date"] = (
                str(db_obj.current_start_date) if db_obj.current_start_date else None
            )
            db_obj.current_start_date = data.new_start_date
            new_values["current_start_date"] = str(data.new_start_date)

        if data.new_end_date is not None:
            old_values["current_end_date"] = (
                str(db_obj.current_end_date) if db_obj.current_end_date else None
            )
            db_obj.current_end_date = data.new_end_date
            new_values["current_end_date"] = str(data.new_end_date)

        db.flush()

        # Create EventLog with reason
        create_event_log(
            db,
            event_type=EventType.DEADLINE_CHANGED,
            plan_item_id=db_obj.id,
            actor_id=data.actor_id,
            reason=data.reason,
            old_value=old_values if old_values else None,
            new_value=new_values if new_values else None,
        )

        db.commit()
        db.refresh(db_obj)
        return db_obj
