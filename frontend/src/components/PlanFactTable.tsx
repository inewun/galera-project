import type { ReactNode } from 'react'
import type { PlanFactItem } from '../types'
import StatusBadge from './StatusBadge'

interface Props {
  items: PlanFactItem[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

function deviationClass(value: number | null): string {
  if (value === null || value === 0) return 'text-gray-400'
  return value > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'
}

function formatDeviation(value: number | null): string {
  if (value === null || value === 0) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value} дн.`
}

function rescheduleClass(value: number): string {
  if (value > 2) return 'text-red-600 font-medium'
  if (value >= 1) return 'text-yellow-600 font-medium'
  return 'text-green-600 font-medium'
}

export default function PlanFactTable({ items }: Props): ReactNode {
  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center text-gray-400 border border-gray-200">
        Нет данных
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Название</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Тип</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Статус</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Исходный дедлайн</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Текущий дедлайн</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Факт</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Отклонение (план)</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Отклонение (факт)</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Переносов</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={item.plan_item_id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
              <td className="px-4 py-3 text-gray-600 capitalize">{item.type}</td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-gray-600">{formatDate(item.original_end_date)}</td>
              <td className="px-4 py-3 text-gray-600">{formatDate(item.current_end_date)}</td>
              <td className="px-4 py-3 text-gray-600">{formatDate(item.actual_end_date)}</td>
              <td className={`px-4 py-3 ${deviationClass(item.end_date_deviation_days)}`}>
                {formatDeviation(item.end_date_deviation_days)}
              </td>
              <td className={`px-4 py-3 ${deviationClass(item.actual_deviation_days)}`}>
                {formatDeviation(item.actual_deviation_days)}
              </td>
              <td className={`px-4 py-3 ${rescheduleClass(item.reschedule_count)}`}>
                {item.reschedule_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}