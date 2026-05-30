from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmployeeRole

if TYPE_CHECKING:
    from app.models.organization_unit import OrganizationUnit
    from app.models.plan_item import PlanItem


class Employee(Base):
    __tablename__ = "employee"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    external_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True,
    )

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True,
    )

    organization_unit_id: Mapped[int] = mapped_column(
        ForeignKey("organization_unit.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    role: Mapped[EmployeeRole] = mapped_column(
        sa.Enum(EmployeeRole, name="employee_role"),
        default=EmployeeRole.MEMBER,
        nullable=False,
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
    organization_unit: Mapped["OrganizationUnit"] = relationship(
        back_populates="employees",
    )
    responsible_plans: Mapped[list["PlanItem"]] = relationship(
        back_populates="responsible_employee",
        foreign_keys="PlanItem.responsible_employee_id",
    )

    __table_args__ = (
        sa.Index(
            "ix_employee_is_active",
            "is_active",
            postgresql_where=sa.text("is_active = true"),
        ),
    )

    def __repr__(self) -> str:
        return f"<Employee(id={self.id}, full_name='{self.full_name}')>"
