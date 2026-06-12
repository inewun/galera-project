import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Spinner } from '../../components/Spinner';
import { dataSource } from '../../core/datasource';
import type { ApprovalRequest } from '../../core/types';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; requests: ApprovalRequest[] };

type ApprovalViewMode = 'pending' | 'archive';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function daysBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
}

function formatShift(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'без сдвига';
  return days > 0 ? `+${days} дн.` : `${days} дн.`;
}

function statusLabel(status: ApprovalRequest['status']): string {
  if (status === 'approved') return 'Согласовано';
  if (status === 'rejected') return 'Отклонено';
  return 'На согласовании';
}

function buildTopCounts(requests: ApprovalRequest[], key: 'projectName' | 'groupName' | 'departmentName') {
  const counts = new Map<string, number>();
  for (const request of requests) {
    const label = request[key] || 'Не указано';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);
}

export function ApprovalsView() {
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [viewMode, setViewMode] = useState<ApprovalViewMode>('pending');
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setActionError(null);
    try {
      const requests = await dataSource.getApprovalRequests();
      setState({ status: 'loaded', requests });
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

  const { pendingRequests, archivedRequests, archiveAnalytics } = useMemo(() => {
    const requests = state.status === 'loaded' ? state.requests : [];
    const pending = requests.filter((request) => request.status === 'pending');
    const archived = requests
      .filter((request) => request.status !== 'pending')
      .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));

    const shifts = archived
      .map((request) => daysBetween(request.currentDue, request.proposedDue))
      .filter((value): value is number => value !== null);
    const approved = archived.filter((request) => request.status === 'approved');
    const rejected = archived.filter((request) => request.status === 'rejected');
    const postponed = shifts.filter((days) => days > 0).length;
    const pulledEarlier = shifts.filter((days) => days < 0).length;
    const averageShift = shifts.length > 0
      ? Math.round(shifts.reduce((sum, days) => sum + days, 0) / shifts.length)
      : null;
    const maxShiftRequest = archived
      .map((request) => ({
        request,
        shift: daysBetween(request.currentDue, request.proposedDue),
      }))
      .filter((item): item is { request: ApprovalRequest; shift: number } => item.shift !== null)
      .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))[0] ?? null;

    return {
      pendingRequests: pending,
      archivedRequests: archived,
      archiveAnalytics: {
        approved: approved.length,
        rejected: rejected.length,
        postponed,
        pulledEarlier,
        averageShift,
        maxShiftRequest,
        topProjects: buildTopCounts(archived, 'projectName'),
        topGroups: buildTopCounts(archived, 'groupName'),
        topDepartments: buildTopCounts(archived, 'departmentName'),
      },
    };
  }, [state]);

  const decide = async (requestId: string, decision: 'approve' | 'reject') => {
    if (state.status !== 'loaded') return;
    setActionError(null);

    try {
      const updated =
        decision === 'approve'
          ? await dataSource.approveApprovalRequest(requestId)
          : await dataSource.rejectApprovalRequest(requestId);

      setState({
        status: 'loaded',
        requests: state.requests.map((request) =>
          request.id === updated.id ? updated : request,
        ),
      });
      setViewMode('archive');
    } catch (err) {
      setActionError((err as Error).message || 'Ошибка сохранения решения');
    }
  };

  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />;

  const visibleRequests = viewMode === 'pending' ? pendingRequests : archivedRequests;

  return (
    <section className="approvals">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Согласование</h1>
          <p className="page-header__subtitle">Заявки на изменение дат задач, архив решений и аналитика переносов</p>
        </div>
      </header>

      <div className="approvals__tabs" aria-label="Режим согласования">
        <button
          className={'approvals__tab' + (viewMode === 'pending' ? ' approvals__tab--active' : '')}
          onClick={() => setViewMode('pending')}
        >
          На согласовании
          <span>{pendingRequests.length}</span>
        </button>
        <button
          className={'approvals__tab' + (viewMode === 'archive' ? ' approvals__tab--active' : '')}
          onClick={() => setViewMode('archive')}
        >
          Архив
          <span>{archivedRequests.length}</span>
        </button>
      </div>

      {actionError && (
        <div className="structure__toast structure__toast--error">
          {actionError}
        </div>
      )}

      {viewMode === 'archive' && (
        <section className="approvals-report">
          <div className="approvals-report__stats">
            <article className="approvals-report__stat">
              <span>Согласовано</span>
              <strong>{archiveAnalytics.approved}</strong>
            </article>
            <article className="approvals-report__stat">
              <span>Отклонено</span>
              <strong>{archiveAnalytics.rejected}</strong>
            </article>
            <article className="approvals-report__stat">
              <span>Средний сдвиг</span>
              <strong>{formatShift(archiveAnalytics.averageShift)}</strong>
            </article>
            <article className="approvals-report__stat">
              <span>Позже / раньше</span>
              <strong>{archiveAnalytics.postponed} / {archiveAnalytics.pulledEarlier}</strong>
            </article>
          </div>

          <div className="approvals-report__grid">
            <article className="approvals-report__panel">
              <h2>Где чаще переносили</h2>
              <dl>
                {archiveAnalytics.topDepartments.map(([label, count]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
              </dl>
            </article>
            <article className="approvals-report__panel">
              <h2>Проекты</h2>
              <dl>
                {archiveAnalytics.topProjects.map(([label, count]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
              </dl>
            </article>
            <article className="approvals-report__panel">
              <h2>Отделы</h2>
              <dl>
                {archiveAnalytics.topGroups.map(([label, count]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>

          {archiveAnalytics.maxShiftRequest && (
            <p className="approvals-report__note">
              Самый заметный перенос: #{archiveAnalytics.maxShiftRequest.request.taskId}{' '}
              {archiveAnalytics.maxShiftRequest.request.taskSubject} на{' '}
              {formatShift(archiveAnalytics.maxShiftRequest.shift)}.
            </p>
          )}
        </section>
      )}

      {visibleRequests.length === 0 ? (
        <EmptyState
          message={viewMode === 'pending'
            ? 'Нет заявок на согласование'
            : 'В архиве пока нет завершённых заявок'}
        />
      ) : (
        <div className="approvals__list">
          {visibleRequests.map((request) => (
            <article className="approvals__card" key={request.id}>
              <div className="approvals__info">
                <h2 className="approvals__task">
                  #{request.taskId} {request.taskSubject}
                  {request.status !== 'pending' && (
                    <span className={'approvals__status approvals__status--' + request.status}>
                      {statusLabel(request.status)}
                    </span>
                  )}
                </h2>
                <dl className="approvals__details">
                  <div>
                    <dt>Отдел</dt>
                    <dd>{request.groupName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Департамент</dt>
                    <dd>{request.departmentName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Проект</dt>
                    <dd>{request.projectName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Текущее время</dt>
                    <dd>{formatDate(request.currentDue)}</dd>
                  </div>
                  <div>
                    <dt>Новое время</dt>
                    <dd>{formatDate(request.proposedDue)}</dd>
                  </div>
                  <div>
                    <dt>Сдвиг</dt>
                    <dd>{formatShift(daysBetween(request.currentDue, request.proposedDue))}</dd>
                  </div>
                  <div>
                    <dt>Создано</dt>
                    <dd>{formatDate(request.createdAt)}</dd>
                  </div>
                  {request.status !== 'pending' && (
                    <div>
                      <dt>Решено</dt>
                      <dd>{formatDate(request.decidedAt)}</dd>
                    </div>
                  )}
                </dl>
              </div>
              {request.status === 'pending' && (
                <div className="approvals__actions">
                  <button
                    className="approvals__action-btn approvals__action-btn--accept"
                    onClick={() => decide(request.id, 'approve')}
                    aria-label="Принять заявку"
                    title="Принять"
                  >
                    ✓
                  </button>
                  <button
                    className="approvals__action-btn approvals__action-btn--reject"
                    onClick={() => decide(request.id, 'reject')}
                    aria-label="Отклонить заявку"
                    title="Отклонить"
                  >
                    ×
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
