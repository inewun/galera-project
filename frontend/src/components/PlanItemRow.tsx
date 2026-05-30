import type { PlanItem } from '../types'
import StatusBadge from './StatusBadge'

const typeLabels: Record<string, string> = {
  month: 'Месяц',
  week: 'Неделя',
  day: 'День',
}

const typeColors: Record<string, string> = {
  month: 'bg-purple-100 text-purple-700',
  week: 'bg-cyan-100 text-cyan-700',
  day: 'bg-amber-100 text-amber-700',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU')
}

function getDeviationDays(current: string | null, original: string | null): number | null {
  if (!current || !original) return null
  const diff = new Date(current).getTime() - new Date(original).getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

interface Props {
  item: PlanItem
  onSelect: (item: PlanItem) => void
  onReschedule: (item: PlanItem) => void
}

export default function PlanItemRow({ item, onSelect, onReschedule }: Props) {
  const deviation = getDeviationDays(item.current_end_date, item.original_end_date)

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Тип */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            typeColors[item.type] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {typeLabels[item.type] || item.type}
        </span>
      </td>

      {/* Название */}
      <td className="px-4 py-3">
        <button
          onClick={() => onSelect(item)}
          className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium"
        >
          {item.title}
        </button>
      </td>

      {/* Дедлайн */}
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {formatDate(item.current_end_date)}
      </td>

      {/* Отклонение */}
      <td className="px-4 py-3 whitespace-nowrap text-sm">
        {deviation !== null ? (
          <span className={deviation > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
            {deviation > 0 ? `+${deviation}` : `${deviation}`} дн.
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      {/* Статус */}
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={item.status} />
      </td>

      {/* Действия */}
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={() => onReschedule(item)}
          className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Перенести
        </button>
      </td>
    </tr>
  )
}
