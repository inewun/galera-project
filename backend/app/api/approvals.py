from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud.approval import CRUDApproval
from app.crud.plan_item import CRUDPlanItem
from app.db.session import get_db
from app.schemas.approval import ApprovalCreate, ApprovalRead, ApprovalReview

router = APIRouter(tags=["Approvals"])


@router.get("/approvals/", response_model=list[ApprovalRead])
def list_approvals(
    db: Session = Depends(get_db),
):
    """Get all approval requests."""
    return CRUDApproval.get_multi(db=db)


@router.post("/approvals/", response_model=ApprovalRead, status_code=status.HTTP_201_CREATED)
def create_approval(
    data: ApprovalCreate,
    db: Session = Depends(get_db),
):
    """Create a new approval request for a plan item reschedule."""
    # Verify the plan item exists
    plan_item = CRUDPlanItem.get_by_id(db=db, obj_id=data.plan_item_id)
    if not plan_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan item not found",
        )
    return CRUDApproval.create(db=db, data=data)


@router.get("/approvals/{approval_id}/", response_model=ApprovalRead)
def get_approval(
    approval_id: int,
    db: Session = Depends(get_db),
):
    """Get an approval request by ID."""
    obj = CRUDApproval.get_by_id(db=db, approval_id=approval_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found",
        )
    return obj


@router.post("/approvals/{approval_id}/approve/", response_model=ApprovalRead)
def approve_approval(
    approval_id: int,
    data: ApprovalReview,
    db: Session = Depends(get_db),
):
    """Approve an approval request and apply new dates to the plan item."""
    obj = CRUDApproval.get_by_id(db=db, approval_id=approval_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found",
        )
    if obj.status.value != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Approval is already {obj.status.value}",
        )
    return CRUDApproval.approve(db=db, db_obj=obj, data=data)


@router.post("/approvals/{approval_id}/reject/", response_model=ApprovalRead)
def reject_approval(
    approval_id: int,
    data: ApprovalReview,
    db: Session = Depends(get_db),
):
    """Reject an approval request."""
    obj = CRUDApproval.get_by_id(db=db, approval_id=approval_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found",
        )
    if obj.status.value != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Approval is already {obj.status.value}",
        )
    return CRUDApproval.reject(db=db, db_obj=obj, data=data)


@router.get("/plan-items/{plan_item_id}/approvals/", response_model=list[ApprovalRead])
def get_plan_item_approvals(
    plan_item_id: int,
    db: Session = Depends(get_db),
):
    """Get all approval requests for a plan item."""
    # Verify the plan item exists
    plan_item = CRUDPlanItem.get_by_id(db=db, obj_id=plan_item_id)
    if not plan_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan item not found",
        )
    return CRUDApproval.get_by_plan_item(db=db, plan_item_id=plan_item_id)