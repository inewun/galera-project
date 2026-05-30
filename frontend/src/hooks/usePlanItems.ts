import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlanItems, createPlanItem, reschedulePlanItem } from '../api/planItems'
import type { PlanItem, PlanItemType, PlanStatus } from '../types'

export interface PlanItemFilters {
  type?: PlanItemType
  status?: PlanStatus
  date_from?: string
  date_to?: string
}

export function usePlanItems(filters: PlanItemFilters = {}) {
  const queryClient = useQueryClient()

  const query = useQuery<PlanItem[]>({
    queryKey: ['plan-items', filters],
    queryFn: () => getPlanItems(filters),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<PlanItem>) => createPlanItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-items'] })
    },
  })

  const rescheduleMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: { new_end_date?: string; reason: string }
    }) => reschedulePlanItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-items'] })
    },
  })

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createPlanItem: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    reschedulePlanItem: rescheduleMutation.mutateAsync,
    isRescheduling: rescheduleMutation.isPending,
  }
}
