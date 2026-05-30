from sqlalchemy.orm import Session

from app.crud.plan_item import CRUDPlanItem
from app.crud.utils import create_event_log
from app.models.approval import Approval
from app.models.enums import ApprovalStatus, EventType
from app.schemas.approval import ApprovalCreate, ApprovalReview


class CRUDApproval:
    """CRUD operations for Approval with automatic EventLog creation."""

    @staticmethod
    def create(db: Session, data: ApprovalCreate) -> Approval:
        obj = Approval(
            plan_item_id=data.plan_item_id,
            requested_by_id=data.requested_by_id,
            reason=data.reason,
            new_start_date=data.new_start_date,
            new_end_date=data.new_end_date,
            status=ApprovalStatus.PENDING,
        )
        db.add(obj)
        db.flush()

        create_event_log(
            db,
            event_type=EventType.APPROVAL_REQUESTED,
            plan_item_id=data.plan_item_id,
            actor_id=data.requested_by_id,
            reason=data.reason,
            new_value={
                "new_start_date": str(data.new_start_date) if data.new_start_date else None,
                "new_end_date": str(data.new_end_date) if data.new_end_date else None,
            },
        )

        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get_multi(db: Session) -> list[Approval]:
        return db.query(Approval).order_by(Approval.created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, approval_id: int) -> Approval | None:
        return db.get(Approval, approval_id)

    @staticmethod
    def get_by_plan_item(db: Session, plan_item_id: int) -> list[Approval]:
        return (
            db.query(Approval)
            .filter(Approval.plan_item_id == plan_item_id)
            .order_by(Approval.created_at.desc())
            .all()
        )

    @staticmethod
    def approve(db: Session, db_obj: Approval, data: ApprovalReview) -> Approval:
        db_obj.status = ApprovalStatus.APPROVED
        db_obj.reviewed_by_id = data.reviewed_by_id
        db_obj.review_comment = data.review_comment
        db.flush()

        # Apply new dates to the related PlanItem
        plan_item = CRUDPlanItem.get_by_id(db=db, obj_id=db_obj.plan_item_id)
        if plan_item:
            old_values = {}
            new_values = {}
            if db_obj.new_start_date is not None:
                old_values["current_start_date"] = str(plan_item.current_start_date) if plan_item.current_start_date else None
                plan_item.current_start_date = db_obj.new_start_date
                new_values["current_start_date"] = str(db_obj.new_start_date)
            if db_obj.new_end_date is not None:
                old_values["current_end_date"] = str(plan_item.current_end_date) if plan_item.current_end_date else None
                plan_item.current_end_date = db_obj.new_end_date
                new_values["current_end_date"] = str(db_obj.new_end_date)
            db.flush()

        create_event_log(
            db,
            event_type=EventType.APPROVAL_APPROVED,
            plan_item_id=db_obj.plan_item_id,
            actor_id=data.reviewed_by_id,
            reason=db_obj.reason,
            old_value=old_values if old_values else None,
            new_value=new_values if new_values else None,
        )

        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def reject(db: Session, db_obj: Approval, data: ApprovalReview) -> Approval:
        db_obj.status = ApprovalStatus.REJECTED
        db_obj.reviewed_by_id = data.reviewed_by_id
        db_obj.review_comment = data.review_comment
        db.flush()

        create_event_log(
            db,
            event_type=EventType.APPROVAL_REJECTED,
            plan_item_id=db_obj.plan_item_id,
            actor_id=data.reviewed_by_id,
            reason=db_obj.reason,
            new_value={"review_comment": data.review_comment},
        )

        db.commit()
        db.refresh(db_obj)
        return db_obj