from sqlalchemy.orm import Session

from app.models.enums import EventType
from app.models.event_log import EventLog


def create_event_log(
    db: Session,
    *,
    event_type: EventType,
    plan_item_id: int,
    actor_id: int | None = None,
    reason: str | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> EventLog:
    """Create an EventLog entry for a PlanItem change."""
    log = EventLog(
        event_type=event_type,
        entity_type="plan_item",
        entity_id=plan_item_id,
        actor_id=actor_id,
        reason=reason,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(log)
    db.flush()
    return log