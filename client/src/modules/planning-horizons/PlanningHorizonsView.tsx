import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Spinner } from '../../components/Spinner';
import { dataSource } from '../../core/datasource';
import type { Group, HierarchyMap, Project, Task, User } from '../../core/types';

type HorizonMode = 'month' | 'week' | 'day';

interface Period {
  id: string;
  label: string;
  start: Date;
  end: Date;
}

interface HorizonRow {
  id: string;
  groupId: string;
  groupLabel: string;
  label: string;
  taskId?: string;
  projectId?: string;
}

interface HorizonBar {
  id: string;
  rowId: string;
  label: string;
  startIndex: number;
  span: number;
  taskId?: string;
  projectId?: string;
  progress?: number;
}

interface GroupSpan {
  id: string;
  label: string;
  start: number;
  span: number;
}

interface HorizonData {
  leftHeader: string;
  rowHeader: string;
  rows: HorizonRow[];
  periods: Period[];
  bars: HorizonBar[];
  groupSpans: GroupSpan[];
  hiddenNoDateCount: number;
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'loaded';
      groups: Group[];
      hierarchy: HierarchyMap;
      projects: Project[];
      tasks: Task[];
      users: User[];
    };

const modes: Array<{ id: HorizonMode; label: string }> = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: 'Неделя' },
  { id: 'day', label: 'День' },
];

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function startOfMonth(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

function addDays(date: Date, count: number): Date {
  return new Date(date.getTime() + count * MS_DAY);
}

function addWeeks(date: Date, count: number): Date {
  return addDays(date, count * 7);
}

function addMonths(date: Date, count: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + count);
  return result;
}

function defaultRangeStart(mode: HorizonMode): Date {
  const now = new Date();
  if (mode === 'month') return startOfMonth(now);
  if (mode === 'week') return startOfWeek(now);
  return startOfDay(now);
}

function moveRange(date: Date, mode: HorizonMode, direction: -1 | 1): Date {
  if (mode === 'month') return addMonths(date, direction * 4);
  if (mode === 'week') return addWeeks(date, direction * 4);
  return addDays(date, direction * 14);
}

function taskRange(task: Task): { start: Date; end: Date } | null {
  if (task.start === null && task.due === null) return null;
  const start = startOfDay(new Date(task.start ?? task.due!));
  let end = startOfDay(new Date(task.due ?? task.start!));
  if (end < start) end = new Date(start);
  return { start, end };
}

function formatDate(value: string | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function formatShortDate(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(value);
}

function formatMonth(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'short',
    year: '2-digit',
  }).format(value);
}

function buildPeriods(mode: HorizonMode, start: Date): Period[] {
  if (mode === 'month') {
    return Array.from({ length: 12 }, (_, index) => {
      const periodStart = addMonths(start, index);
      return {
        id: `m-${periodStart.toISOString()}`,
        label: formatMonth(periodStart),
        start: periodStart,
        end: addMonths(periodStart, 1),
      };
    });
  }

  if (mode === 'week') {
    return Array.from({ length: 16 }, (_, index) => {
      const periodStart = addWeeks(start, index);
      return {
        id: `w-${periodStart.toISOString()}`,
        label: formatShortDate(periodStart),
        start: periodStart,
        end: addWeeks(periodStart, 1),
      };
    });
  }

  return Array.from({ length: 31 }, (_, index) => {
    const periodStart = addDays(start, index);
    return {
      id: `d-${periodStart.toISOString()}`,
      label: formatShortDate(periodStart),
      start: periodStart,
      end: addDays(periodStart, 1),
    };
  });
}

function getPeriodSpan(periods: Period[], task: Task): { startIndex: number; span: number } | null {
  const range = taskRange(task);
  if (range === null) return null;
  return getRangePeriodSpan(periods, range.start, range.end);
}

function getRangePeriodSpan(periods: Period[], start: Date, end: Date): { startIndex: number; span: number } | null {
  const startIndex = periods.findIndex((period) => end >= period.start && start < period.end);
  let endIndex = -1;
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    const period = periods[index];
    if (end >= period.start && start < period.end) {
      endIndex = index;
      break;
    }
  }

  if (startIndex < 0 || endIndex < 0) return null;
  return { startIndex, span: Math.max(1, endIndex - startIndex + 1) };
}

function groupSpans(rows: HorizonRow[]): GroupSpan[] {
  const spans: GroupSpan[] = [];
  let index = 0;

  while (index < rows.length) {
    const row = rows[index];
    let span = 1;
    while (rows[index + span]?.groupId === row.groupId) span += 1;
    spans.push({
      id: row.groupId,
      label: row.groupLabel,
      start: index + 2,
      span,
    });
    index += span;
  }

  return spans;
}

function departmentForGroup(groupId: string, hierarchy: HierarchyMap): string | null {
  return hierarchy[groupId] ?? groupId;
}

function officeIdsForUser(userId: string, groups: Group[], hierarchy: HierarchyMap): string[] {
  return groups
    .filter((group) => hierarchy[group.id] !== null && group.memberIds.includes(userId))
    .map((group) => group.id);
}

function departmentIdsForTask(task: Task, groups: Group[], hierarchy: HierarchyMap): string[] {
  if (task.assigneeType === 'group' && task.assigneeId !== null) {
    const departmentId = departmentForGroup(task.assigneeId, hierarchy);
    return departmentId === null ? [] : [departmentId];
  }

  if (task.assigneeType === 'user' && task.assigneeId !== null) {
    return [
      ...new Set(
        officeIdsForUser(task.assigneeId, groups, hierarchy)
          .map((officeId) => hierarchy[officeId])
          .filter((id): id is string => id !== null && id !== undefined),
      ),
    ];
  }

  return [];
}

function officeIdsForTask(task: Task, groups: Group[], hierarchy: HierarchyMap): string[] {
  if (task.assigneeType === 'group' && task.assigneeId !== null && hierarchy[task.assigneeId] !== null) {
    return [task.assigneeId];
  }

  if (task.assigneeType === 'user' && task.assigneeId !== null) {
    return officeIdsForUser(task.assigneeId, groups, hierarchy);
  }

  return [];
}

function buildMonthData(
  groups: Group[],
  hierarchy: HierarchyMap,
  projects: Project[],
  tasks: Task[],
  periods: Period[],
): HorizonData {
  const departments = groups
    .filter((group) => hierarchy[group.id] == null)
    .sort((a, b) => a.name.localeCompare(b.name));
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const tasksByDepartmentProject = new Map<string, Task[]>();
  let hiddenNoDateCount = 0;

  for (const task of tasks) {
    if (task.start === null && task.due === null) hiddenNoDateCount += 1;
    if (task.projectId === null) continue;

    for (const departmentId of departmentIdsForTask(task, groups, hierarchy)) {
      if (!departmentById.has(departmentId)) continue;
      const key = `${departmentId}:${task.projectId}`;
      tasksByDepartmentProject.set(key, [...(tasksByDepartmentProject.get(key) ?? []), task]);
    }
  }

  const rows: HorizonRow[] = [];
  const bars: HorizonBar[] = [];

  for (const department of departments) {
    const projectIds = [...new Set(
      [...tasksByDepartmentProject.keys()]
        .filter((key) => key.startsWith(`${department.id}:`))
        .map((key) => key.split(':')[1]),
    )].sort((a, b) => (projectById.get(a)?.name ?? a).localeCompare(projectById.get(b)?.name ?? b));

    for (const projectId of projectIds) {
      const project = projectById.get(projectId);
      const rowId = `${department.id}:${projectId}`;
      rows.push({
        id: rowId,
        groupId: department.id,
        groupLabel: department.name,
        label: project?.name ?? `Проект #${projectId}`,
        projectId,
      });

      const projectTasks = tasksByDepartmentProject.get(rowId) ?? [];
      const ranges = projectTasks
        .map(taskRange)
        .filter((range): range is { start: Date; end: Date } => range !== null);
      if (ranges.length === 0) continue;

      const start = ranges.reduce((min, range) => (range.start < min ? range.start : min), ranges[0].start);
      const end = ranges.reduce((max, range) => (range.end > max ? range.end : max), ranges[0].end);
      const span = getRangePeriodSpan(periods, start, end);
      if (span === null) continue;

      bars.push({
        id: rowId,
        rowId,
        label: project?.name ?? `Проект #${projectId}`,
        startIndex: span.startIndex,
        span: span.span,
        projectId,
        progress: 100,
      });
    }
  }

  return {
    leftHeader: 'Департамент',
    rowHeader: 'Проект',
    rows,
    periods,
    bars,
    groupSpans: groupSpans(rows),
    hiddenNoDateCount,
  };
}

function buildWeekData(
  groups: Group[],
  hierarchy: HierarchyMap,
  tasks: Task[],
  periods: Period[],
  departmentId: string | null,
): HorizonData {
  const departments = groups.filter((group) => hierarchy[group.id] == null);
  const selectedDepartmentId = departmentId ?? departments[0]?.id ?? null;
  const offices = groups
    .filter((group) => hierarchy[group.id] === selectedDepartmentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const officeById = new Map(offices.map((office) => [office.id, office]));
  const tasksByOffice = new Map<string, Task[]>();
  let hiddenNoDateCount = 0;

  for (const task of tasks) {
    if (task.start === null && task.due === null) hiddenNoDateCount += 1;

    for (const officeId of officeIdsForTask(task, groups, hierarchy)) {
      if (!officeById.has(officeId)) continue;
      tasksByOffice.set(officeId, [...(tasksByOffice.get(officeId) ?? []), task]);
    }
  }

  const rows: HorizonRow[] = [];
  const bars: HorizonBar[] = [];

  for (const office of offices) {
    const officeTasks = [...(tasksByOffice.get(office.id) ?? [])]
      .sort((a, b) => a.subject.localeCompare(b.subject));

    for (const task of officeTasks) {
      const rowId = `${office.id}:${task.id}`;
      rows.push({
        id: rowId,
        groupId: office.id,
        groupLabel: office.name,
        label: task.subject,
        taskId: task.id,
        projectId: task.projectId ?? undefined,
      });

      const span = getPeriodSpan(periods, task);
      if (span === null) continue;
      bars.push({
        id: rowId,
        rowId,
        label: task.subject,
        startIndex: span.startIndex,
        span: span.span,
        taskId: task.id,
        projectId: task.projectId ?? undefined,
        progress: task.progress,
      });
    }
  }

  return {
    leftHeader: 'Отдел',
    rowHeader: 'Задача',
    rows,
    periods,
    bars,
    groupSpans: groupSpans(rows),
    hiddenNoDateCount,
  };
}

function assignedUsersForTask(task: Task, office: Group | null, users: User[]): User[] {
  if (task.assigneeType === 'user' && task.assigneeId !== null) {
    const user = users.find((item) => item.id === task.assigneeId);
    return user ? [user] : [];
  }

  if (task.assigneeType === 'group' && task.assigneeId === office?.id) {
    return users.filter((user) => office.memberIds.includes(user.id));
  }

  return [];
}

function buildDayData(
  groups: Group[],
  hierarchy: HierarchyMap,
  users: User[],
  tasks: Task[],
  periods: Period[],
  officeId: string | null,
  selectedTaskId: string | null,
): HorizonData {
  const office = groups.find((group) => group.id === officeId) ?? null;
  const officeTasks = office
    ? tasks.filter((task) => officeIdsForTask(task, groups, hierarchy).includes(office.id))
    : [];
  const filteredTasks = selectedTaskId
    ? officeTasks.filter((task) => task.id === selectedTaskId)
    : officeTasks;
  let hiddenNoDateCount = 0;
  const rows: HorizonRow[] = [];
  const bars: HorizonBar[] = [];

  for (const task of filteredTasks.sort((a, b) => a.subject.localeCompare(b.subject))) {
    if (task.start === null && task.due === null) hiddenNoDateCount += 1;
    const assignedUsers = assignedUsersForTask(task, office, users);
    const visibleUsers = assignedUsers.length > 0
      ? assignedUsers
      : [{ id: 'unassigned', name: 'Без сотрудника', email: null, avatarUrl: null, groupIds: [] }];

    for (const user of visibleUsers) {
      const rowId = `${user.id}:${task.id}`;
      rows.push({
        id: rowId,
        groupId: user.id,
        groupLabel: user.name,
        label: task.subject,
        taskId: task.id,
        projectId: task.projectId ?? undefined,
      });

      const span = getPeriodSpan(periods, task);
      if (span === null) continue;
      bars.push({
        id: rowId,
        rowId,
        label: user.name,
        startIndex: span.startIndex,
        span: span.span,
        taskId: task.id,
        projectId: task.projectId ?? undefined,
        progress: task.progress,
      });
    }
  }

  return {
    leftHeader: 'Сотрудник',
    rowHeader: 'Задача',
    rows,
    periods,
    bars,
    groupSpans: groupSpans(rows),
    hiddenNoDateCount,
  };
}

export function PlanningHorizonsView() {
  const [mode, setMode] = useState<HorizonMode>('month');
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [rangeStart, setRangeStart] = useState(() => defaultRangeStart('month'));
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [selectedDayTaskId, setSelectedDayTaskId] = useState<string>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [approvalDue, setApprovalDue] = useState('');
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [groups, hierarchy, projects, tasks, users] = await Promise.all([
        dataSource.getGroups(),
        dataSource.getHierarchy(),
        dataSource.getProjects(),
        dataSource.getTasks(),
        dataSource.getUsers(),
      ]);
      const departments = groups.filter((group) => hierarchy[group.id] == null);
      const firstDepartmentId = departments[0]?.id ?? null;
      const firstOfficeId = groups.find((group) => hierarchy[group.id] === firstDepartmentId)?.id ?? null;
      setSelectedDepartmentId((current) => current ?? firstDepartmentId);
      setSelectedOfficeId((current) => current ?? firstOfficeId);
      setState({ status: 'loaded', groups, hierarchy, projects, tasks, users });
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

  useEffect(() => {
    setRangeStart(defaultRangeStart(mode));
    setSelectedTaskId(null);
  }, [mode]);

  const departments = state.status === 'loaded'
    ? state.groups.filter((group) => state.hierarchy[group.id] == null)
    : [];
  const offices = state.status === 'loaded'
    ? state.groups.filter((group) => group.id !== selectedDepartmentId && state.hierarchy[group.id] === selectedDepartmentId)
    : [];
  const dayTasks = state.status === 'loaded' && selectedOfficeId
    ? state.tasks
      .filter((task) => officeIdsForTask(task, state.groups, state.hierarchy).includes(selectedOfficeId))
      .sort((a, b) => a.subject.localeCompare(b.subject))
    : [];

  useEffect(() => {
    if (mode !== 'day') return;
    if (selectedDayTaskId !== 'all' && !dayTasks.some((task) => task.id === selectedDayTaskId)) {
      setSelectedDayTaskId('all');
    }
  }, [dayTasks, mode, selectedDayTaskId]);

  const periods = useMemo(() => buildPeriods(mode, rangeStart), [mode, rangeStart]);
  const data = useMemo<HorizonData | null>(() => {
    if (state.status !== 'loaded') return null;
    if (mode === 'month') {
      return buildMonthData(state.groups, state.hierarchy, state.projects, state.tasks, periods);
    }
    if (mode === 'week') {
      return buildWeekData(state.groups, state.hierarchy, state.tasks, periods, selectedDepartmentId);
    }
    return buildDayData(
      state.groups,
      state.hierarchy,
      state.users,
      state.tasks,
      periods,
      selectedOfficeId,
      selectedDayTaskId === 'all' ? null : selectedDayTaskId,
    );
  }, [mode, periods, selectedDayTaskId, selectedDepartmentId, selectedOfficeId, state]);

  const barsByRow = useMemo(() => {
    return (data?.bars ?? []).reduce((map, bar) => {
      map.set(bar.rowId, [...(map.get(bar.rowId) ?? []), bar]);
      return map;
    }, new Map<string, HorizonBar[]>());
  }, [data]);

  const selectedTask = state.status === 'loaded' && selectedTaskId
    ? state.tasks.find((task) => task.id === selectedTaskId) ?? null
    : null;
  const selectedProject = state.status === 'loaded' && selectedTask?.projectId
    ? state.projects.find((project) => project.id === selectedTask.projectId) ?? null
    : null;

  useEffect(() => {
    setApprovalDue(selectedTask?.due ?? '');
    setApprovalMessage(null);
  }, [selectedTask?.id, selectedTask?.due]);

  const createApproval = async () => {
    if (!selectedTask || !approvalDue) return;

    setApprovalSaving(true);
    setApprovalMessage(null);
    try {
      await dataSource.createApprovalRequest({
        taskId: selectedTask.id,
        taskSubject: selectedTask.subject,
        projectId: selectedTask.projectId,
        projectName: selectedProject?.name ?? null,
        currentDue: selectedTask.due,
        proposedDue: approvalDue,
      });
      setApprovalMessage('Заявка отправлена на согласование');
    } catch (err) {
      setApprovalMessage((err as Error).message || 'Ошибка создания заявки');
    } finally {
      setApprovalSaving(false);
    }
  };

  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />;

  const rangeEnd = data?.periods[data.periods.length - 1]?.start ?? rangeStart;

  return (
    <section className="planning">
      <header className="page-header planning__header">
        <div>
          <h1 className="page-header__title">Горизонты планирования</h1>
          <p className="page-header__subtitle">Месяц: департаменты и проекты · Неделя: отделы и задачи · День: сотрудники на задачах</p>
        </div>
      </header>

      <div className="planning__horizon-switch" aria-label="Горизонт планирования">
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

      <div className="planning__toolbar">
        {mode === 'week' && (
          <select
            className="gantt-view__select"
            value={selectedDepartmentId ?? ''}
            onChange={(event) => {
              setSelectedDepartmentId(event.target.value || null);
              setSelectedTaskId(null);
            }}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        )}

        {mode === 'day' && (
          <>
            <select
              className="gantt-view__select"
              value={selectedOfficeId ?? ''}
              onChange={(event) => {
                setSelectedOfficeId(event.target.value || null);
                setSelectedDayTaskId('all');
                setSelectedTaskId(null);
              }}
            >
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
            <select
              className="gantt-view__select"
              value={selectedDayTaskId}
              onChange={(event) => {
                setSelectedDayTaskId(event.target.value);
                setSelectedTaskId(null);
              }}
            >
              <option value="all">Все задачи отдела</option>
              {dayTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.subject}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="planning__week-nav">
          <button
            className="planning__nav-btn"
            onClick={() => {
              setRangeStart((current) => moveRange(current, mode, -1));
              setSelectedTaskId(null);
            }}
          >
            Назад
          </button>
          <button
            className="planning__nav-btn"
            onClick={() => {
              setRangeStart(defaultRangeStart(mode));
              setSelectedTaskId(null);
            }}
          >
            Сегодня
          </button>
          <button
            className="planning__nav-btn"
            onClick={() => {
              setRangeStart((current) => moveRange(current, mode, 1));
              setSelectedTaskId(null);
            }}
          >
            Вперёд
          </button>
          <span className="planning__range">
            {formatDate(rangeStart.toISOString())} — {formatDate(rangeEnd.toISOString())}
          </span>
        </div>
      </div>

      {data === null || data.rows.length === 0 ? (
        <EmptyState message="Нет данных для выбранного горизонта" />
      ) : (
        <div className="planning__grid-wrap">
          <div
            className="planning-matrix"
            style={{
              '--planning-columns': data.periods.length,
              '--planning-rows': data.rows.length,
            } as CSSProperties}
          >
            <div className="planning-matrix__corner planning-matrix__corner--group">{data.leftHeader}</div>
            <div className="planning-matrix__corner planning-matrix__corner--row">{data.rowHeader}</div>
            <div className="planning-matrix__periods">
              {data.periods.map((period) => (
                <div className="planning-matrix__period" key={period.id}>
                  {period.label}
                </div>
              ))}
            </div>

            {data.groupSpans.map((span) => (
              <div
                className="planning-matrix__group-label"
                key={span.id}
                style={{ gridRow: `${span.start} / span ${span.span}` }}
              >
                {span.label}
              </div>
            ))}

            {data.rows.map((row, index) => (
              <div
                className="planning-matrix__row-label"
                key={row.id}
                style={{ gridRow: index + 2 }}
              >
                {row.label}
              </div>
            ))}

            {data.rows.map((row, index) => (
              <div
                className="planning-matrix__cells"
                key={`${row.id}:cells`}
                style={{ gridRow: index + 2 }}
              >
                {data.periods.map((period) => (
                  <div className="planning-matrix__cell" key={period.id} />
                ))}
                {(barsByRow.get(row.id) ?? []).map((bar) => (
                  <button
                    key={bar.id}
                    className="planning-matrix__bar"
                    style={{
                      gridColumn: `${bar.startIndex + 1} / span ${bar.span}`,
                      '--planning-progress': `${bar.progress ?? 0}%`,
                    } as CSSProperties}
                    onClick={() => setSelectedTaskId(bar.taskId ?? null)}
                    title={bar.label}
                  >
                    {bar.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {data && data.hiddenNoDateCount > 0 && (
        <p className="gantt-view__hidden-info">
          Скрыто задач без дат: {data.hiddenNoDateCount}
        </p>
      )}

      {selectedTask && (
        <aside className="planning-details planning-details--side">
          <div className="planning-details__header">
            <h2 className="planning-details__title">#{selectedTask.id} {selectedTask.subject}</h2>
            <button
              className="planning-details__close"
              onClick={() => setSelectedTaskId(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <dl className="planning-details__grid">
            <div>
              <dt>Проект</dt>
              <dd>{selectedProject?.name ?? selectedTask.projectId ?? '—'}</dd>
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
              <dt>Прогресс</dt>
              <dd>{selectedTask.progress}%</dd>
            </div>
          </dl>
          <div className="planning-details__actions">
            <label className="planning-details__field">
              <span>Новая дата окончания</span>
              <input
                className="planning-details__input"
                type="date"
                value={approvalDue}
                onChange={(event) => {
                  setApprovalDue(event.target.value);
                  setApprovalMessage(null);
                }}
              />
            </label>
            <button
              className="planning-details__submit"
              disabled={approvalSaving || !approvalDue}
              onClick={createApproval}
            >
              {approvalSaving ? 'Отправка...' : 'Отправить на согласование'}
            </button>
            {approvalMessage && (
              <p className="planning-details__message">{approvalMessage}</p>
            )}
          </div>
        </aside>
      )}
    </section>
  );
}
