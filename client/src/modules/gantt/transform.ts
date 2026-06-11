import type { Task as GanttTask } from 'gantt-task-react';
import type { Task, User } from '../../core/types';

export type GroupBy = 'none' | 'assignee';

/** Ограничить число отрезком [min, max] */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Новая дата, отстоящая на n дней от исходной */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Имя пользователя по id */
export function userName(users: User[], id: string | null): string {
  if (id === null) return 'Без исполнителя';
  const u = users.find((x) => x.id === id);
  return u?.name ?? 'Неизвестный';
}

/**
 * Преобразовать сырые задачи OpenProject в формат gantt-task-react.
 * @returns ganttTasks — готовые задачи для диаграммы; hiddenNoDate — задачи без start и due.
 */
export function toGanttTasks(
  tasks: Task[],
  users: User[],
  groupBy: GroupBy,
): { ganttTasks: GanttTask[]; hiddenNoDate: Task[] } {
  const hiddenNoDate = tasks.filter((t) => t.start === null && t.due === null);
  const dated = tasks.filter((t) => t.start !== null || t.due !== null);

  const datedGantt: GanttTask[] = dated.map((task) => {
    const s = new Date(task.start ?? task.due!);
    let e = new Date(task.due ?? task.start!);
    const isMilestone = task.typeName.toLowerCase().includes('milestone');

    if (isMilestone) {
      e = new Date(s);
    } else if (e <= s) {
      e = addDays(s, 1);
    }

    return {
      id: task.id,
      name: task.subject,
      start: s,
      end: e,
      progress: clamp(task.progress ?? 0, 0, 100),
      type: isMilestone ? 'milestone' : 'task',
      isDisabled: true,
      dependencies: [],
      styles: isMilestone
        ? {
            backgroundColor: '#1A67A3',
            backgroundSelectedColor: '#155389',
          }
        : {
            backgroundColor: '#9cc3e3',
            backgroundSelectedColor: '#7fb0d8',
            progressColor: '#1A67A3',
            progressSelectedColor: '#155389',
          },
    };
  });

  if (groupBy === 'none') {
    datedGantt.sort((a, b) => a.start.getTime() - b.start.getTime());
    return { ganttTasks: datedGantt, hiddenNoDate };
  }

  // groupBy === 'assignee'
  const groups = new Map<string, GanttTask[]>();
  for (const t of datedGantt) {
    const task = dated.find((dt) => dt.id === t.id);
    const key = task?.assigneeId ?? 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const result: GanttTask[] = [];
  const sortedKeys = [...groups.keys()].sort((a, b) =>
    userName(users, a === 'none' ? null : a).localeCompare(
      userName(users, b === 'none' ? null : b),
    ),
  );

  for (const key of sortedKeys) {
    const children = groups.get(key)!;
    children.sort((a, b) => a.start.getTime() - b.start.getTime());

    const minStart = children.reduce(
      (min, c) => (c.start < min ? c.start : min),
      children[0].start,
    );
    const maxEnd = children.reduce(
      (max, c) => (c.end > max ? c.end : max),
      children[0].end,
    );

    const groupTask: GanttTask = {
      id: `grp:${key}`,
      name: userName(users, key === 'none' ? null : key),
      type: 'project',
      start: minStart,
      end: maxEnd,
      progress: 0,
      hideChildren: false,
      isDisabled: true,
      dependencies: [],
      styles: {
        backgroundColor: '#5a6b7b',
        backgroundSelectedColor: '#4a5a6a',
        progressColor: '#3d4d5c',
        progressSelectedColor: '#33414e',
      },
    };

    const childrenWithProject = children.map((c) => ({
      ...c,
      project: `grp:${key}`,
    }));

    result.push(groupTask, ...childrenWithProject);
  }

  return { ganttTasks: result, hiddenNoDate };
}
