export type PlanItemType = 'month' | 'week' | 'day'
export type PlanStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface PlanItem {
  id: number
  type: PlanItemType
  title: string
  description: string | null
  status: PlanStatus
  responsible_employee_id: number | null
  organization_unit_id: number | null
  original_start_date: string | null
  original_end_date: string | null
  current_start_date: string | null
  current_end_date: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Employee {
  id: number
  full_name: string
  email: string | null
  organization_unit_id: number
  role: 'manager' | 'member'
  is_active: boolean
}

export interface OrganizationUnit {
  id: number
  name: string
  parent_id: number | null
  level: 'department' | 'team'
  is_active: boolean
}

export interface Approval {
  id: number
  plan_item_id: number
  requested_by_id: number | null
  reviewed_by_id: number | null
  status: ApprovalStatus
  reason: string | null
  review_comment: string | null
  new_start_date: string | null
  new_end_date: string | null
  created_at: string
  updated_at: string
}

export interface PlanFactItem {
  plan_item_id: number
  title: string
  type: PlanItemType
  status: PlanStatus
  responsible_employee_id: number | null
  organization_unit_id: number | null
  original_end_date: string | null
  current_end_date: string | null
  actual_end_date: string | null
  end_date_deviation_days: number | null
  actual_deviation_days: number | null
  reschedule_count: number
}