import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ErrorState } from '../../components/ErrorState';
import { Spinner } from '../../components/Spinner';
import { dataSource } from '../../core/datasource';
import type { JiraIssuePreview, OpenProjectAssignee, OpenProjectType, Project, Task } from '../../core/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; projects: Project[] };

type JiraMode = 'create' | 'update';

function defaultDescription(issue: JiraIssuePreview): string {
  const lines = [
    issue.description.trim(),
    '',
    'Поля Jira:',
    `- Тип: ${issue.issueType || '-'}`,
    `- Статус: ${issue.status || '-'}`,
    `- Приоритет: ${issue.priority || '-'}`,
    `- Исполнитель: ${issue.assignee || '-'}`,
    `- Автор: ${issue.reporter || '-'}`,
    `- Дата начала: ${issue.startDate || '-'}`,
    `- Дата окончания: ${issue.dueDate || '-'}`,
  ];
  return lines.join('\n').trim();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU').format(date);
}

export function JiraView() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [mode, setMode] = useState<JiraMode>('create');
  const [issueUrl, setIssueUrl] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [projectId, setProjectId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [types, setTypes] = useState<OpenProjectType[]>([]);
  const [assigneeHref, setAssigneeHref] = useState('');
  const [assignees, setAssignees] = useState<OpenProjectAssignee[]>([]);
  const [updateProjectId, setUpdateProjectId] = useState('');
  const [updateTasks, setUpdateTasks] = useState<Task[]>([]);
  const [updateTaskId, setUpdateTaskId] = useState('');
  const [updateAssigneeHref, setUpdateAssigneeHref] = useState('');
  const [updateAssignees, setUpdateAssignees] = useState<OpenProjectAssignee[]>([]);
  const [updateSubject, setUpdateSubject] = useState('');
  const [updateDescription, setUpdateDescription] = useState('');
  const [updateStartDate, setUpdateStartDate] = useState('');
  const [updateDueDate, setUpdateDueDate] = useState('');
  const [issue, setIssue] = useState<JiraIssuePreview | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState<'preview' | 'types' | 'assignees' | 'tasks' | 'updateAssignees' | 'import' | 'update' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => state.status === 'loaded' ? state.projects.find((project) => project.id === projectId) : null,
    [projectId, state],
  );

  const selectedUpdateTask = useMemo(
    () => updateTasks.find((task) => task.id === updateTaskId) || null,
    [updateTaskId, updateTasks],
  );
  const updateDueNeedsApproval = Boolean(updateDueDate && selectedUpdateTask && selectedUpdateTask.due !== updateDueDate);

  const loadProjects = async () => {
    setState({ status: 'loading' });
    setError(null);
    try {
      const projects = await dataSource.getProjects();
      setState({ status: 'loaded', projects });
      if (projects[0]) setProjectId((current) => current || projects[0].id);
      if (projects[0]) setUpdateProjectId((current) => current || projects[0].id);
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message || 'Ошибка загрузки проектов' });
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setTypes([]);
      setTypeId('');
      return;
    }

    let cancelled = false;
    setBusy('types');
    dataSource.getOpenProjectTypes(projectId)
      .then((items) => {
        if (cancelled) return;
        setTypes(items);
        const firstRegular = items.find((item) => !item.isMilestone) || items[0];
        setTypeId((current) => items.some((item) => item.id === current) ? current : firstRegular?.id || '');
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || 'Ошибка загрузки типов задач');
      })
      .finally(() => {
        if (!cancelled) setBusy((current) => current === 'types' ? null : current);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !typeId) {
      setAssignees([]);
      setAssigneeHref('');
      return;
    }

    let cancelled = false;
    setBusy('assignees');
    dataSource.getOpenProjectAssignees(projectId, typeId)
      .then((items) => {
        if (cancelled) return;
        setAssignees(items);
        setAssigneeHref((current) => items.some((item) => item.href === current) ? current : '');
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || 'Ошибка загрузки исполнителей');
      })
      .finally(() => {
        if (!cancelled) setBusy((current) => current === 'assignees' ? null : current);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, typeId]);

  useEffect(() => {
    if (!updateProjectId) {
      setUpdateTasks([]);
      setUpdateTaskId('');
      return;
    }

    let cancelled = false;
    setBusy('tasks');
    dataSource.getTasks({ projectId: updateProjectId })
      .then((items) => {
        if (cancelled) return;
        setUpdateTasks(items);
        setUpdateTaskId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || '');
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || 'Ошибка загрузки задач OpenProject');
      })
      .finally(() => {
        if (!cancelled) setBusy((current) => current === 'tasks' ? null : current);
      });

    return () => {
      cancelled = true;
    };
  }, [updateProjectId]);

  useEffect(() => {
    if (!updateProjectId) {
      setUpdateAssignees([]);
      setUpdateAssigneeHref('');
      return;
    }

    let cancelled = false;
    setBusy('updateAssignees');
    dataSource.getOpenProjectAssignees(updateProjectId)
      .then((items) => {
        if (cancelled) return;
        setUpdateAssignees(items);
        setUpdateAssigneeHref((current) => items.some((item) => item.href === current) ? current : '');
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || 'Ошибка загрузки исполнителей');
      })
      .finally(() => {
        if (!cancelled) setBusy((current) => current === 'updateAssignees' ? null : current);
      });

    return () => {
      cancelled = true;
    };
  }, [updateProjectId]);

  const authPayload = () => ({
    issueUrl: issueUrl.trim(),
    apiToken,
    email: email.trim() || null,
  });

  const preview = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy('preview');
    try {
      const loadedIssue = await dataSource.previewJiraIssue(authPayload());
      setIssue(loadedIssue);
      setSubject(loadedIssue.subject);
      setDescription(defaultDescription(loadedIssue));
      setDueDate(loadedIssue.dueDate || '');
      setStartDate(loadedIssue.startDate || '');
      setUpdateSubject(loadedIssue.subject);
      setUpdateDescription(defaultDescription(loadedIssue));
      setUpdateDueDate(loadedIssue.dueDate || '');
      setUpdateStartDate(loadedIssue.startDate || '');
    } catch (err) {
      setError((err as Error).message || 'Не удалось загрузить задачу Jira');
    } finally {
      setBusy(null);
    }
  };

  const updateExistingTask = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy('update');
    try {
      const result = await dataSource.updateOpenProjectFromJira({
        ...authPayload(),
        workPackageId: updateTaskId,
        assigneeHref: updateAssigneeHref || null,
        subject: updateSubject.trim(),
        description: updateDescription,
        startDate: updateStartDate || null,
        dueDate: updateDueDate || null,
      });
      setMessage(
        result.dueChanged
          ? `Задача ${result.task.id} обновлена, изменение даты окончания отправлено на согласование`
          : `Задача ${result.task.id} обновлена в OpenProject`,
      );
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить задачу OpenProject');
    } finally {
      setBusy(null);
    }
  };

  const importIssue = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy('import');
    try {
      const result = await dataSource.importJiraIssue({
        ...authPayload(),
        projectId,
        typeId,
        assigneeHref: assigneeHref || null,
        subject: subject.trim(),
        description,
        startDate: startDate || null,
        dueDate: dueDate || null,
      });
      setMessage(`Задача ${result.task.id} создана в OpenProject: ${result.task.subject}`);
    } catch (err) {
      setError((err as Error).message || 'Не удалось создать задачу в OpenProject');
    } finally {
      setBusy(null);
    }
  };

  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={loadProjects} />;

  return (
    <section className="jira">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Jira</h1>
          <p className="page-header__subtitle">Перенос задачи из Jira в выбранный проект OpenProject</p>
        </div>
      </header>

      {error && <div className="structure__toast structure__toast--error">{error}</div>}
      {message && <div className="structure__toast structure__toast--success">{message}</div>}

      <form className="jira__panel jira__panel--source" onSubmit={preview}>
        <div className="jira__section-title">Источник Jira</div>
        <div className="jira__grid">
          <label className="planning__control planning__control--wide">
            <span>Ссылка на задачу</span>
            <input
              className="jira__input"
              value={issueUrl}
              onChange={(event) => setIssueUrl(event.target.value)}
              placeholder="https://company.atlassian.net/browse/ABC-123"
              required
            />
          </label>
          <label className="planning__control">
            <span>Email для Jira Cloud</span>
            <input
              className="jira__input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.ru"
            />
          </label>
          <label className="planning__control planning__control--wide">
            <span>API token</span>
            <input
              className="jira__input"
              type="password"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
        </div>
        <div className="jira__actions">
          <button className="planning__today-btn" type="submit" disabled={busy === 'preview'}>
            {busy === 'preview' ? 'Загрузка...' : 'Загрузить из Jira'}
          </button>
        </div>
      </form>

      <div className="jira__mode-switch" aria-label="Сценарий Jira">
        <button
          className={'planning__mode-btn' + (mode === 'create' ? ' planning__mode-btn--active' : '')}
          type="button"
          onClick={() => setMode('create')}
        >
          Создать задачу
        </button>
        <button
          className={'planning__mode-btn' + (mode === 'update' ? ' planning__mode-btn--active' : '')}
          type="button"
          onClick={() => setMode('update')}
        >
          Изменить существующую
        </button>
      </div>

      {mode === 'create' && (
      <form className="jira__panel jira__panel--task" onSubmit={importIssue}>
        <div className="jira__section-title">Создание задачи OpenProject</div>
        <div className="jira__grid">
          <label className="planning__control planning__control--wide">
            <span>Проект</span>
            <select className="gantt-view__select" value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="planning__control">
            <span>Тип задачи</span>
            <select className="gantt-view__select" value={typeId} onChange={(event) => setTypeId(event.target.value)} required>
              {types.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </label>
          <label className="planning__control planning__control--wide">
            <span>Исполнитель</span>
            <select className="gantt-view__select" value={assigneeHref} onChange={(event) => setAssigneeHref(event.target.value)} disabled={busy === 'assignees'}>
              <option value="">Без исполнителя</option>
              {assignees.map((assignee) => (
                <option key={assignee.href} value={assignee.href}>
                  {assignee.assigneeType === 'group' ? 'Группа: ' : assignee.assigneeType === 'placeholder' ? 'Роль: ' : 'Сотрудник: '}
                  {assignee.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {issue && (
          <div className="jira__preview">
            <div className="jira__issue-meta">
              <a href={issue.url} target="_blank" rel="noreferrer">{issue.key}</a>
              <span>{issue.issueType || '-'}</span>
              <span>{issue.status || '-'}</span>
              <span>Начало: {formatDate(issue.startDate)}</span>
              <span>Срок: {formatDate(issue.dueDate)}</span>
            </div>
            <label className="planning__control planning__control--wide">
              <span>Название</span>
              <input className="jira__input" value={subject} onChange={(event) => setSubject(event.target.value)} required />
            </label>
            <label className="planning__control planning__control--wide">
              <span>Описание</span>
              <textarea className="jira__textarea" value={description} onChange={(event) => setDescription(event.target.value)} rows={12} />
            </label>
            <div className="jira__grid">
              <label className="planning__control">
                <span>Начало</span>
                <input className="jira__input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="planning__control">
                <span>Окончание</span>
                <input className="jira__input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </div>
          </div>
        )}

        {issue && (
          <div className="jira__actions">
            <button className="approvals__decision-btn approvals__decision-btn--accept" type="submit" disabled={!projectId || !typeId || busy === 'import' || busy === 'types' || busy === 'assignees'}>
              {busy === 'import' ? 'Создание...' : `Создать в ${selectedProject?.name || 'OpenProject'}`}
            </button>
          </div>
        )}
      </form>
      )}

      {mode === 'update' && (
      <form className="jira__panel jira__panel--task" onSubmit={updateExistingTask}>
        <div className="jira__section-title">Изменение существующей задачи OpenProject</div>
        <div className="jira__grid">
          <label className="planning__control planning__control--wide">
            <span>Проект</span>
            <select className="gantt-view__select" value={updateProjectId} onChange={(event) => setUpdateProjectId(event.target.value)} required>
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="planning__control planning__control--wide">
            <span>Задача OpenProject</span>
            <select className="gantt-view__select" value={updateTaskId} onChange={(event) => setUpdateTaskId(event.target.value)} disabled={busy === 'tasks'} required>
              {updateTasks.length === 0 ? (
                <option value="">(пусто)</option>
              ) : (
                updateTasks.map((task) => (
                  <option key={task.id} value={task.id}>#{task.id} {task.subject}</option>
                ))
              )}
            </select>
          </label>
          <label className="planning__control planning__control--wide">
            <span>Исполнитель</span>
            <select className="gantt-view__select" value={updateAssigneeHref} onChange={(event) => setUpdateAssigneeHref(event.target.value)} disabled={busy === 'updateAssignees'}>
              <option value="">Без изменения</option>
              {updateAssignees.map((assignee) => (
                <option key={assignee.href} value={assignee.href}>
                  {assignee.assigneeType === 'group' ? 'Группа: ' : assignee.assigneeType === 'placeholder' ? 'Роль: ' : 'Сотрудник: '}
                  {assignee.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedUpdateTask && (
          <div className={'jira__due-compare' + (updateDueNeedsApproval ? ' jira__due-compare--warning' : '')}>
            <div className="jira__due-card">
              <span>Дата окончания OpenProject</span>
              <strong>{formatDate(selectedUpdateTask.due)}</strong>
            </div>
            <div className="jira__due-card">
              <span>Дата окончания Jira</span>
              <strong>{formatDate(updateDueDate)}</strong>
            </div>
            {updateDueNeedsApproval && (
              <div className="jira__approval-warning">
                Даты окончания отличаются. Изменение срока не будет записано напрямую: задача уйдёт на согласование.
              </div>
            )}
          </div>
        )}

        {issue && (
        <div className="jira__preview">
          <label className="planning__control planning__control--wide">
            <span>Название</span>
            <input className="jira__input" value={updateSubject} onChange={(event) => setUpdateSubject(event.target.value)} required />
          </label>
          <label className="planning__control planning__control--wide">
            <span>Описание</span>
            <textarea className="jira__textarea" value={updateDescription} onChange={(event) => setUpdateDescription(event.target.value)} rows={10} />
          </label>
          <div className="jira__grid jira__grid--dates">
            <label className="planning__control">
              <span>Начало</span>
              <input className="jira__input" type="date" value={updateStartDate} onChange={(event) => setUpdateStartDate(event.target.value)} />
              {selectedUpdateTask && <small className="jira__field-note">OpenProject: {formatDate(selectedUpdateTask.start)}</small>}
            </label>
            <label className="planning__control">
              <span>Окончание из Jira</span>
              <input className="jira__input" type="date" value={updateDueDate} onChange={(event) => setUpdateDueDate(event.target.value)} />
            </label>
          </div>
        </div>
        )}

        {issue && (
          <div className="jira__actions">
            <button
              className="approvals__decision-btn approvals__decision-btn--accept"
              type="submit"
              disabled={!updateTaskId || !updateSubject.trim() || busy === 'update' || busy === 'tasks' || busy === 'updateAssignees'}
            >
              {busy === 'update' ? 'Обновление...' : 'Обновить задачу OpenProject'}
            </button>
          </div>
        )}
      </form>
      )}
    </section>
  );
}
