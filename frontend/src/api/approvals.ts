import { apiClient } from './client'
import type { Approval } from '../types'

export const getApprovals = () =>
  apiClient.get<Approval[]>('/approvals/').then(r => r.data)

export const getApproval = (id: number) =>
  apiClient.get<Approval>(`/approvals/${id}/`).then(r => r.data)

export const createApproval = (data: {
  plan_item_id: number
  requested_by_id?: number
  reason: string
  new_start_date?: string
  new_end_date?: string
}) => apiClient.post<Approval>('/approvals/', data).then(r => r.data)

export const approveApproval = (id: number, data: {
  reviewed_by_id?: number
  review_comment?: string
}) => apiClient.post<Approval>(`/approvals/${id}/approve/`, data).then(r => r.data)

export const rejectApproval = (id: number, data: {
  reviewed_by_id?: number
  review_comment?: string
}) => apiClient.post<Approval>(`/approvals/${id}/reject/`, data).then(r => r.data)

export const getPlanItemApprovals = (planItemId: number) =>
  apiClient.get<Approval[]>(`/plan-items/${planItemId}/approvals/`).then(r => r.data)
