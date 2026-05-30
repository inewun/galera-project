from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter()


@router.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    """Check database connectivity.

    Executes a simple test query and returns the database status.
    """
    try:
        db.execute(text("SELECT 1"))
        return {"database": "ok"}
    except Exception as exc:
        return {"database": "error", "detail": str(exc)}
