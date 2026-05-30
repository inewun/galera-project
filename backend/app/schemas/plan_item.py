from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PlanItemType, PlanStatus


class PlanItemBase(BaseModel):
    type: PlanItemType
    title: str = Field(..., max_length=255)
    description: str | None = None
    responsible_employee_id: int | None = None
    organization_unit_id: int | None = None
    original_start_date: date | None = None
    original_end_date: date | None = None
    current_start_date: date | None = None
    current_end_date: date | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None


class PlanItemCreate(PlanItemBase):
    pass


class PlanItemUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    status: PlanStatus | None = None
    responsible_employee_id: int | None = None
    organization_unit_id: int | None = None
    current_start_date: date | None = None
    current_end_date: date | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None


class PlanItemReschedule(BaseModel):
    new_start_date: date | None = None
    new_end_date: date | None = None
    reason: str = Field(..., min_length=1, max_length=1000)
    actor_id: int | None = None


class PlanItemRead(PlanItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: PlanStatus
    is_archived: bool
    created_at: datetime
    updated_at: datetime
