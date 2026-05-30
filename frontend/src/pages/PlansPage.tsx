import { useState } from 'react'
import type { PlanItem, PlanItemType, PlanStatus } from '../types'
import { usePlanItems } from '../hooks/usePlanItems'
import PlanItemRow from '../components/PlanItemRow'
import StatusBadge from '../components/StatusBadge'
import RescheduleModal from '../components/RescheduleModal'
import CreatePlanModal from '../components/CreatePlanModal'

export default function PlansPage() {
  // Фильтры
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filters: { type?: PlanItemType; status?: PlanStatus } = {}
  if (typeFilter) filters.type = typeFilter as PlanItemType
  if (statusFilter) filters.status = statusFilter as PlanStatus

  const {
    items,
    isLoading,
    isError,
    error,
    createPlanItem,
    isCreating,
    reschedulePlanItem,
    isRescheduling,
  } = usePlanItems(filters)

  // Выбранный план (детали под таблицей)
  const [selectedItem, setSelectedItem] = useState<PlanItem | null>(null)

  // Модалка переноса
  const [rescheduleTarget, setRescheduleTarget] = useState<PlanItem | null>(null)

  // Модалка создания
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Обработчики
  const handleSelect = (item: PlanItem) => {
    setSelectedItem((prev) => (prev?.id === item.id ? null : item))
  }

  const handleRescheduleSubmit = async (data: { new_end_date: string; reason: string }) => {
    if (!rescheduleTarget) return
    await reschedulePlanItem({ id: rescheduleTarget.id, data })
    setRescheduleTarget(null)
  }

  const handleCreateSubmit = async (data: {
    title: string
    type: PlanItemType
    original_end_date: string
    description: string
  }) => {
    await createPlanItem({
      title: data.title,
      type: data.type,
      original_end_date: data.original_end_date || null,
      description: data.description || null,
      status: 'draft',
    })
    setShowCreateModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и кнопка создания */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Планы</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          + Создать план
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Все типы</option>
          <option value="month">Месяц</option>
          <option value="week">Неделя</option>
          <option value="day">День</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="active">Активен</option>
          <option value="completed">Завершён</option>
          <option value="cancelled">Отменён</option>
        </select>
      </div>

      {/* Состояние загрузки */}
      {isLoading && (
        <div className="text-center py-12 text-gray-500">Загрузка планов...</div>
      )}

      {/* Состояние ошибки */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
          Ошибка загрузки планов: {error instanceof Error ? error.message : 'Неизвестная ошибка'}
        </div>
      )}

      {/* Таблица */}
      {!isLoading && !isError && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дедлайн
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Отклонение
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    Планы не найдены
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <PlanItemRow
                    key={item.id}
                    item={item}
                    onSelect={handleSelect}
                    onReschedule={setRescheduleTarget}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Детали выбранного плана */}
      {selectedItem && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Детали плана: {selectedItem.title}
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DetailField label="ID" value={String(selectedItem.id)} />
            <DetailField label="Тип" value={selectedItem.type} />
            <DetailField label="Статус" value={<StatusBadge status={selectedItem.status} />} />
            <DetailField label="Описание" value={selectedItem.description || '—'} />
            <DetailField
              label="Исходный дедлайн"
              value={selectedItem.original_end_date ? formatDate(selectedItem.original_end_date) : '—'}
            />
            <DetailField
              label="Текущий дедлайн"
              value={selectedItem.current_end_date ? formatDate(selectedItem.current_end_date) : '—'}
            />
            <DetailField
              label="Фактический дедлайн"
              value={selectedItem.actual_end_date ? formatDate(selectedItem.actual_end_date) : '—'}
            />
            <DetailField label="Архивирован" value={selectedItem.is_archived ? 'Да' : 'Нет'} />
            <DetailField label="Создан" value={formatDate(selectedItem.created_at)} />
            <DetailField label="Обновлён" value={formatDate(selectedItem.updated_at)} />
          </div>
        </div>
      )}

      {/* Модалка переноса */}
      {rescheduleTarget && (
        <RescheduleModal
          item={rescheduleTarget}
          onSubmit={handleRescheduleSubmit}
          onClose={() => setRescheduleTarget(null)}
          isLoading={isRescheduling}
        />
      )}

      {/* Модалка создания */}
      {showCreateModal && (
        <CreatePlanModal
          onSubmit={handleCreateSubmit}
          onClose={() => setShowCreateModal(false)}
          isLoading={isCreating}
        />
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-gray-500 block">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  )
}
