import { useState, type FormEvent } from 'react'
import type { PlanItem } from '../types'

interface Props {
  item: PlanItem
  onSubmit: (data: { new_end_date: string; reason: string }) => void
  onClose: () => void
  isLoading: boolean
}

export default function RescheduleModal({ item, onSubmit, onClose, isLoading }: Props) {
  const [newEndDate, setNewEndDate] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!newEndDate || !reason.trim()) return
    onSubmit({ new_end_date: newEndDate, reason: reason.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Перенос дедлайна: {item.title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Новый дедлайн <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Причина переноса <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={1}
              rows={3}
              placeholder="Укажите причину переноса"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Сохранение...' : 'Перенести'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}