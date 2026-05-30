from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import PlanItemType, PlanStatus


class PlanFactItem(BaseModel):
    plan_item_id: int
    title: str
    type: PlanItemType
    status: PlanStatus
    responsible_employee_id: int | None
    organization_unit_id: int | None

    # Плановые даты (исходные)
    original_start_date: date | None
    original_end_date: date | None

    # Текущие (скорректированные) даты
    current_start_date: date | None
    current_end_date: date | None

    # Фактические даты
    actual_start_date: date | None
    actual_end_date: date | None

    # Отклонения в днях (None если нет данных)
    end_date_deviation_days: int | None
    actual_deviation_days: int | None

    # Кол-во переносов дедлайна
    reschedule_count: int


class PlanFactResponse(BaseModel):
    total: int
    items: list[PlanFactItem]


class EmployeeSummary(BaseModel):
    employee_id: int
    total_plans: int
    by_status: dict[str, int]
    avg_deviation_days: float | None
    total_reschedules: int


class OrgUnitSummary(BaseModel):
    organization_unit_id: int
    total_plans: int
    by_status: dict[str, int]
    avg_deviation_days: float | None
    total_reschedules: int
    employees_count: int