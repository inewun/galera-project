from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import EventType


class EventLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: EventType
    entity_type: str | None
    entity_id: int | None
    actor_id: int | None
    old_value: dict | None
    new_value: dict | None
    reason: str | None
    created_at: datetime
