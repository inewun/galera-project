from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import EmployeeRole


class EmployeeBase(BaseModel):
    external_id: str | None = Field(default=None, max_length=255)
    full_name: str = Field(..., max_length=255)
    email: str | None = Field(default=None, max_length=255)
    organization_unit_id: int
    role: EmployeeRole = EmployeeRole.MEMBER
    is_active: bool = True


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    external_id: str | None = Field(default=None, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    organization_unit_id: int | None = None
    role: EmployeeRole | None = None
    is_active: bool | None = None


class EmployeeRead(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
