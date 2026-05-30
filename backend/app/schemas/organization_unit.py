from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrganizationLevel


class OrganizationUnitBase(BaseModel):
    name: str = Field(..., max_length=255)
    parent_id: int | None = None
    level: OrganizationLevel
    is_active: bool = True


class OrganizationUnitCreate(OrganizationUnitBase):
    pass


class OrganizationUnitUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    parent_id: int | None = None
    level: OrganizationLevel | None = None
    is_active: bool | None = None


class OrganizationUnitRead(OrganizationUnitBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
