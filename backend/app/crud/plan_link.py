from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.event_log import EventLog
from app.models.plan_item import PlanItem
from app.models.plan_link import PlanLink
from app.models.enums import EventType, PlanLinkType
from app.schemas.plan_link import PlanLinkCreate, PlanLinkUpdate


def _create_event_log(
    db: Session,
    *,
    event_type: EventType,
    link_id: int,
    actor_id: int | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> EventLog:
    """Create an EventLog entry for a PlanLink change."""
    log = EventLog(
        event_type=event_type,
        entity_type="plan_link",
        entity_id=link_id,
        actor_id=actor_id,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(log)
    db.flush()
    return log


class CRUDPlanLink:
    """CRUD operations for PlanLink with automatic EventLog creation."""

    @staticmethod
    def create(db: Session, data: PlanLinkCreate) -> PlanLink:
        """Create a link between two plan items."""
        obj = PlanLink(
            source_plan_item_id=data.source_plan_item_id,
            target_plan_item_id=data.target_plan_item_id,
            link_type=data.link_type,
        )
        db.add(obj)
        db.flush()

        _create_event_log(
            db,
            event_type=EventType.LINK_CREATED,
            link_id=obj.id,
            actor_id=data.actor_id,
            new_value={
                "source_plan_item_id": obj.source_plan_item_id,
                "target_plan_item_id": obj.target_plan_item_id,
                "link_type": obj.link_type.value,
            },
        )

        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get_by_id(db: Session, link_id: int) -> PlanLink | None:
        """Get a link by ID."""
        return db.get(PlanLink, link_id)

    @staticmethod
    def get_multi(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        source_plan_item_id: int | None = None,
        target_plan_item_id: int | None = None,
        link_type: PlanLinkType | None = None,
        is_active: bool | None = None,
    ) -> list[PlanLink]:
        """List links with optional filters."""
        query = db.query(PlanLink)

        if source_plan_item_id is not None:
            query = query.filter(PlanLink.source_plan_item_id == source_plan_item_id)
        if target_plan_item_id is not None:
            query = query.filter(PlanLink.target_plan_item_id == target_plan_item_id)
        if link_type is not None:
            query = query.filter(PlanLink.link_type == link_type)
        if is_active is not None:
            query = query.filter(PlanLink.is_active == is_active)

        return (
            query
            .order_by(PlanLink.id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        db_obj: PlanLink,
        data: PlanLinkUpdate,
        *,
        actor_id: int | None = None,
    ) -> PlanLink:
        """Update a link (link_type, is_active). Creates EventLog on is_active toggle."""
        update_data = data.model_dump(exclude_unset=True)

        # Detect is_active toggle
        if "is_active" in update_data:
            old_active = db_obj.is_active
            new_active = update_data["is_active"]
            if old_active != new_active:
                if new_active:
                    event_type = EventType.LINK_ACTIVATED
                else:
                    event_type = EventType.LINK_DEACTIVATED

                _create_event_log(
                    db,
                    event_type=event_type,
                    link_id=db_obj.id,
                    actor_id=actor_id,
                    old_value={"is_active": old_active},
                    new_value={"is_active": new_active},
                )

        # Apply updates
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def soft_delete(
        db: Session,
        db_obj: PlanLink,
        *,
        actor_id: int | None = None,
    ) -> PlanLink:
        """Soft delete a link: set is_active=False + EventLog LINK_DEACTIVATED."""
        if not db_obj.is_active:
            # Already inactive — just return
            return db_obj

        old_active = db_obj.is_active
        db_obj.is_active = False

        db.flush()

        _create_event_log(
            db,
            event_type=EventType.LINK_DEACTIVATED,
            link_id=db_obj.id,
            actor_id=actor_id,
            old_value={
                "is_active": old_active,
                "source_plan_item_id": db_obj.source_plan_item_id,
                "target_plan_item_id": db_obj.target_plan_item_id,
                "link_type": db_obj.link_type.value,
            },
            new_value={"is_active": False},
        )

        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def activate(
        db: Session,
        db_obj: PlanLink,
        *,
        actor_id: int | None = None,
    ) -> PlanLink:
        """Reactivate a link: set is_active=True + EventLog LINK_ACTIVATED."""
        if db_obj.is_active:
            return db_obj

        db_obj.is_active = True

        db.flush()

        _create_event_log(
            db,
            event_type=EventType.LINK_ACTIVATED,
            link_id=db_obj.id,
            actor_id=actor_id,
            old_value={"is_active": False},
            new_value={"is_active": True},
        )

        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def get_plan_item_links(
        db: Session,
        plan_item_id: int,
    ) -> tuple[list[PlanLink], list[PlanLink]]:
        """Get all links for a PlanItem. Returns (outgoing_links, incoming_links)."""
        outgoing = (
            db.query(PlanLink)
            .filter(PlanLink.source_plan_item_id == plan_item_id)
            .order_by(PlanLink.id)
            .all()
        )
        incoming = (
            db.query(PlanLink)
            .filter(PlanLink.target_plan_item_id == plan_item_id)
            .order_by(PlanLink.id)
            .all()
        )
        return outgoing, incoming
