import { useEffect, useState, useCallback } from 'react';
import { dataSource } from '../core/datasource';
import type { Task, User, Group } from '../core/types';
import { Spinner } from './Spinner';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

interface OverviewData {
  tasks: Task[];
  users: User[];
  groups: Group[];
}

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasks, users, groups] = await Promise.all([
        dataSource.getTasks(),
        dataSource.getUsers(),
        dataSource.getGroups(),
      ]);
      setData({ tasks, users, groups });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState message="Нет данных" />;

  return (
    <div className="overview">
      <h1 className="overview__title">Обзор</h1>
      <ul className="overview__stats">
        <li>Задачи: {data.tasks.length}</li>
        <li>Сотрудники: {data.users.length}</li>
        <li>Группы: {data.groups.length}</li>
      </ul>
      <p className="overview__source">данные из OpenProject</p>
    </div>
  );
}
