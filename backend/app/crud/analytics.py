from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import EventType, PlanItemType, PlanStatus
from app.models.event_log import EventLog
from app.models.plan_item import PlanItem


class CRUDAnalytics:
    """Analytics queries for plan-fact analysis."""

    @staticmethod
    def get_plan_fact(
        db: Session,
        *,
        type: PlanItemType | None = None,
        employee_id: int | None = None,
        organization_unit_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[dict]:
        """Return plan-fact data with reschedule counts for matching plan items."""
        reschedule_subq = (
            select(func.count(EventLog.id))
            .where(
                EventLog.entity_id == PlanItem.id,
                EventLog.entity_type == "plan_item",
                EventLog.event_type == EventType.DEADLINE_CHANGED,
            )
            .correlate(PlanItem)
            .scalar_subquery()
        )

        query = db.query(
            PlanItem,
            reschedule_subq.label("reschedule_count"),
        )

        if type is not None:
            query = query.filter(PlanItem.type == type)
        if employee_id is not None:
            query = query.filter(PlanItem.responsible_employee_id == employee_id)
        if organization_unit_id is not None:
            query = query.filter(PlanItem.organization_unit_id == organization_unit_id)
        if date_from is not None:
            query = query.filter(PlanItem.current_end_date >= date_from)
        if date_to is not None:
            query = query.filter(PlanItem.current_end_date <= date_to)

        rows = query.order_by(PlanItem.id).all()

        result: list[dict] = []
        for plan_item, reschedule_count in rows:
            end_date_deviation: int | None = None
            if plan_item.current_end_date is not None and plan_item.original_end_date is not None:
                end_date_deviation = (plan_item.current_end_date - plan_item.original_end_date).days

            actual_deviation: int | None = None
            if plan_item.actual_end_date is not None and plan_item.original_end_date is not None:
                actual_deviation = (plan_item.actual_end_date - plan_item.original_end_date).days

            result.append({
                "plan_item_id": plan_item.id,
                "title": plan_item.title,
                "type": plan_item.type,
                "status": plan_item.status,
                "responsible_employee_id": plan_item.responsible_employee_id,
                "organization_unit_id": plan_item.organization_unit_id,
                "original_start_date": plan_item.original_start_date,
                "original_end_date": plan_item.original_end_date,
                "current_start_date": plan_item.current_start_date,
                "current_end_date": plan_item.current_end_date,
                "actual_start_date": plan_item.actual_start_date,
                "actual_end_date": plan_item.actual_end_date,
                "end_date_deviation_days": end_date_deviation,
                "actual_deviation_days": actual_deviation,
                "reschedule_count": reschedule_count,
            })

        return result

    @staticmethod
    def get_employee_summary(
        db: Session,
        employee_id: int,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        type: PlanItemType | None = None,
    ) -> dict:
        """Return summary statistics for a given employee."""
        query = db.query(PlanItem).filter(
            PlanItem.responsible_employee_id == employee_id,
        )

        if type is not None:
            query = query.filter(PlanItem.type == type)
        if date_from is not None:
            query = query.filter(PlanItem.current_end_date >= date_from)
        if date_to is not None:
            query = query.filter(PlanItem.current_end_date <= date_to)

        plan_items: list[PlanItem] = query.all()
        total = len(plan_items)

        # by_status
        by_status: dict[str, int] = {}
        for item in plan_items:
            key = item.status.value
            by_status[key] = by_status.get(key, 0) + 1

        # avg_deviation_days (только по завершённым)
        completed_items = [p for p in plan_items if p.status == PlanStatus.COMPLETED]
        deviations: list[int] = []
        for p in completed_items:
            if p.actual_end_date is not None and p.original_end_date is not None:
                deviations.append((p.actual_end_date - p.original_end_date).days)
        avg_deviation = round(sum(deviations) / len(deviations), 2) if deviations else None

        # total_reschedules
        total_reschedules = (
            db.query(func.count(EventLog.id))
            .filter(
                EventLog.entity_type == "plan_item",
                EventLog.entity_id.in_([p.id for p in plan_items]) if plan_items else [-1],
                EventLog.event_type == EventType.DEADLINE_CHANGED,
            )
            .scalar()
        ) or 0

        return {
            "employee_id": employee_id,
            "total_plans": total,
            "by_status": by_status,
            "avg_deviation_days": avg_deviation,
            "total_reschedules": total_reschedules,
        }

    @staticmethod
    def get_org_unit_summary(
        db: Session,
        unit_id: int,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        type: PlanItemType | None = None,
    ) -> dict:
        """Return summary statistics for a given organization unit."""
        query = db.query(PlanItem).filter(
            PlanItem.organization_unit_id == unit_id,
        )

        if type is not None:
            query = query.filter(PlanItem.type == type)
        if date_from is not None:
            query = query.filter(PlanItem.current_end_date >= date_from)
        if date_to is not None:
            query = query.filter(PlanItem.current_end_date <= date_to)

        plan_items: list[PlanItem] = query.all()
        total = len(plan_items)

        # by_status
        by_status: dict[str, int] = {}
        for item in plan_items:
            key = item.status.value
            by_status[key] = by_status.get(key, 0) + 1

        # avg_deviation_days (только по завершённым)
        completed_items = [p for p in plan_items if p.status == PlanStatus.COMPLETED]
        deviations: list[int] = []
        for p in completed_items:
            if p.actual_end_date is not None and p.original_end_date is not None:
                deviations.append((p.actual_end_date - p.original_end_date).days)
        avg_deviation = round(sum(deviations) / len(deviations), 2) if deviations else None

        # total_reschedules
        total_reschedules = (
            db.query(func.count(EventLog.id))
            .filter(
                EventLog.entity_type == "plan_item",
                EventLog.entity_id.in_([p.id for p in plan_items]) if plan_items else [-1],
                EventLog.event_type == EventType.DEADLINE_CHANGED,
            )
            .scalar()
        ) or 0

        # employees_count — кол-во уникальных сотрудников, у которых есть планы
        employees_count = (
            db.query(func.count(func.distinct(PlanItem.responsible_employee_id)))
            .filter(
                PlanItem.organization_unit_id == unit_id,
                PlanItem.responsible_employee_id.isnot(None),
            )
        )
        if type is not None:
            employees_count = employees_count.filter(PlanItem.type == type)
        if date_from is not None:
            employees_count = employees_count.filter(PlanItem.current_end_date >= date_from)
        if date_to is not None:
            employees_count = employees_count.filter(PlanItem.current_end_date <= date_to)

        emp_count_val: int = employees_count.scalar() or 0

        return {
            "organization_unit_id": unit_id,
            "total_plans": total,
            "by_status": by_status,
            "avg_deviation_days": avg_deviation,
            "total_reschedules": total_reschedules,
            "employees_count": emp_count_val,
        }