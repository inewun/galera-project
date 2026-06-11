import { useEffect, useState, useMemo, useCallback } from 'react';
import { ViewMode } from 'gantt-task-react';
import { dataSource } from '../../core/datasource';
import type { Task, User, Project } from '../../core/types';
import { Spinner } from '../../components/Spinner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { GanttChart } from './GanttChart';
import { toGanttTasks, type GroupBy } from './transform';

export function GanttView() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // разовая загрузка users + projects
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loadedUsers, loadedProjects] = await Promise.all([
          dataSource.getUsers(),
          dataSource.getProjects(),
        ]);
        if (!cancelled) {
          setUsers(loadedUsers);
          setProjects(
            [...loadedProjects].sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // загрузка задач при смене фильтра
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params =
        selectedProjectId === 'all'
          ? undefined
          : { projectId: selectedProjectId };
      const loadedTasks = await dataSource.getTasks(params);
      setTasks(loadedTasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const { ganttTasks, hiddenNoDate } = useMemo(
    () => toGanttTasks(tasks ?? [], users ?? [], groupBy),
    [tasks, users, groupBy],
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={loadTasks} />;

  return (
    <div className="gantt-view">
      <div className="gantt-view__toolbar">
        <select
          className="gantt-view__select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          <option value="all">Все проекты</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="gantt-view__select"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
        >
          <option value="none">Без группировки</option>
          <option value="assignee">По исполнителю</option>
        </select>

        <div className="gantt-view__view-buttons">
          {(
            [
              { label: 'День', value: ViewMode.Day },
              { label: 'Неделя', value: ViewMode.Week },
              { label: 'Месяц', value: ViewMode.Month },
            ] as const
          ).map(({ label, value }) => (
            <button
              key={value}
              className={
                'gantt-view__view-btn' +
                (viewMode === value ? ' gantt-view__view-btn--active' : '')
              }
              onClick={() => setViewMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {ganttTasks.length === 0 ? (
        <EmptyState message="Нет задач с датами для отображения" />
      ) : (
        <GanttChart tasks={ganttTasks} viewMode={viewMode} />
      )}

      {hiddenNoDate.length > 0 && (
        <p className="gantt-view__hidden-info">
          Скрыто задач без дат: {hiddenNoDate.length}
        </p>
      )}
    </div>
  );
}
