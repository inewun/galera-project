import { useEffect, useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { dataSource } from '../core/datasource';
import type { ApprovalRequest, User, Group, HierarchyMap } from '../core/types';
import { Spinner } from './Spinner';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

interface OverviewData {
  users: User[];
  groups: Group[];
  hierarchy: HierarchyMap;
  pendingApprovals: ApprovalRequest[];
}

interface StatCardProps {
  label: string;
  value: number;
  detail: string;
}

function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className="overview-card">
      <span className="overview-card__label">{label}</span>
      <strong className="overview-card__value">{value}</strong>
      <span className="overview-card__detail">{detail}</span>
    </article>
  );
}

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, groups, hierarchy, pendingApprovals] = await Promise.all([
        dataSource.getUsers(),
        dataSource.getGroups(),
        dataSource.getHierarchy(),
        dataSource.getApprovalRequests('pending'),
      ]);
      setData({ users, groups, hierarchy, pendingApprovals });
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

  const departments = data.groups.filter((group) => data.hierarchy[group.id] == null);
  const departmentsWithChildren = departments.filter((group) =>
    data.groups.some((candidate) => data.hierarchy[candidate.id] === group.id),
  );
  const units = data.groups.filter((group) => data.hierarchy[group.id] !== null);

  return (
    <div className="overview">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Главная</h1>
          <p className="page-header__subtitle">Сводка по структуре и текущим согласованиям</p>
        </div>
        <NavLink to="/approvals" className="overview__approval-link">
          +{data.pendingApprovals.length} новых согласований
        </NavLink>
      </header>

      <section className="overview-grid">
        <StatCard
          label="Департаменты"
          value={departments.length}
          detail={`${departmentsWithChildren.length} с отделами`}
        />
        <StatCard
          label="Отделы"
          value={units.length}
          detail="по локальной структуре"
        />
        <StatCard
          label="Сотрудники"
          value={data.users.length}
          detail="пользователи OpenProject"
        />
        <StatCard
          label="Согласования"
          value={data.pendingApprovals.length}
          detail="ожидают решения"
        />
      </section>

      <section className="overview-panel">
        <h2 className="overview-panel__title">Структура</h2>
        {departments.length === 0 ? (
          <EmptyState message="Департаменты ещё не настроены" />
        ) : (
          <ul className="overview-structure">
            {departments.map((department) => {
              const childCount = data.groups.filter(
                (group) => data.hierarchy[group.id] === department.id,
              ).length;
              const memberCount = data.groups
                .filter(
                  (group) =>
                    group.id === department.id ||
                    data.hierarchy[group.id] === department.id,
                )
                .reduce((sum, group) => sum + group.memberIds.length, 0);

              return (
                <li className="overview-structure__item" key={department.id}>
                  <span>{department.name}</span>
                  <span>
                    {childCount} отделов · {memberCount} сотрудников
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="overview__source">
        Источник: OpenProject + локальная структура
      </p>
    </div>
  );
}
