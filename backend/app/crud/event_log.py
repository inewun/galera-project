from sqlalchemy.orm import Session

from app.models.event_log import EventLog


class CRUDEventLog:
    """Read-only CRUD operations for EventLog."""

    @staticmethod
    def get_by_id(db: Session, obj_id: int) -> EventLog | None:
        return db.get(EventLog, obj_id)

    @staticmethod
    def get_multi(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[EventLog]:
        return (
            db.query(EventLog)
            .order_by(EventLog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
