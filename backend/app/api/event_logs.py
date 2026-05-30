from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud.event_log import CRUDEventLog
from app.db.session import get_db
from app.schemas.event_log import EventLogRead

router = APIRouter(prefix="/event-logs", tags=["Event Logs"])


@router.get("/", response_model=list[EventLogRead])
def list_event_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List event logs with pagination (read-only)."""
    return CRUDEventLog.get_multi(db=db, skip=skip, limit=limit)


@router.get("/{obj_id}", response_model=EventLogRead)
def get_event_log(
    obj_id: int,
    db: Session = Depends(get_db),
):
    """Get an event log by ID (read-only)."""
    obj = CRUDEventLog.get_by_id(db=db, obj_id=obj_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event log not found",
        )
    return obj
