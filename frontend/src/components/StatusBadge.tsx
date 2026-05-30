import type { PlanStatus } from '../types'

const statusConfig: Record<PlanStatus, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'bg-gray-100 text-gray-700' },
  active: { label: 'Активен', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Завершён', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Отменён', className: 'bg-red-100 text-red-700' },
}

interface Props {
  status: PlanStatus
}

export default function StatusBadge({ status }: Props) {
  const config = statusConfig[status]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}