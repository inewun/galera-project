import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Spinner } from '../../components/Spinner';
import { dataSource } from '../../core/datasource';
import type {
  ApprovalArchiveGroupBy,
  ApprovalArchiveResponse,
  ApprovalRequest,
  Group,
  HierarchyMap,
  Project,
} from '../../core/types';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
    status: 'loaded';
    pending: ApprovalRequest[];
    archive: ApprovalArchiveResponse;
    projects: Project[];
    groups: Group[];
    hierarchy: HierarchyMap;
  };

type ApprovalViewMode = 'pending' | 'archive';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
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
  if (days === null) return '-';
  if (days === 0) return 'без сдвига';
  return days > 0 ? `+${days} дн.` : `${days} дн.`;
}

function statusLabel(status: ApprovalRequest['status']): string {
  if (status === 'approved') return 'Согласовано';
  if (status === 'rejected') return 'Отклонено';
  return 'На согласовании';
}

function decisionComment(request: ApprovalRequest): string {
  return (request as { decisionComment?: string | null }).decisionComment || '-';
}

function monthName(month: number): string {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date(currentYear, month - 1, 1));
}

function isDepartment(group: Group, hierarchy: HierarchyMap): boolean {
  return hierarchy[group.id] == null;
}

function departments(groups: Group[], hierarchy: HierarchyMap): Group[] {
  return groups
    .filter((group) => isDepartment(group, hierarchy))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function offices(groups: Group[], hierarchy: HierarchyMap, departmentId: string): Group[] {
  return groups
    .filter((group) => !isDepartment(group, hierarchy))
    .filter((group) => departmentId === 'all' || hierarchy[group.id] === departmentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function reportTitle(groupBy: ApprovalArchiveGroupBy): string {
  if (groupBy === 'project') return 'Статистика по проектам';
  if (groupBy === 'department') return 'Статистика по департаментам';
  if (groupBy === 'group') return 'Статистика по отделам';
  return 'Статистика';
}

export function ApprovalsView() {
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [viewMode, setViewMode] = useState<ApprovalViewMode>('pending');
  const [archiveYear, setArchiveYear] = useState(currentYear);
  const [archiveMonth, setArchiveMonth] = useState<number | 'all'>(currentMonth);
  const [archiveGroupBy, setArchiveGroupBy] = useState<ApprovalArchiveGroupBy>('all');
  const [archiveStatus, setArchiveStatus] = useState<'all' | 'approved' | 'rejected'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [decisionComments, setDecisionComments] = useState<Record<string, string>>({});
  const [pruneUnit, setPruneUnit] = useState<'month' | 'year'>('year');
  const [pruneCount, setPruneCount] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setActionError(null);
    try {
      const [pending, archive, projects, groups, hierarchy] = await Promise.all([
        dataSource.getApprovalRequests('pending'),
        dataSource.getApprovalArchive({
          year: archiveYear,
          month: archiveMonth === 'all' ? undefined : archiveMonth,
          groupBy: archiveGroupBy,
          status: archiveStatus === 'all' ? undefined : archiveStatus,
          projectId: selectedProjectId === 'all' ? undefined : selectedProjectId,
          departmentId: selectedDepartmentId === 'all' ? undefined : selectedDepartmentId,
          groupId: selectedGroupId === 'all' ? undefined : selectedGroupId,
        }),
        dataSource.getProjects(),
        dataSource.getGroups(),
        dataSource.getHierarchy(),
      ]);
      setState({ status: 'loaded', pending, archive, projects, groups, hierarchy });
    } catch (err) {
      setState({
        status: 'error',
        message: (err as Error).message || 'Ошибка загрузки',
      });
    }
  }, [
    archiveGroupBy,
    archiveMonth,
    archiveStatus,
    archiveYear,
    selectedDepartmentId,
    selectedGroupId,
    selectedProjectId,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const years = useMemo(() => {
    const values = new Set<number>([currentYear, archiveYear]);
    if (state.status === 'loaded') {
      for (const item of state.archive.items) {
        const year = Number(item.decidedAt?.slice(0, 4));
        if (Number.isFinite(year)) values.add(year);
      }
    }
    return [...values].sort((a, b) => b - a);
  }, [archiveYear, state]);

  const decide = async (requestId: string, decision: 'approve' | 'reject') => {
    setActionError(null);
    setActionMessage(null);
    const comment = decisionComments[requestId]?.trim() || null;

    try {
      if (decision === 'approve') {
        await dataSource.approveApprovalRequest(requestId, { comment });
      } else {
        await dataSource.rejectApprovalRequest(requestId, { comment });
      }
      setDecisionComments((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      });
      setViewMode('archive');
      setActionMessage(decision === 'approve' ? 'Перенос согласован и записан в архив' : 'Перенос отклонён и записан в архив');
      await load();
    } catch (err) {
      setActionError((err as Error).message || 'Ошибка сохранения решения');
    }
  };

  const deleteArchiveItem = async (itemId: string) => {
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await dataSource.deleteApprovalArchiveItem(itemId);
      setActionMessage(`Удалено строк: ${result.deleted}`);
      await load();
    } catch (err) {
      setActionError((err as Error).message || 'Ошибка удаления строки архива');
    }
  };

  const pruneArchive = async () => {
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await dataSource.pruneApprovalArchive(pruneUnit, pruneCount);
      setActionMessage(`Удалено строк: ${result.deleted}`);
      await load();
    } catch (err) {
      setActionError((err as Error).message || 'Ошибка очистки архива');
    }
  };

  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />;

  const departmentOptions = departments(state.groups, state.hierarchy);
  const officeOptions = offices(state.groups, state.hierarchy, selectedDepartmentId);
  const pendingRequests = state.pending.filter((request) => {
    if (selectedProjectId !== 'all' && request.projectId !== selectedProjectId) return false;
    if (selectedDepartmentId !== 'all' && request.departmentId !== selectedDepartmentId) return false;
    if (selectedGroupId !== 'all' && request.groupId !== selectedGroupId) return false;
    return true;
  });
  const visibleRequests = viewMode === 'pending' ? pendingRequests : state.archive.items;

  return (
    <section className="approvals">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Согласование</h1>
          <p className="page-header__subtitle">Активные переносы из OpenProject и архив решений в базе Galera Gantt</p>
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
          <span>{state.archive.total}</span>
        </button>
      </div>

      {actionError && <div className="structure__toast structure__toast--error">{actionError}</div>}
      {actionMessage && <div className="structure__toast structure__toast--success">{actionMessage}</div>}

      <section className="approvals-report">
        <div className="approvals__archive-toolbar">
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
                setSelectedGroupId('all');
              }}
            >
              <option value="all">Все департаменты</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </label>
          <label className="planning__control">
            <span>Отдел</span>
            <select
              className="gantt-view__select"
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
            >
              <option value="all">Все отделы</option>
              {officeOptions.map((office) => (
                <option key={office.id} value={office.id}>{office.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {viewMode === 'archive' && (
        <section className="approvals-report">
          <div className="approvals__archive-toolbar">
            <label className="planning__control">
              <span>Год</span>
              <select
                className="gantt-view__select"
                value={archiveYear}
                onChange={(event) => setArchiveYear(Number(event.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
            <label className="planning__control">
              <span>Месяц</span>
              <select
                className="gantt-view__select"
                value={archiveMonth}
                onChange={(event) => setArchiveMonth(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              >
                <option value="all">Весь год</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>{monthName(month)}</option>
                ))}
              </select>
            </label>
            <label className="planning__control">
              <span>Статус</span>
              <select
                className="gantt-view__select"
                value={archiveStatus}
                onChange={(event) => setArchiveStatus(event.target.value as 'all' | 'approved' | 'rejected')}
              >
                <option value="all">Все решения</option>
                <option value="approved">Согласовано</option>
                <option value="rejected">Не согласовано</option>
              </select>
            </label>
            <label className="planning__control">
              <span>Отчёт</span>
              <select
                className="gantt-view__select"
                value={archiveGroupBy}
                onChange={(event) => setArchiveGroupBy(event.target.value as ApprovalArchiveGroupBy)}
              >
                <option value="all">Общий</option>
                <option value="project">По проектам</option>
                <option value="department">По департаментам</option>
                <option value="group">По отделам</option>
              </select>
            </label>
          </div>

          <div className="approvals-report__stats">
            <article className="approvals-report__stat">
              <span>Всего решений</span>
              <strong>{state.archive.total}</strong>
            </article>
            <article className="approvals-report__stat">
              <span>Согласовано</span>
              <strong>{state.archive.approved}</strong>
            </article>
            <article className="approvals-report__stat">
              <span>Отклонено</span>
              <strong>{state.archive.rejected}</strong>
            </article>
            <article className="approvals-report__stat">
              <span>Средний сдвиг</span>
              <strong>{formatShift(state.archive.averageShiftDays)}</strong>
            </article>
          </div>

          {archiveGroupBy !== 'all' && (
            <article className="approvals-report__panel">
              <h2>{reportTitle(archiveGroupBy)}</h2>
              <dl>
                {state.archive.summary.map((item) => (
                  <div key={item.key}>
                    <dt>{item.label}</dt>
                    <dd>
                      {item.total} всего · {item.approved} согл. · {item.rejected} откл. · ср. {formatShift(item.averageShiftDays)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          )}

          <div className="approvals__prune">
            <span>Удалить историю старше</span>
            <input
              className="planning-details__input"
              type="number"
              min={1}
              value={pruneCount}
              onChange={(event) => setPruneCount(Math.max(1, Number(event.target.value) || 1))}
            />
            <select
              className="gantt-view__select"
              value={pruneUnit}
              onChange={(event) => setPruneUnit(event.target.value as 'month' | 'year')}
            >
              <option value="month">месяцев</option>
              <option value="year">лет</option>
            </select>
            <button className="planning__nav-btn" onClick={pruneArchive}>Удалить</button>
          </div>
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
                    <dt>Проект</dt>
                    <dd>{request.projectName ?? '-'}</dd>
                  </div>
                  {request.departmentName && (
                    <div>
                      <dt>Департамент</dt>
                      <dd>{request.departmentName}</dd>
                    </div>
                  )}
                  {request.groupName && (
                    <div>
                      <dt>Отдел</dt>
                      <dd>{request.groupName}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Текущая дата</dt>
                    <dd>{formatDate(request.currentDue)}</dd>
                  </div>
                  <div>
                    <dt>Новая дата</dt>
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
                    <>
                      <div>
                        <dt>Решено</dt>
                        <dd>{formatDate(request.decidedAt)}</dd>
                      </div>
                      <div>
                        <dt>Комментарий решения</dt>
                        <dd>{decisionComment(request)}</dd>
                      </div>
                    </>
                  )}
                </dl>
                {request.status === 'pending' && (
                  <div className="approvals__decision">
                    <label className="planning-details__field">
                      <span>Комментарий к решению</span>
                      <textarea
                        className="approvals__comment"
                        value={decisionComments[request.id] ?? ''}
                        onChange={(event) =>
                          setDecisionComments((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        placeholder="Почему согласуем или отклоняем перенос"
                      />
                    </label>
                    <div className="approvals__actions">
                      <button
                        className="approvals__decision-btn approvals__decision-btn--accept"
                        onClick={() => decide(request.id, 'approve')}
                      >
                        Согласовать перенос
                      </button>
                      <button
                        className="approvals__decision-btn approvals__decision-btn--reject"
                        onClick={() => decide(request.id, 'reject')}
                      >
                        Отклонить перенос
                      </button>
                    </div>
                  </div>
                )}
                {request.status !== 'pending' && (
                  <div className="approvals__archive-actions">
                    <button className="planning__nav-btn" onClick={() => deleteArchiveItem(request.id)}>
                      Удалить строку
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
