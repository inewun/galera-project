import { useState, type FormEvent } from 'react'
import type { PlanItemType } from '../types'

interface CreatePlanData {
  title: string
  type: PlanItemType
  original_end_date: string
  description: string
}

interface Props {
  onSubmit: (data: CreatePlanData) => void
  onClose: () => void
  isLoading: boolean
}

export default function CreatePlanModal({ onSubmit, onClose, isLoading }: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<PlanItemType>('month')
  const [originalEndDate, setOriginalEndDate] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      type,
      original_end_date: originalEndDate,
      description: description.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Создание плана</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Введите название плана"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PlanItemType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="month">Месяц</option>
              <option value="week">Неделя</option>
              <option value="day">День</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Исходный дедлайн
            </label>
            <input
              type="date"
              value={originalEndDate}
              onChange={(e) => setOriginalEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Описание плана (необязательно)"
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
              {isLoading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}