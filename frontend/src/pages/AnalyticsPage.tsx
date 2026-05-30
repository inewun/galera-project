import { useState } from 'react'
import { useAnalytics } from '../hooks/useAnalytics'
import SummaryCard from '../components/SummaryCard'
import PlanFactTable from '../components/PlanFactTable'
import type { PlanItemType } from '../types'

const typeOptions: { label: string; value: PlanItemType | '' }[] = [
  { label: 'Все', value: '' },
  { label: 'Month', value: 'month' },
  { label: 'Week', value: 'week' },
  { label: 'Day', value: 'day' },
]

export default function AnalyticsPage() {
  const [type, setType] = useState<PlanItemType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filters: Record<string, string> = {}
  if (type) filters.type = type
  if (dateFrom) filters.date_from = dateFrom
  if (dateTo) filters.date_to = dateTo

  const { total, items, isLoading, isError } = useAnalytics(filters)

  const itemsWithDeviation = items.filter(
    (item) => item.end_date_deviation_days !== null && item.end_date_deviation_days > 0
  )

  const deviations = items
    .map((item) => item.end_date_deviation_days)
    .filter((d): d is number => d !== null)

  const avgDeviation =
    deviations.length > 0
      ? (deviations.reduce((sum, d) => sum + d, 0) / deviations.length).toFixed(1)
      : '—'

  const totalReschedules = items.reduce((sum, item) => sum + item.reschedule_count, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Аналитика план-факт</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg bg-white p-4 shadow-sm border border-gray-200">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Тип</label>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={type}
            onChange={(e) => setType(e.target.value as PlanItemType | '')}
          >
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Дата от</label>
          <input
            type="date"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Дата до</label>
          <input
            type="date"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <p className="text-center text-gray-400">Загрузка...</p>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg bg-red-50 p-4 text-center text-red-600 border border-red-200">
          Ошибка загрузки данных. Попробуйте позже.
        </div>
      )}

      {/* Data states */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-lg bg-white p-8 text-center text-gray-400 border border-gray-200">
          Нет данных для отображения
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Всего планов" value={total} />
            <SummaryCard
              label="С отклонением"
              value={itemsWithDeviation.length}
              highlight={itemsWithDeviation.length > 0 ? 'red' : 'green'}
            />
            <SummaryCard
              label="Среднее отклонение"
              value={avgDeviation}
              highlight={
                avgDeviation === '—' ? 'default' : Number(avgDeviation) > 0 ? 'red' : 'green'
              }
              subtext="дней"
            />
            <SummaryCard
              label="Всего переносов"
              value={totalReschedules}
              highlight={totalReschedules > 0 ? 'yellow' : 'green'}
            />
          </div>

          {/* Table */}
          <PlanFactTable items={items} />
        </>
      )}
    </div>
  )
}