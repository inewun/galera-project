import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Spinner } from '../../components/Spinner';
import { dataSource } from '../../core/datasource';
import type { Group, HierarchyMap, Project, Task, User } from '../../core/types';

type TimeScale = 'month' | 'week' | 'day';
type SliceMode = 'projects' | 'group-tasks' | 'people-tasks';

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
  projectStart?: string | null;
  projectEnd?: string | null;
  isEmpty?: boolean;
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
  todayIndex: number | null;
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

interface BuildContext {
  groups: Group[];
  hierarchy: HierarchyMap;
  projects: Project[];
  tasks: Task[];
  users: User[];
  periods: Period[];
  projectId: string;
  departmentId: string;
  officeId: string;
  showEmpty: boolean;
  selectedGroupTaskId: string;
}

const scales: Array<{ id: TimeScale; label: string }> = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: 'Неделя' },
  { id: 'day', label: 'День' },
];

const slices: Array<{ id: SliceMode; label: string }> = [
  { id: 'projects', label: 'Проекты' },
  { id: 'group-tasks', label: 'Задачи групп' },
  { id: 'people-tasks', label: 'Задачи людей' },
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

const MIN_PERIODS: Record<TimeScale, number> = {
  month: 24,
  week: 52,
  day: 90,
};

const MAX_PERIODS: Record<TimeScale, number> = {
  month: 60,
  week: 156,
  day: 366,
};

const RANGE_PADDING_BEFORE: Record<TimeScale, number> = {
  month: 2,
  week: 4,
  day: 14,
};

const RANGE_PADDING_AFTER: Record<TimeScale, number> = {
  month: 6,
  week: 12,
  day: 30,
};

const DEFAULT_CELL_WIDTH = 132;

function addScale(date: Date, scale: TimeScale, count: number): Date {
  if (scale === 'month') return addMonths(date, count);
  if (scale === 'week') return addWeeks(date, count);
  return addDays(date, count);
}

function startOfScale(date: Date, scale: TimeScale): Date {
  if (scale === 'month') return startOfMonth(date);
  if (scale === 'week') return startOfWeek(date);
  return startOfDay(date);
}

function periodCount(start: Date, end: Date, scale: TimeScale): number {
  let cursor = new Date(start);
  let count = 0;
  while (cursor < end && count < MAX_PERIODS[scale]) {
    cursor = addScale(cursor, scale, 1);
    count += 1;
  }
  return count;
}

function buildTimelineBounds(scale: TimeScale, tasks: Task[]): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const ranges = tasks
    .map(taskRange)
    .filter((range): range is { start: Date; end: Date } => range !== null);

  const minDate = ranges.reduce((min, range) => (range.start < min ? range.start : min), today);
  const maxDate = ranges.reduce((max, range) => (range.end > max ? range.end : max), today);

  let start = addScale(startOfScale(minDate, scale), scale, -RANGE_PADDING_BEFORE[scale]);
  let end = addScale(startOfScale(maxDate, scale), scale, RANGE_PADDING_AFTER[scale] + 1);

  while (periodCount(start, end, scale) < MIN_PERIODS[scale]) {
    end = addScale(end, scale, 1);
  }

  if (periodCount(start, end, scale) > MAX_PERIODS[scale]) {
    const centeredOnToday = startOfScale(today, scale);
    start = addScale(centeredOnToday, scale, -Math.floor(MAX_PERIODS[scale] / 3));
    end = addScale(start, scale, MAX_PERIODS[scale]);
  }

  return { start, end };
}

function buildPeriods(scale: TimeScale, start: Date, end: Date): Period[] {
  const periods: Period[] = [];
  let cursor = new Date(start);

  while (cursor < end && periods.length < MAX_PERIODS[scale]) {
    const periodStart = new Date(cursor);
    const periodEnd = addScale(periodStart, scale, 1);
    const idPrefix = scale === 'month' ? 'm' : scale === 'week' ? 'w' : 'd';
    const label = scale === 'month'
      ? new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' }).format(periodStart)
      : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(periodStart);

    periods.push({
      id: `${idPrefix}-${periodStart.toISOString()}`,
      label,
      start: periodStart,
      end: periodEnd,
    });
    cursor = periodEnd;
  }

  return periods;
}

function formatDate(value: string | null): string {
  if (value === null) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function taskRange(task: Task): { start: Date; end: Date } | null {
  if (task.start === null && task.due === null) return null;
  const start = startOfDay(new Date(task.start ?? task.due!));
  let end = startOfDay(new Date(task.due ?? task.start!));
  if (end < start) end = new Date(start);
  return { start, end };
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

function getTaskPeriodSpan(periods: Period[], task: Task): { startIndex: number; span: number } | null {
  const range = taskRange(task);
  if (range === null) return null;
  return getRangePeriodSpan(periods, range.start, range.end);
}

function getTodayIndex(periods: Period[]): number | null {
  const today = startOfDay(new Date());
  const index = periods.findIndex((period) => today >= period.start && today < period.end);
  return index < 0 ? null : index;
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

function isDepartment(group: Group, hierarchy: HierarchyMap): boolean {
  return hierarchy[group.id] == null;
}

function isOffice(group: Group, hierarchy: HierarchyMap): boolean {
  return hierarchy[group.id] != null;
}

function departments(groups: Group[], hierarchy: HierarchyMap): Group[] {
  return groups
    .filter((group) => isDepartment(group, hierarchy))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function offices(groups: Group[], hierarchy: HierarchyMap, departmentId = 'all'): Group[] {
  return groups
    .filter((group) => {
      if (!isOffice(group, hierarchy)) return false;
      return departmentId === 'all' || hierarchy[group.id] === departmentId;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function officeIdsForUser(userId: string, groups: Group[], hierarchy: HierarchyMap): string[] {
  return offices(groups, hierarchy)
    .filter((group) => group.memberIds.includes(userId))
    .map((group) => group.id);
}

function departmentIdForOffice(officeId: string, hierarchy: HierarchyMap): string | null {
  return hierarchy[officeId] ?? null;
}

function departmentIdsForTask(task: Task, groups: Group[], hierarchy: HierarchyMap): string[] {
  if (task.assigneeType === 'group' && task.assigneeId !== null) {
    const assignedGroup = groups.find((group) => group.id === task.assigneeId);
    if (!assignedGroup) return [];
    return isDepartment(assignedGroup, hierarchy)
      ? [assignedGroup.id]
      : [hierarchy[assignedGroup.id]].filter((id): id is string => Boolean(id));
  }

  if (task.assigneeType === 'user' && task.assigneeId !== null) {
    return [
      ...new Set(
        officeIdsForUser(task.assigneeId, groups, hierarchy)
          .map((officeId) => departmentIdForOffice(officeId, hierarchy))
          .filter((id): id is string => id !== null),
      ),
    ];
  }

  return [];
}

function officeIdsForGroupTask(task: Task, groups: Group[], hierarchy: HierarchyMap): string[] {
  if (task.assigneeType !== 'group' || task.assigneeId === null) return [];
  const assignedGroup = groups.find((group) => group.id === task.assigneeId);
  if (!assignedGroup) return [];

  if (isDepartment(assignedGroup, hierarchy)) {
    return offices(groups, hierarchy, assignedGroup.id).map((office) => office.id);
  }

  return [assignedGroup.id];
}

function taskMatchesProject(task: Task, projectId: string): boolean {
  return projectId === 'all' || task.projectId === projectId;
}

function isClosedTask(task: Task): boolean {
  const status = task.status.toLowerCase();
  return [
    'closed',
    'done',
    'resolved',
    'закры',
    'заверш',
    'готов',
    'выполн',
    'решен',
    'решён',
  ].some((needle) => status.includes(needle));
}

function scopedTasks(tasks: Task[], projectId: string, hideClosed: boolean): Task[] {
  return tasks.filter((task) => taskMatchesProject(task, projectId) && (!hideClosed || !isClosedTask(task)));
}

function makeData(
  leftHeader: string,
  rowHeader: string,
  rows: HorizonRow[],
  periods: Period[],
  bars: HorizonBar[],
  hiddenNoDateCount: number,
): HorizonData {
  return {
    leftHeader,
    rowHeader,
    rows,
    periods,
    bars,
    groupSpans: groupSpans(rows),
    hiddenNoDateCount,
    todayIndex: getTodayIndex(periods),
  };
}

function buildProjectsData(context: BuildContext): HorizonData {
  const { groups, hierarchy, projects, tasks, periods, projectId, departmentId, showEmpty } = context;
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const visibleDepartments = departments(groups, hierarchy).filter(
    (department) => departmentId === 'all' || department.id === departmentId,
  );
  const tasksByDepartmentProject = new Map<string, Task[]>();
  let hiddenNoDateCount = 0;

  for (const task of tasks) {
    if (!taskMatchesProject(task, projectId) || task.projectId === null) continue;
    if (task.start === null && task.due === null) hiddenNoDateCount += 1;
    for (const taskDepartmentId of departmentIdsForTask(task, groups, hierarchy)) {
      if (!visibleDepartments.some((department) => department.id === taskDepartmentId)) continue;
      const key = `${taskDepartmentId}:${task.projectId}`;
      tasksByDepartmentProject.set(key, [...(tasksByDepartmentProject.get(key) ?? []), task]);
    }
  }

  const rows: HorizonRow[] = [];
  const bars: HorizonBar[] = [];

  for (const department of visibleDepartments) {
    const projectIds = [...new Set(
      [...tasksByDepartmentProject.keys()]
        .filter((key) => key.startsWith(`${department.id}:`))
        .map((key) => key.split(':')[1]),
    )].sort((a, b) => (projectById.get(a)?.name ?? a).localeCompare(projectById.get(b)?.name ?? b));

    if (projectIds.length === 0 && showEmpty) {
      rows.push({
        id: `${department.id}:empty`,
        groupId: department.id,
        groupLabel: department.name,
        label: 'Нет проектов в выбранном периоде',
        isEmpty: true,
      });
      continue;
    }

    for (const rowProjectId of projectIds) {
      const project = projectById.get(rowProjectId);
      const rowId = `${department.id}:${rowProjectId}`;
      const ranges = (tasksByDepartmentProject.get(rowId) ?? [])
        .map(taskRange)
        .filter((range): range is { start: Date; end: Date } => range !== null);
      const start = ranges.length > 0
        ? ranges.reduce((min, range) => (range.start < min ? range.start : min), ranges[0].start)
        : null;
      const end = ranges.length > 0
        ? ranges.reduce((max, range) => (range.end > max ? range.end : max), ranges[0].end)
        : null;

      rows.push({
        id: rowId,
        groupId: department.id,
        groupLabel: department.name,
        label: project?.name ?? `Проект #${rowProjectId}`,
        projectId: rowProjectId,
        projectStart: start?.toISOString() ?? null,
        projectEnd: end?.toISOString() ?? null,
      });

      if (start === null || end === null) continue;

      const span = getRangePeriodSpan(periods, start, end);
      if (span === null) continue;

      bars.push({
        id: rowId,
        rowId,
        label: project?.name ?? `Проект #${rowProjectId}`,
        startIndex: span.startIndex,
        span: span.span,
        projectId: rowProjectId,
        progress: 100,
      });
    }
  }

  return makeData('Департамент', 'Проект', rows, periods, bars, hiddenNoDateCount);
}

function buildGroupTasksData(context: BuildContext): HorizonData {
  const { groups, hierarchy, tasks, periods, departmentId, officeId, showEmpty } = context;
  const departmentById = new Map(departments(groups, hierarchy).map((department) => [department.id, department]));
  const visibleOffices = offices(groups, hierarchy, departmentId).filter(
    (office) => officeId === 'all' || office.id === officeId,
  );
  const visibleOfficeIds = new Set(visibleOffices.map((office) => office.id));
  const tasksByOffice = new Map<string, Task[]>();
  let hiddenNoDateCount = 0;

  for (const task of tasks) {
    if (task.assigneeType !== 'group') continue;
    if (task.start === null && task.due === null) hiddenNoDateCount += 1;
    for (const taskOfficeId of officeIdsForGroupTask(task, groups, hierarchy)) {
      if (!visibleOfficeIds.has(taskOfficeId)) continue;
      tasksByOffice.set(taskOfficeId, [...(tasksByOffice.get(taskOfficeId) ?? []), task]);
    }
  }

  const rows: HorizonRow[] = [];
  const bars: HorizonBar[] = [];

  for (const office of visibleOffices) {
    const officeDepartmentId = departmentIdForOffice(office.id, hierarchy);
    const department = officeDepartmentId ? departmentById.get(officeDepartmentId) : null;
    const officeTasks = [...(tasksByOffice.get(office.id) ?? [])]
      .sort((a, b) => a.subject.localeCompare(b.subject));

    if (officeTasks.length === 0 && showEmpty) {
      rows.push({
        id: `${office.id}:empty`,
        groupId: officeDepartmentId ?? office.id,
        groupLabel: department?.name ?? 'Без департамента',
        label: `${office.name} · Нет задач`,
        isEmpty: true,
      });
      continue;
    }

    for (const task of officeTasks) {
      const rowId = `${office.id}:${task.id}`;
      rows.push({
        id: rowId,
        groupId: officeDepartmentId ?? office.id,
        groupLabel: department?.name ?? 'Без департамента',
        label: `${office.name} · ${task.subject}`,
        taskId: task.id,
        projectId: task.projectId ?? undefined,
      });

      const span = getTaskPeriodSpan(periods, task);
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

  return makeData('Департамент', 'Отдел · задача', rows, periods, bars, hiddenNoDateCount);
}

function buildPeopleTasksData(context: BuildContext): HorizonData {
  const { groups, hierarchy, users, tasks, periods, departmentId, officeId, showEmpty, selectedGroupTaskId } = context;
  const userById = new Map(users.map((user) => [user.id, user]));
  const visibleOffices = offices(groups, hierarchy, departmentId).filter(
    (office) => officeId === 'all' || office.id === officeId,
  );
  const visibleOfficeIds = new Set(visibleOffices.map((office) => office.id));
  const tasksByOffice = new Map<string, Task[]>();
  let hiddenNoDateCount = 0;

  for (const task of tasks) {
    if (task.assigneeType !== 'user' || task.assigneeId === null) continue;
    if (selectedGroupTaskId !== 'all' && task.parentId !== selectedGroupTaskId) continue;
    if (task.start === null && task.due === null) hiddenNoDateCount += 1;

    for (const taskOfficeId of officeIdsForUser(task.assigneeId, groups, hierarchy)) {
      if (!visibleOfficeIds.has(taskOfficeId)) continue;
      tasksByOffice.set(taskOfficeId, [...(tasksByOffice.get(taskOfficeId) ?? []), task]);
    }
  }

  const rows: HorizonRow[] = [];
  const bars: HorizonBar[] = [];

  for (const office of visibleOffices) {
    const officeTasks = [...(tasksByOffice.get(office.id) ?? [])].sort((a, b) => {
      const userA = a.assigneeId ? userById.get(a.assigneeId)?.name ?? '' : '';
      const userB = b.assigneeId ? userById.get(b.assigneeId)?.name ?? '' : '';
      return userA.localeCompare(userB) || a.subject.localeCompare(b.subject);
    });

    if (officeTasks.length === 0 && showEmpty) {
      rows.push({
        id: `${office.id}:empty`,
        groupId: office.id,
        groupLabel: office.name,
        label: 'Нет задач сотрудников',
        isEmpty: true,
      });
      continue;
    }

    for (const task of officeTasks) {
      const user = task.assigneeId ? userById.get(task.assigneeId) : null;
      const rowId = `${office.id}:${task.id}`;
      rows.push({
        id: rowId,
        groupId: office.id,
        groupLabel: office.name,
        label: `${user?.name ?? 'Без сотрудника'} · ${task.subject}`,
        taskId: task.id,
        projectId: task.projectId ?? undefined,
      });

      const span = getTaskPeriodSpan(periods, task);
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

  return makeData('Отдел', 'Сотрудник · задача', rows, periods, bars, hiddenNoDateCount);
}

function assigneeLabel(task: Task, groups: Group[], users: User[]): string {
  if (task.assigneeType === 'group' && task.assigneeId !== null) {
    return groups.find((group) => group.id === task.assigneeId)?.name ?? `Группа #${task.assigneeId}`;
  }
  if (task.assigneeType === 'user' && task.assigneeId !== null) {
    return users.find((user) => user.id === task.assigneeId)?.name ?? `Пользователь #${task.assigneeId}`;
  }
  return '-';
}

export function PlanningHorizonsView() {
  const [slice, setSlice] = useState<SliceMode>('projects');
  const [scale, setScale] = useState<TimeScale>('month');
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const planningRef = useRef<HTMLElement | null>(null);
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollbarRef = useRef<HTMLDivElement | null>(null);
  const previousGridWidthRef = useRef<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('all');
  const [selectedOfficeId, setSelectedOfficeId] = useState('all');
  const [selectedGroupTaskId, setSelectedGroupTaskId] = useState('all');
  const [showEmpty, setShowEmpty] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedProjectRows, setExpandedProjectRows] = useState<Set<string>>(() => new Set());
  const [timelineScrollbarWidth, setTimelineScrollbarWidth] = useState(0);

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
    setSelectedTaskId(null);
  }, [scale]);

  useEffect(() => {
    setSelectedTaskId(null);
    setSelectedGroupTaskId('all');
  }, [slice, selectedProjectId, selectedDepartmentId, selectedOfficeId]);

  const loaded = state.status === 'loaded' ? state : null;
  const departmentOptions = useMemo(
    () => (loaded ? departments(loaded.groups, loaded.hierarchy) : []),
    [loaded],
  );
  const officeOptions = useMemo(
    () => (loaded ? offices(loaded.groups, loaded.hierarchy, selectedDepartmentId) : []),
    [loaded, selectedDepartmentId],
  );
  const scoped = useMemo(
    () => (loaded ? scopedTasks(loaded.tasks, selectedProjectId, true) : []),
    [loaded, selectedProjectId],
  );
  const timelineBounds = useMemo(() => buildTimelineBounds(scale, scoped), [scale, scoped]);
  const periods = useMemo(
    () => buildPeriods(scale, timelineBounds.start, timelineBounds.end),
    [scale, timelineBounds],
  );

  const groupTaskOptions = useMemo(() => {
    if (!loaded) return [];
    const taskOfficeIds = new Set(officeOptions.map((office) => office.id));
    return scoped
      .filter((task) => task.assigneeType === 'group')
      .filter((task) => officeIdsForGroupTask(task, loaded.groups, loaded.hierarchy).some((officeId) => taskOfficeIds.has(officeId)))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [loaded, officeOptions, scoped]);

  useEffect(() => {
    if (selectedGroupTaskId !== 'all' && !groupTaskOptions.some((task) => task.id === selectedGroupTaskId)) {
      setSelectedGroupTaskId('all');
    }
  }, [groupTaskOptions, selectedGroupTaskId]);

  const data = useMemo<HorizonData | null>(() => {
    if (!loaded) return null;
    const context: BuildContext = {
      groups: loaded.groups,
      hierarchy: loaded.hierarchy,
      projects: loaded.projects,
      tasks: scoped,
      users: loaded.users,
      periods,
      projectId: selectedProjectId,
      departmentId: selectedDepartmentId,
      officeId: selectedOfficeId,
      showEmpty,
      selectedGroupTaskId,
    };

    if (slice === 'projects') return buildProjectsData(context);
    if (slice === 'group-tasks') return buildGroupTasksData(context);
    return buildPeopleTasksData(context);
  }, [loaded, periods, scoped, selectedDepartmentId, selectedGroupTaskId, selectedOfficeId, selectedProjectId, showEmpty, slice]);

  const barsByRow = useMemo(() => {
    return (data?.bars ?? []).reduce((map, bar) => {
      map.set(bar.rowId, [...(map.get(bar.rowId) ?? []), bar]);
      return map;
    }, new Map<string, HorizonBar[]>());
  }, [data]);

  const selectedTask = loaded && selectedTaskId
    ? loaded.tasks.find((task) => task.id === selectedTaskId) ?? null
    : null;
  const selectedProject = loaded && selectedTask?.projectId
    ? loaded.projects.find((project) => project.id === selectedTask.projectId) ?? null
    : null;
  const selectedParent = loaded && selectedTask?.parentId
    ? loaded.tasks.find((task) => task.id === selectedTask.parentId) ?? null
    : null;

  const scrollToToday = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const wrap = gridWrapRef.current;
    const scrollbar = timelineScrollbarRef.current;
    if (!wrap || data?.todayIndex === null || data?.todayIndex === undefined) return;

    const styles = window.getComputedStyle(wrap.querySelector<HTMLElement>('.planning-matrix') ?? wrap);
    const cellWidth = Number.parseFloat(styles.getPropertyValue('--planning-cell-width')) || DEFAULT_CELL_WIDTH;
    const visibleTimelineWidth = Math.max(scrollbar?.clientWidth ?? wrap.clientWidth, cellWidth);
    const todayCenter = data.todayIndex * cellWidth + cellWidth / 2;
    const left = Math.max(0, todayCenter - visibleTimelineWidth / 2);

    wrap.scrollTo({
      left,
      behavior,
    });
    scrollbar?.scrollTo({
      left,
      behavior,
    });
  }, [data?.todayIndex]);

  const updateTimelineScrollbar = useCallback(() => {
    const wrap = gridWrapRef.current;
    const scrollbar = timelineScrollbarRef.current;
    if (!wrap || !scrollbar) return;

    const maxScrollLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    setTimelineScrollbarWidth(scrollbar.clientWidth + maxScrollLeft);
    scrollbar.scrollLeft = wrap.scrollLeft;
  }, []);

  useEffect(() => {
    const planning = planningRef.current;
    const wrap = gridWrapRef.current;
    const scrollbar = timelineScrollbarRef.current;
    if (!planning || !wrap || !scrollbar) return undefined;

    let syncing = false;

    const syncScrollbar = () => {
      if (syncing) return;
      syncing = true;
      scrollbar.scrollLeft = wrap.scrollLeft;
      syncing = false;
    };

    const syncGrid = () => {
      if (syncing) return;
      syncing = true;
      wrap.scrollLeft = scrollbar.scrollLeft;
      syncing = false;
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement
        && target.closest('select, input, textarea, button, .planning-details')
      ) {
        return;
      }

      const maxScrollLeft = wrap.scrollWidth - wrap.clientWidth;
      if (maxScrollLeft <= 0) return;

      const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (horizontalDelta === 0) return;

      const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? wrap.clientWidth : 1;
      wrap.scrollLeft += horizontalDelta * multiplier;
      scrollbar.scrollLeft = wrap.scrollLeft;
      event.preventDefault();
    };

    updateTimelineScrollbar();
    planning.addEventListener('wheel', handleWheel, { passive: false });
    wrap.addEventListener('scroll', syncScrollbar);
    scrollbar.addEventListener('scroll', syncGrid);
    return () => {
      planning.removeEventListener('wheel', handleWheel);
      wrap.removeEventListener('scroll', syncScrollbar);
      scrollbar.removeEventListener('scroll', syncGrid);
    };
  }, [data?.periods.length, data?.rows.length, updateTimelineScrollbar]);

  useEffect(() => {
    const wrap = gridWrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;

    previousGridWidthRef.current = wrap.clientWidth;
    updateTimelineScrollbar();
    const observer = new ResizeObserver(() => {
      const previousWidth = previousGridWidthRef.current;
      const nextWidth = wrap.clientWidth;
      if (previousWidth === null || previousWidth === nextWidth) {
        previousGridWidthRef.current = nextWidth;
        return;
      }

      const center = wrap.scrollLeft + previousWidth / 2;
      window.requestAnimationFrame(() => {
        wrap.scrollLeft = Math.max(0, center - nextWidth / 2);
        previousGridWidthRef.current = nextWidth;
        updateTimelineScrollbar();
      });
    });

    observer.observe(wrap);
    return () => observer.disconnect();
  }, [updateTimelineScrollbar]);

  useEffect(() => {
    window.requestAnimationFrame(() => scrollToToday('auto'));
  }, [scale, scrollToToday]);

  useEffect(() => {
    window.requestAnimationFrame(updateTimelineScrollbar);
  }, [data?.periods.length, data?.rows.length, updateTimelineScrollbar]);

  useEffect(() => {
    if (slice !== 'projects') {
      setExpandedProjectRows(new Set());
    }
  }, [slice]);

  const toggleProjectRow = useCallback((rowId: string) => {
    setExpandedProjectRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const rangeStart = data?.periods[0]?.start ?? timelineBounds.start;
  const rangeEnd = data?.periods[data.periods.length - 1]?.end ?? timelineBounds.end;

  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />;

  return (
    <section className="planning" ref={planningRef}>
      <header className="page-header planning__header">
        <div>
          <h1 className="page-header__title">Планировщик работ</h1>
          <p className="page-header__subtitle">Единый грид по проектам, задачам групп и задачам сотрудников</p>
        </div>
      </header>

      <div className="planning__toolbar planning__toolbar--primary">
        <label className="planning__control">
          <span>Срез</span>
          <select
            className="gantt-view__select"
            value={slice}
            onChange={(event) => setSlice(event.target.value as SliceMode)}
          >
            {slices.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        <div className="planning__horizon-switch" aria-label="Масштаб времени">
          {scales.map((item) => (
            <button
              key={item.id}
              className={'planning__mode-btn' + (scale === item.id ? ' planning__mode-btn--active' : '')}
              onClick={() => setScale(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="planning__timeline-actions">
          <span className="planning__range">
            {formatDate(rangeStart.toISOString())} - {formatDate(rangeEnd.toISOString())}
          </span>
          <button
            className="planning__today-btn"
            onClick={() => {
              setSelectedTaskId(null);
              scrollToToday('auto');
            }}
          >
            Сегодня
          </button>
        </div>
      </div>

      <div className="planning__toolbar planning__toolbar--filters">
        <label className="planning__control">
          <span>Проект</span>
          <select
            className="gantt-view__select"
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="all">Все проекты</option>
            {state.projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>

        <label className="planning__control">
          <span>Департамент</span>
          <select
            className="gantt-view__select"
            value={selectedDepartmentId}
            onChange={(event) => {
              setSelectedDepartmentId(event.target.value);
              setSelectedOfficeId('all');
            }}
          >
            <option value="all">Все департаменты</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>

        {slice !== 'projects' && (
          <label className="planning__control">
            <span>Отдел</span>
            <select
              className="gantt-view__select"
              value={selectedOfficeId}
              onChange={(event) => setSelectedOfficeId(event.target.value)}
            >
              <option value="all">Все отделы</option>
              {officeOptions.map((office) => (
                <option key={office.id} value={office.id}>{office.name}</option>
              ))}
            </select>
          </label>
        )}

        {slice === 'people-tasks' && (
          <label className="planning__control planning__control--wide">
            <span>Задача группы</span>
            <select
              className="gantt-view__select"
              value={selectedGroupTaskId}
              onChange={(event) => setSelectedGroupTaskId(event.target.value)}
            >
              <option value="all">Все задачи</option>
              {groupTaskOptions.map((task) => (
                <option key={task.id} value={task.id}>#{task.id} {task.subject}</option>
              ))}
            </select>
          </label>
        )}

        <label className="planning__toggle">
          <input
            type="checkbox"
            checked={showEmpty}
            onChange={(event) => setShowEmpty(event.target.checked)}
          />
          <span>Показать пустые</span>
        </label>

      </div>

      {data === null || data.rows.length === 0 ? (
        <EmptyState message="Нет данных для выбранных фильтров" />
      ) : (
        <>
          <div className="planning__grid-wrap" ref={gridWrapRef}>
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
              <div
                className="planning-matrix__timeline-grid"
                style={{ gridRow: `2 / span ${data.rows.length}` }}
              />

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
                  className={[
                    'planning-matrix__row-label',
                    row.isEmpty ? 'planning-matrix__row-label--empty' : '',
                    expandedProjectRows.has(row.id) ? 'planning-matrix__row-label--expanded' : '',
                  ].filter(Boolean).join(' ')}
                  key={row.id}
                  style={{ gridRow: index + 2 }}
                >
                  {slice === 'projects' && row.projectId ? (
                    <div className="planning-matrix__project-row">
                      <button
                        className="planning-matrix__project-toggle"
                        type="button"
                        onClick={() => toggleProjectRow(row.id)}
                        aria-expanded={expandedProjectRows.has(row.id)}
                      >
                        <span className="planning-matrix__project-chevron">
                          {expandedProjectRows.has(row.id) ? '▾' : '▸'}
                        </span>
                        <span>{row.label}</span>
                      </button>
                    </div>
                  ) : (
                    row.label
                  )}
                </div>
              ))}

              {data.rows.map((row, index) => (
                <div
                  className={'planning-matrix__cells' + (expandedProjectRows.has(row.id) ? ' planning-matrix__cells--expanded' : '')}
                  key={`${row.id}:cells`}
                  style={{ gridRow: index + 2 }}
                >
                  {data.periods.map((period) => (
                    <div className="planning-matrix__cell" key={period.id} />
                  ))}
                  {(barsByRow.get(row.id) ?? []).map((bar) => (
                    <button
                      key={bar.id}
                      className={[
                        'planning-matrix__bar',
                        slice === 'projects' ? 'planning-matrix__bar--project' : '',
                        expandedProjectRows.has(row.id) ? 'planning-matrix__bar--expanded' : '',
                      ].filter(Boolean).join(' ')}
                      style={{
                        gridColumn: `${bar.startIndex + 1} / span ${bar.span}`,
                        '--planning-progress': `${bar.progress ?? 0}%`,
                      } as CSSProperties}
                      onClick={() => {
                        if (slice === 'projects') {
                          toggleProjectRow(row.id);
                        } else {
                          setSelectedTaskId(bar.taskId ?? null);
                        }
                      }}
                      title={bar.label}
                    >
                      <span>{bar.label}</span>
                      {slice === 'projects' && expandedProjectRows.has(row.id) && (
                        <span className="planning-matrix__bar-dates">
                          {formatDate(row.projectStart ?? null)} - {formatDate(row.projectEnd ?? null)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
              {data.todayIndex !== null && (
                <div
                  className="planning-matrix__today-bg"
                  style={{
                    gridColumn: `${data.todayIndex + 3} / span 1`,
                    gridRow: `2 / span ${data.rows.length}`,
                  }}
                />
              )}
            </div>
          </div>
          <div className="planning__timeline-scrollbar" ref={timelineScrollbarRef} aria-hidden="true">
            <div
              className="planning__timeline-scrollbar-spacer"
              style={{ width: timelineScrollbarWidth }}
            />
          </div>
        </>
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
              <dd>{selectedProject?.name ?? selectedTask.projectId ?? '-'}</dd>
            </div>
            <div>
              <dt>Исполнитель</dt>
              <dd>{assigneeLabel(selectedTask, state.groups, state.users)}</dd>
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
              <dd>{selectedTask.status || '-'}</dd>
            </div>
            <div>
              <dt>Тип</dt>
              <dd>{selectedTask.typeName || '-'}</dd>
            </div>
            <div>
              <dt>Прогресс</dt>
              <dd>{selectedTask.progress}%</dd>
            </div>
            <div>
              <dt>Родитель</dt>
              <dd>{selectedParent ? `#${selectedParent.id} ${selectedParent.subject}` : selectedTask.parentId ?? '-'}</dd>
            </div>
            <div>
              <dt>Зависимости</dt>
              <dd>{selectedTask.dependencies.length > 0 ? selectedTask.dependencies.map((id) => `#${id}`).join(', ') : '-'}</dd>
            </div>
          </dl>
        </aside>
      )}
    </section>
  );
}
