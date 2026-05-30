import { apiClient } from './client'
import type { PlanItem } from '../types'

export const getPlanItems = (params?: {
  type?: string
  status?: string
  employee_id?: number
  organization_unit_id?: number
  date_from?: string
  date_to?: string
}) => apiClient.get<PlanItem[]>('/plan-items/', { params }).then(r => r.data)

export const getPlanItem = (id: number) =>
  apiClient.get<PlanItem>(`/plan-items/${id}/`).then(r => r.data)

export const createPlanItem = (data: Partial<PlanItem>) =>
  apiClient.post<PlanItem>('/plan-items/', data).then(r => r.data)

export const updatePlanItem = (id: number, data: Partial<PlanItem>) =>
  apiClient.patch<PlanItem>(`/plan-items/${id}/`, data).then(r => r.data)

export const reschedulePlanItem = (id: number, data: {
  new_end_date?: string
  new_start_date?: string
  reason: string
  actor_id?: number
}) => apiClient.post<PlanItem>(`/plan-items/${id}/reschedule/`, data).then(r => r.data)