from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import OrganizationLevel

if TYPE_CHECKING:
    from app.models.employee import Employee


class OrganizationUnit(Base):
    __tablename__ = "organization_unit"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("organization_unit.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    level: Mapped[OrganizationLevel] = mapped_column(
        sa.Enum(OrganizationLevel, name="organization_level"),
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
    parent: Mapped["OrganizationUnit | None"] = relationship(
        back_populates="children",
        remote_side="OrganizationUnit.id",
    )
    children: Mapped[list["OrganizationUnit"]] = relationship(
        back_populates="parent",
    )
    employees: Mapped[list["Employee"]] = relationship(
        back_populates="organization_unit",
    )

    __table_args__ = (
        sa.Index(
            "ix_organization_unit_is_active",
            "is_active",
            postgresql_where=sa.text("is_active = true"),
        ),
    )

    def __repr__(self) -> str:
        return f"<OrganizationUnit(id={self.id}, name='{self.name}', level='{self.level}')>"
