import { apiClient } from './client'
import type { PlanFactItem } from '../types'

export const getPlanFact = (params?: {
  type?: string
  employee_id?: number
  organization_unit_id?: number
  date_from?: string
  date_to?: string
}) => apiClient.get<{ total: number; items: PlanFactItem[] }>(
  '/analytics/plan-fact/', { params }
).then(r => r.data)