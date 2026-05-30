import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApprovals, approveApproval, rejectApproval } from '../api/approvals'

export function useApprovals() {
  const queryClient = useQueryClient()

  const { data: approvals = [], isLoading, isError } = useQuery({
    queryKey: ['approvals'],
    queryFn: getApprovals,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { reviewed_by_id?: number; review_comment?: string } }) =>
      approveApproval(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { reviewed_by_id?: number; review_comment?: string } }) =>
      rejectApproval(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
  })

  const approve = async (id: number, data: { review_comment?: string }) => {
    await approveMutation.mutateAsync({ id, data })
  }

  const reject = async (id: number, data: { review_comment?: string }) => {
    await rejectMutation.mutateAsync({ id, data })
  }

  return {
    approvals,
    isLoading,
    isError,
    approve,
    reject,
    isActing: approveMutation.isPending || rejectMutation.isPending,
  }
}
