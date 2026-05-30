import { useQuery } from '@tanstack/react-query'
import { getPlanFact } from '../api/analytics'
import type { PlanItemType } from '../types'

interface Filters {
  type?: PlanItemType
  employee_id?: number
  organization_unit_id?: number
  date_from?: string
  date_to?: string
}

export function useAnalytics(filters: Filters = {}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'plan-fact', filters],
    queryFn: () => getPlanFact(filters),
  })

  return {
    total: data?.total ?? 0,
    items: data?.items ?? [],
    isLoading,
    isError,
  }
}