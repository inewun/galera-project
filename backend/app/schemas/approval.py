from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ApprovalStatus


class ApprovalCreate(BaseModel):
    plan_item_id: int
    requested_by_id: int | None = None
    reason: str = Field(..., min_length=1)
    new_start_date: date | None = None
    new_end_date: date | None = None


class ApprovalReview(BaseModel):
    reviewed_by_id: int | None = None
    review_comment: str | None = None


class ApprovalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plan_item_id: int
    requested_by_id: int | None
    reviewed_by_id: int | None
    status: ApprovalStatus
    reason: str | None
    review_comment: str | None
    new_start_date: date | None
    new_end_date: date | None
    created_at: datetime
    updated_at: datetime