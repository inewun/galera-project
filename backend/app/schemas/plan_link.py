from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PlanLinkType


class PlanLinkBase(BaseModel):
    source_plan_item_id: int
    target_plan_item_id: int
    link_type: PlanLinkType = PlanLinkType.PARENT_CHILD


class PlanLinkCreate(PlanLinkBase):
    actor_id: int | None = None


class PlanLinkUpdate(BaseModel):
    link_type: PlanLinkType | None = None
    is_active: bool | None = None


class PlanLinkRead(PlanLinkBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PlanLinkItemInfo(BaseModel):
    """Краткая информация о связи для PlanItemLinksRead."""
    id: int
    target_plan_item_id: int | None = None
    link_type: PlanLinkType
    is_active: bool


class PlanLinkIncomingInfo(BaseModel):
    """Входящая связь для PlanItemLinksRead."""
    id: int
    source_plan_item_id: int | None = None
    link_type: PlanLinkType
    is_active: bool


class PlanItemLinksRead(BaseModel):
    """Все связи PlanItem: исходящие и входящие."""
    plan_item_id: int
    outgoing_links: list[PlanLinkItemInfo] = Field(default_factory=list)
    incoming_links: list[PlanLinkIncomingInfo] = Field(default_factory=list)
