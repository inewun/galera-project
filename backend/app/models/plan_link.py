from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import PlanLinkType

if TYPE_CHECKING:
    from app.models.plan_item import PlanItem


class PlanLink(Base):
    __tablename__ = "plan_link"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    source_plan_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("plan_item.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    target_plan_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("plan_item.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    link_type: Mapped[PlanLinkType] = mapped_column(
        sa.Enum(PlanLinkType, name="plan_link_type"),
        default=PlanLinkType.PARENT_CHILD,
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # Relationships
    source_plan_item: Mapped["PlanItem | None"] = relationship(
        back_populates="source_links",
        foreign_keys=[source_plan_item_id],
    )
    target_plan_item: Mapped["PlanItem | None"] = relationship(
        back_populates="target_links",
        foreign_keys=[target_plan_item_id],
    )

    __table_args__ = (
        sa.UniqueConstraint(
            "source_plan_item_id",
            "target_plan_item_id",
            "link_type",
            name="uq_plan_link_source_target_type",
        ),
        sa.Index(
            "ix_plan_link_is_active",
            "is_active",
            postgresql_where=sa.text("is_active = true"),
        ),
        sa.Index(
            "ix_plan_link_source_type",
            "source_plan_item_id",
            "link_type",
        ),
        sa.Index(
            "ix_plan_link_target_type",
            "target_plan_item_id",
            "link_type",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<PlanLink(id={self.id}, source={self.source_plan_item_id}, "
            f"target={self.target_plan_item_id}, "
            f"link_type='{self.link_type}', is_active={self.is_active})>"
        )
