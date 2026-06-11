import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Spinner } from '../../components/Spinner';
import { dataSource } from '../../core/datasource';
import type { ApprovalRequest } from '../../core/types';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; requests: ApprovalRequest[] };

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU').format(date);
}

export function ApprovalsView() {
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setActionError(null);
    try {
      const requests = await dataSource.getApprovalRequests('pending');
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
        requests: state.requests.filter((request) => request.id !== updated.id),
      });
    } catch (err) {
      setActionError((err as Error).message || 'Ошибка сохранения решения');
    }
  };

  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />;

  return (
    <section className="approvals">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Согласование</h1>
          <p className="page-header__subtitle">Заявки на изменение дат задач</p>
        </div>
      </header>

      {actionError && (
        <div className="structure__toast structure__toast--error">
          {actionError}
        </div>
      )}

      {state.requests.length === 0 ? (
        <EmptyState message="Нет заявок на согласование" />
      ) : (
        <div className="approvals__list">
          {state.requests.map((request) => (
            <article className="approvals__card" key={request.id}>
              <div className="approvals__info">
                <h2 className="approvals__task">
                  #{request.taskId} {request.taskSubject}
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
                </dl>
              </div>
              <div className="approvals__actions">
                <button
                  className="approvals__action-btn approvals__action-btn--accept"
                  onClick={() => decide(request.id, 'approve')}
                  aria-label="Принять заявку"
                  title="Принять"
                >
                  👍
                </button>
                <button
                  className="approvals__action-btn approvals__action-btn--reject"
                  onClick={() => decide(request.id, 'reject')}
                  aria-label="Отклонить заявку"
                  title="Отклонить"
                >
                  👎
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
