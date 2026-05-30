from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import Date, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ApprovalStatus


class Approval(Base):
    __tablename__ = "approval"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    plan_item_id: Mapped[int] = mapped_column(
        ForeignKey("plan_item.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    requested_by_id: Mapped[int | None] = mapped_column(
        sa.Integer, nullable=True, index=True,
    )
    reviewed_by_id: Mapped[int | None] = mapped_column(
        sa.Integer, nullable=True, index=True,
    )

    status: Mapped[ApprovalStatus] = mapped_column(
        sa.Enum(ApprovalStatus, name="approval_status"),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )

    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    new_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    new_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Approval(id={self.id}, plan_item_id={self.plan_item_id}, "
            f"status='{self.status}')>"
        )