import { useState } from 'react'
import { useApprovals } from '../hooks/useApprovals'
import ApprovalCard from '../components/ApprovalCard'
import type { ApprovalStatus } from '../types'

type StatusFilter = ApprovalStatus | 'all'

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'approved', label: 'Согласованы' },
  { value: 'rejected', label: 'Отклонены' },
]

export default function ApprovalsPage() {
  const { approvals, isLoading, isError, approve, reject, isActing } = useApprovals()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const pendingCount = approvals.filter((a) => a.status === 'pending').length

  const filteredApprovals =
    statusFilter === 'all'
      ? approvals
      : approvals.filter((a) => a.status === statusFilter)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        Согласования
        {pendingCount > 0 && (
          <span className="ml-2 text-lg font-normal text-yellow-600">
            ({pendingCount} {pendingCount === 1 ? 'ожидает' : 'ожидают'})
          </span>
        )}
      </h1>

      {/* Filter */}
      <div className="mb-6 flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setStatusFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="py-12 text-center text-gray-500">Загрузка...</div>
      )}

      {isError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Ошибка загрузки согласований. Попробуйте обновить страницу.
        </div>
      )}

      {!isLoading && !isError && filteredApprovals.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          Нет запросов на согласование
        </div>
      )}

      {!isLoading && !isError && filteredApprovals.length > 0 && (
        <div className="space-y-4">
          {filteredApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={approve}
              onReject={reject}
              isActing={isActing}
            />
          ))}
        </div>
      )}
    </div>
  )
}
