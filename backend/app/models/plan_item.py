from datetime import date, datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import PlanItemType, PlanStatus

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.organization_unit import OrganizationUnit
    from app.models.plan_link import PlanLink


class PlanItem(Base):
    __tablename__ = "plan_item"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    type: Mapped[PlanItemType] = mapped_column(
        sa.Enum(PlanItemType, name="plan_item_type"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[PlanStatus] = mapped_column(
        sa.Enum(PlanStatus, name="plan_status"),
        default=PlanStatus.DRAFT,
        nullable=False,
        index=True,
    )

    responsible_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    organization_unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("organization_unit.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # === Dates ===
    original_start_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True,
    )
    original_end_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True,
    )
    current_start_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True,
    )
    current_end_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True,
    )
    actual_start_date: Mapped[date | None] = mapped_column(
        Date, nullable=True,
    )
    actual_end_date: Mapped[date | None] = mapped_column(
        Date, nullable=True,
    )

    is_archived: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # Relationships
    responsible_employee: Mapped["Employee | None"] = relationship(
        back_populates="responsible_plans",
        foreign_keys=[responsible_employee_id],
    )
    organization_unit: Mapped["OrganizationUnit | None"] = relationship()

    source_links: Mapped[list["PlanLink"]] = relationship(
        back_populates="source_plan_item",
        foreign_keys="PlanLink.source_plan_item_id",
        viewonly=True,
    )
    target_links: Mapped[list["PlanLink"]] = relationship(
        back_populates="target_plan_item",
        foreign_keys="PlanLink.target_plan_item_id",
        viewonly=True,
    )

    __table_args__ = (
        sa.Index("ix_plan_item_type_status", "type", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<PlanItem(id={self.id}, type='{self.type}', "
            f"title='{self.title}', status='{self.status}')>"
        )
