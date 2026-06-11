import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Spinner } from '../../components/Spinner';
import { dataSource } from '../../core/datasource';
import type { Group, HierarchyMap, Task } from '../../core/types';
import { buildTree } from '../structure/tree';
import type { TreeNode } from '../structure/tree';

type HorizonMode = 'month' | 'week' | 'day';

interface Period {
  id: string;
  label: string;
  start: Date;
}

interface Row {
  id: string;
  label: string;
}

interface Bar {
  id: string;
  rowId: string;
  label: string;
  startIndex: number;
  span: number;
  taskId?: string;
  departmentId?: string | null;
  progress?: number;
}

interface PlannerData {
  rows: Row[];
  periods: Period[];
  bars: Bar[];
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; groups: Group[]; hierarchy: HierarchyMap; tasks: Task[] };

const modes: Array<{ id: HorizonMode; label: string }> = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: 'Неделя' },
  { id: 'day', label: 'День' },
];

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function taskStart(task: Task): Date | null {
  if (task.start === null && task.due === null) return null;
  return new Date(task.start ?? task.due!);
}

function taskEnd(task: Task): Date | null {
  if (task.start === null && task.due === null) return null;
  const start = new Date(task.start ?? task.due!);
  const end = new Date(task.due ?? task.start!);
  return end < start ? start : end;
}

function formatDate(value: string | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function formatPeriodDate(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(value);
}

function addWeeks(value: Date, count: number): Date {
  return new Date(value.getTime() + count * MS_WEEK);
}

function buildWeekPeriods(startFrom: Date): Period[] {
  return Array.from({ length: 12 }, (_, index) => {
    const start = addWeeks(startFrom, index);
    return {
      id: `w-${start.toISOString()}`,
      label: formatPeriodDate(start),
      start,
    };
  });
}

function collectDescendants(nodes: TreeNode[]): Map<string, Set<string>> {
  const descendants = new Map<string, Set<string>>();

  function collect(node: TreeNode): Set<string> {
    const result = new Set<string>();
    for (const child of node.children) {
      result.add(child.id);
      for (const childDescendant of collect(child)) {
        result.add(childDescendant);
      }
    }
    descendants.set(node.id, result);
    return result;
  }

  nodes.forEach(collect);
  return descendants;
}

function effectiveGroupsForTask(
  task: Task,
  groups: Group[],
  groupMap: Map<string, Group>,
  descendants: Map<string, Set<string>>,
): string[] {
  if (task.assigneeType === 'group' && task.assigneeId !== null && groupMap.has(task.assigneeId)) {
    return [task.assigneeId];
  }

  if (task.assigneeType !== 'user' || task.assigneeId === null) {
    return [];
  }

  const memberGroups = groups
    .filter((group) => group.memberIds.includes(task.assigneeId!))
    .map((group) => group.id);

  return memberGroups.filter((groupId) => {
    const groupDescendants = descendants.get(groupId);
    if (!groupDescendants || groupDescendants.size === 0) return true;
    return !memberGroups.some((otherId) => otherId !== groupId && groupDescendants.has(otherId));
  });
}

function buildWeekData(
  groups: Group[],
  hierarchy: HierarchyMap,
  tasks: Task[],
  departmentId: string | null,
  weekStart: Date,
): PlannerData {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const tree = buildTree(groups, hierarchy);
  const descendants = collectDescendants(tree);
  const periods = buildWeekPeriods(weekStart);
  const departments = groups.filter((group) => hierarchy[group.id] == null);
  const selectedDepartmentId = departmentId ?? departments[0]?.id ?? null;
  const rows = groups
    .filter((group) => hierarchy[group.id] === selectedDepartmentId)
    .map((group) => ({ id: group.id, label: group.name }));
  const rowIds = new Set(rows.map((row) => row.id));
  const firstWeekStart = periods[0]?.start;
  const lastPeriod = periods[periods.length - 1];
  const lastWeekEnd = lastPeriod
    ? new Date(lastPeriod.start.getTime() + MS_WEEK)
    : null;
  const bars: Bar[] = [];

  if (!firstWeekStart || !lastWeekEnd) {
    return { rows, periods, bars };
  }

  for (const task of tasks) {
    const start = taskStart(task);
    const end = taskEnd(task);
    if (start === null || end === null) continue;
    if (end < firstWeekStart || start >= lastWeekEnd) continue;

    for (const groupId of effectiveGroupsForTask(task, groups, groupMap, descendants)) {
      if (!rowIds.has(groupId)) continue;

      const visibleStart = start < firstWeekStart ? firstWeekStart : start;
      const visibleEnd = end >= lastWeekEnd ? new Date(lastWeekEnd.getTime() - MS_DAY) : end;
      const startIndex = Math.max(0, Math.floor((startOfWeek(visibleStart).getTime() - firstWeekStart.getTime()) / MS_WEEK));
      const endIndex = Math.min(
        periods.length - 1,
        Math.floor((startOfWeek(visibleEnd).getTime() - firstWeekStart.getTime()) / MS_WEEK),
      );

      bars.push({
        id: `${task.id}-${groupId}`,
        rowId: groupId,
        label: task.subject,
        startIndex,
        span: Math.max(1, endIndex - startIndex + 1),
        taskId: task.id,
        departmentId: selectedDepartmentId,
        progress: task.progress,
      });
    }
  }

  return { rows, periods, bars };
}

const demoData: Record<Exclude<HorizonMode, 'week'>, PlannerData> = {
  month: {
    rows: [
      { id: 'dep-1', label: 'Департамент' },
      { id: 'dep-2', label: 'Разработка' },
      { id: 'dep-3', label: 'Внедрение' },
    ],
    periods: ['Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек', 'Янв'].map((label, index) => ({
      id: `m-${index}`,
      label,
      start: new Date(2026, index + 5, 1),
    })),
    bars: [
      { id: 'mp-1', rowId: 'dep-1', label: 'Проект A', startIndex: 0, span: 3 },
      { id: 'mp-2', rowId: 'dep-2', label: 'Проект B', startIndex: 2, span: 4 },
      { id: 'mp-3', rowId: 'dep-3', label: 'Проект C', startIndex: 4, span: 2 },
    ],
  },
  day: {
    rows: [
      { id: 'task-1', label: 'Задача 1' },
      { id: 'task-2', label: 'Задача 2' },
      { id: 'task-3', label: 'Задача 3' },
    ],
    periods: Array.from({ length: 14 }, (_, index) => ({
      id: `d-${index}`,
      label: `${index + 1}`,
      start: new Date(2026, 5, index + 1),
    })),
    bars: [
      { id: 'de-1', rowId: 'task-1', label: 'Иванов', startIndex: 1, span: 3 },
      { id: 'de-2', rowId: 'task-2', label: 'Петрова', startIndex: 4, span: 4 },
      { id: 'de-3', rowId: 'task-3', label: 'Смирнов', startIndex: 8, span: 3 },
    ],
  },
};

export function PlanningHorizonsView() {
  const [mode, setMode] = useState<HorizonMode>('week');
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [groups, hierarchy, tasks] = await Promise.all([
        dataSource.getGroups(),
        dataSource.getHierarchy(),
        dataSource.getTasks(),
      ]);
      const departments = groups.filter((group) => hierarchy[group.id] == null);
      setSelectedDepartmentId((current) => current ?? departments[0]?.id ?? null);
      setState({ status: 'loaded', groups, hierarchy, tasks });
    } catch (err) {
      setState({
        status: 'error',
        message: (err as Error).message || 'Ошибка загрузки',
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data: PlannerData = useMemo(() => {
    if (mode !== 'week') return demoData[mode];
    if (state.status !== 'loaded') return { rows: [], periods: [], bars: [] };
    return buildWeekData(state.groups, state.hierarchy, state.tasks, selectedDepartmentId, weekStart);
  }, [mode, selectedDepartmentId, state, weekStart]);

  const activeMode = modes.find((item) => item.id === mode);
  const columnCount = data.periods.length;
  const barsByRow = useMemo(() => {
    return data.bars.reduce((map, bar) => {
      map.set(bar.rowId, [...(map.get(bar.rowId) ?? []), bar]);
      return map;
    }, new Map<string, Bar[]>());
  }, [data.bars]);
  const selectedBar = data.bars.find((bar) => bar.id === selectedBarId) ?? null;
  const selectedTask = state.status === 'loaded' && selectedBar?.taskId
    ? state.tasks.find((task) => task.id === selectedBar.taskId) ?? null
    : null;
  const selectedGroup = state.status === 'loaded' && selectedBar
    ? state.groups.find((group) => group.id === selectedBar.rowId) ?? null
    : null;
  const selectedDepartment = state.status === 'loaded' && selectedBar?.departmentId
    ? state.groups.find((group) => group.id === selectedBar.departmentId) ?? null
    : null;
  const todayIndex = mode === 'week'
    ? data.periods.findIndex((period) => {
      const today = new Date();
      return today >= period.start && today < addWeeks(period.start, 1);
    })
    : -1;

  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />;

  const departments = state.groups.filter((group) => state.hierarchy[group.id] == null);
  const weekEnd = addWeeks(weekStart, 11);

  return (
    <section className="planning">
      <header className="page-header planning__header">
        <div>
          <h1 className="page-header__title">Горизонты планирования</h1>
          <p className="page-header__subtitle">Матрица загрузки по месяцам, неделям и дням</p>
        </div>
        <div className="planning__mode-switch" aria-label="Горизонт планирования">
          {modes.map((item) => (
            <button
              key={item.id}
              className={
                'planning__mode-btn' +
                (mode === item.id ? ' planning__mode-btn--active' : '')
              }
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {mode === 'week' && (
        <div className="planning__toolbar">
          <select
            className="gantt-view__select"
            value={selectedDepartmentId ?? ''}
            onChange={(event) => {
              setSelectedDepartmentId(event.target.value || null);
              setSelectedBarId(null);
            }}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <div className="planning__week-nav">
            <button
              className="planning__nav-btn"
              onClick={() => {
                setWeekStart((current) => addWeeks(current, -4));
                setSelectedBarId(null);
              }}
            >
              Назад
            </button>
            <button
              className="planning__nav-btn"
              onClick={() => {
                setWeekStart(startOfWeek(new Date()));
                setSelectedBarId(null);
              }}
            >
              Сегодня
            </button>
            <button
              className="planning__nav-btn"
              onClick={() => {
                setWeekStart((current) => addWeeks(current, 4));
                setSelectedBarId(null);
              }}
            >
              Вперёд
            </button>
            <span className="planning__range">
              {formatPeriodDate(weekStart)} — {formatPeriodDate(weekEnd)}
            </span>
          </div>
        </div>
      )}

      {data.rows.length === 0 ? (
        <EmptyState message="Нет данных для выбранного горизонта" />
      ) : (
        <div className="planning__grid-wrap">
          <div
            className="planning-grid"
            style={{
              '--planning-columns': columnCount,
              '--planning-today-column': todayIndex + 1,
            } as CSSProperties}
          >
            <div className="planning-grid__corner">{activeMode?.label}</div>
            <div className="planning-grid__periods">
              {data.periods.map((period) => (
                <div className="planning-grid__period" key={period.id}>
                  {period.label}
                </div>
              ))}
            </div>

            {data.rows.map((row) => (
              <div className="planning-grid__row" key={row.id}>
                <div className="planning-grid__row-label">{row.label}</div>
                <div className="planning-grid__cells">
                  {todayIndex >= 0 && <div className="planning-grid__today" />}
                  {data.periods.map((period) => (
                    <div className="planning-grid__cell" key={period.id} />
                  ))}
                  {(barsByRow.get(row.id) ?? []).map((bar) => (
                    <button
                      key={bar.id}
                      className={
                        'planning-grid__bar' +
                        (selectedBarId === bar.id ? ' planning-grid__bar--selected' : '')
                      }
                      style={{
                        gridColumn: `${bar.startIndex + 1} / span ${bar.span}`,
                        '--planning-progress': `${bar.progress ?? 0}%`,
                      } as CSSProperties}
                      onClick={() => setSelectedBarId(bar.id)}
                      title={bar.label}
                    >
                      {bar.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTask && selectedBar && (
        <aside className="planning-details planning-details--side">
          <div className="planning-details__header">
            <h2 className="planning-details__title">#{selectedTask.id} {selectedTask.subject}</h2>
            <button
              className="planning-details__close"
              onClick={() => setSelectedBarId(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <dl className="planning-details__grid">
            <div>
              <dt>Отдел</dt>
              <dd>{selectedGroup?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Департамент</dt>
              <dd>{selectedDepartment?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Дата начала</dt>
              <dd>{formatDate(selectedTask.start)}</dd>
            </div>
            <div>
              <dt>Дата окончания</dt>
              <dd>{formatDate(selectedTask.due)}</dd>
            </div>
            <div>
              <dt>Статус</dt>
              <dd>{selectedTask.status || '—'}</dd>
            </div>
            <div>
              <dt>Тип</dt>
              <dd>{selectedTask.typeName || '—'}</dd>
            </div>
            <div>
              <dt>Проект</dt>
              <dd>{selectedTask.projectId ?? '—'}</dd>
            </div>
            <div>
              <dt>Прогресс</dt>
              <dd>{selectedTask.progress}%</dd>
            </div>
          </dl>
        </aside>
      )}
    </section>
  );
}
