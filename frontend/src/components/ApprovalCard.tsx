import { useState } from 'react'
import type { Approval } from '../types'

interface Props {
  approval: Approval
  onApprove: (id: number, data: { review_comment?: string }) => Promise<void>
  onReject: (id: number, data: { review_comment?: string }) => Promise<void>
  isActing: boolean
}

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: 'Ожидает', class: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Согласован', class: 'bg-green-100 text-green-800' },
  rejected: { label: 'Отклонён', class: 'bg-red-100 text-red-800' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ApprovalCard({ approval, onApprove, onReject, isActing }: Props) {
  const [reviewComment, setReviewComment] = useState('')

  const status = statusConfig[approval.status] ?? { label: approval.status, class: 'bg-gray-100 text-gray-800' }

  const handleApprove = () => {
    onApprove(approval.id, { review_comment: reviewComment || undefined })
  }

  const handleReject = () => {
    onReject(approval.id, { review_comment: reviewComment || undefined })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Запрос на перенос #{approval.id}
        </h3>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.class}`}
        >
          {status.label}
        </span>
      </div>

      {/* Plan item */}
      <p className="mb-1 text-sm text-gray-600">
        <span className="font-medium">План:</span> #{approval.plan_item_id}
      </p>

      {/* Reason */}
      {approval.reason && (
        <p className="mb-1 text-sm text-gray-600">
          <span className="font-medium">Причина:</span> {approval.reason}
        </p>
      )}

      {/* Proposed dates */}
      {(approval.new_start_date || approval.new_end_date) && (
        <div className="mb-1 text-sm text-gray-600">
          <span className="font-medium">Предлагаемые даты:</span>{' '}
          {approval.new_start_date ? formatDate(approval.new_start_date) : '—'}
          {' → '}
          {approval.new_end_date ? formatDate(approval.new_end_date) : '—'}
        </div>
      )}

      {/* Created at */}
      <p className="mb-3 text-xs text-gray-400">
        Создан: {formatDateTime(approval.created_at)}
      </p>

      {/* Review comment (show for all statuses) */}
      {approval.status !== 'pending' && approval.review_comment && (
        <div className="mb-3 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          <span className="font-medium">Комментарий руководителя:</span>{' '}
          {approval.review_comment}
        </div>
      )}

      {/* Actions for pending */}
      {approval.status === 'pending' && (
        <div className="space-y-3">
          <textarea
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={2}
            placeholder="Комментарий руководителя (необязательно)"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            disabled={isActing}
          />
          <div className="flex gap-2">
            <button
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleApprove}
              disabled={isActing}
            >
              {isActing ? 'Обработка...' : 'Согласовать'}
            </button>
            <button
              className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleReject}
              disabled={isActing}
            >
              {isActing ? 'Обработка...' : 'Отклонить'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
