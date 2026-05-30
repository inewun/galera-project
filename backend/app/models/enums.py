import enum


class OrganizationLevel(str, enum.Enum):
    DEPARTMENT = "department"
    TEAM = "team"


class EmployeeRole(str, enum.Enum):
    MANAGER = "manager"
    MEMBER = "member"


class PlanItemType(str, enum.Enum):
    MONTH = "month"
    WEEK = "week"
    DAY = "day"


class PlanStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PlanLinkType(str, enum.Enum):
    PARENT_CHILD = "parent_child"
    RELATED = "related"
    DEPENDS_ON = "depends_on"  # future
    BLOCKS = "blocks"          # future


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EventType(str, enum.Enum):
    PLAN_CREATED = "plan_created"
    DEADLINE_CHANGED = "deadline_changed"
    STATUS_CHANGED = "status_changed"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_APPROVED = "approval_approved"
    APPROVAL_REJECTED = "approval_rejected"
    EXTERNAL_LINK_ADDED = "external_link_added"
    EXTERNAL_LINK_REMOVED = "external_link_removed"
    PLAN_ITEM_DELETED = "plan_item_deleted"
    LINK_CREATED = "link_created"
    LINK_DEACTIVATED = "link_deactivated"
    LINK_ACTIVATED = "link_activated"
    LINK_DELETED = "link_deleted"
