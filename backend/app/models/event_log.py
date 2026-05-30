from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import EventType


class EventLog(Base):
    __tablename__ = "event_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    event_type: Mapped[EventType] = mapped_column(
        sa.Enum(EventType, name="event_type"),
        nullable=False,
        index=True,
    )

    # === Универсальная ссылка на любую сущность ===
    entity_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True,
    )
    entity_id: Mapped[int | None] = mapped_column(
        sa.Integer, nullable=True, index=True,
    )

    # === Автор действия ===
    actor_id: Mapped[int | None] = mapped_column(
        sa.Integer, nullable=True, index=True,
    )

    # === Значения ===
    old_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True,
    )

    __table_args__ = (
        sa.Index("ix_event_log_entity", "entity_type", "entity_id", "created_at"),
        sa.Index("ix_event_log_actor_created", "actor_id", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<EventLog(id={self.id}, event_type='{self.event_type}', "
            f"entity_type='{self.entity_type}', entity_id={self.entity_id})>"
        )
