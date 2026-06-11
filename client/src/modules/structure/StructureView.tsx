import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Group, User, Task, HierarchyMap } from '../../core/types';
import { dataSource } from '../../core/datasource';
import { Spinner } from '../../components/Spinner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { buildTree, wouldCreateCycle } from './tree';
import type { TreeNode } from './tree';
import { buildStructureData } from './data';
import type { StructResult } from './data';
import { StructureTimeline } from './StructureTimeline';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; groups: Group[]; users: User[]; tasks: Task[]; hierarchy: HierarchyMap };

type ViewMode = 'editor' | 'timeline';

interface TableRow {
  group: Group;
  depth: number;
}

function formatDate(value: string | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function buildTableRows(groups: Group[], hierarchy: HierarchyMap): TableRow[] {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const tree = buildTree(groups, hierarchy);
  const rows: TableRow[] = [];
  const visited = new Set<string>();

  function visit(node: TreeNode, depth: number) {
    const group = groupMap.get(node.id);
    if (!group) return;

    rows.push({ group, depth });
    visited.add(group.id);

    for (const child of node.children) {
      visit(child, depth + 1);
    }
  }

  for (const root of tree) {
    visit(root, 0);
  }

  for (const group of groups) {
    if (!visited.has(group.id)) {
      rows.push({ group, depth: 0 });
    }
  }

  return rows;
}

export function StructureView() {
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [hierarchy, setHierarchy] = useState<HierarchyMap>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('editor');

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [groups, loadedHierarchy, users, tasks] = await Promise.all([
        dataSource.getGroups(),
        dataSource.getHierarchy(),
        dataSource.getUsers(),
        dataSource.getTasks(),
      ]);
      setHierarchy(loadedHierarchy);
      setState({ status: 'loaded', groups, hierarchy: loadedHierarchy, users, tasks });
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

  const handleParentChange = async (
    groupId: string,
    newParentId: string | null,
  ) => {
    setSaveError(null);

    const prevHierarchy = hierarchy;
    const updated = { ...hierarchy, [groupId]: newParentId };

    setHierarchy(updated);
    setState((s) =>
      s.status === 'loaded' ? { ...s, hierarchy: updated } : s,
    );

    try {
      await dataSource.saveHierarchy(updated);
    } catch (err) {
      setHierarchy(prevHierarchy);
      setState((s) =>
        s.status === 'loaded' ? { ...s, hierarchy: prevHierarchy } : s,
      );
      setSaveError((err as Error).message || 'Ошибка сохранения иерархии');
    }
  };

  const timelineResult: StructResult | undefined = useMemo(() => {
    if (state.status !== 'loaded') return undefined;
    const { groups, hierarchy, users, tasks } = state;
    return buildStructureData(groups, hierarchy, users, tasks);
  }, [state]);

  if (state.status === 'loading') {
    return <Spinner />;
  }

  if (state.status === 'error') {
    return <ErrorState message={state.message} onRetry={load} />;
  }

  const { groups } = state;

  if (groups.length === 0) {
    return <EmptyState message="Нет групп в OpenProject" />;
  }

  const tableRows = buildTableRows(groups, hierarchy);
  const rootGroups = groups.filter((group) => hierarchy[group.id] == null);
  const childrenByParent = groups.reduce((map, group) => {
    const parentId = hierarchy[group.id] ?? null;
    if (parentId === null) return map;
    map.set(parentId, [...(map.get(parentId) ?? []), group.id]);
    return map;
  }, new Map<string, string[]>());

  return (
    <div className="structure">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Структура</h1>
          <p className="page-header__subtitle">Департаменты, отделы и сотрудники из OpenProject</p>
        </div>
      </header>

      {saveError && (
        <div className="structure__toast structure__toast--error">
          {saveError}
        </div>
      )}

      <div className="gantt-view__toolbar">
        <div className="gantt-view__view-buttons">
          <button
            className={
              'gantt-view__view-btn' +
              (view === 'editor' ? ' gantt-view__view-btn--active' : '')
            }
            onClick={() => setView('editor')}
          >
            Редактор
          </button>
          <button
            className={
              'gantt-view__view-btn' +
              (view === 'timeline' ? ' gantt-view__view-btn--active' : '')
            }
            onClick={() => setView('timeline')}
          >
            Таймлайн
          </button>
        </div>
      </div>

      {view === 'editor' ? (
        <StructureTable
          rows={tableRows}
          groups={groups}
          hierarchy={hierarchy}
          rootGroups={rootGroups}
          childrenByParent={childrenByParent}
          onParentChange={handleParentChange}
        />
      ) : (
        timelineResult ? (
          <StructureTimeline result={timelineResult} />
        ) : (
          <Spinner />
        )
      )}
    </div>
  );
}

interface StructureTableProps {
  rows: TableRow[];
  groups: Group[];
  hierarchy: HierarchyMap;
  rootGroups: Group[];
  childrenByParent: Map<string, string[]>;
  onParentChange: (groupId: string, newParentId: string | null) => void;
}

function StructureTable({
  rows,
  groups,
  hierarchy,
  rootGroups,
  childrenByParent,
  onParentChange,
}: StructureTableProps) {
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  return (
    <div className="structure-table__wrap">
      <table className="structure-table">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Кол-во сотрудников</th>
            <th>Дата создания</th>
            <th>Родитель</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ group, depth }) => {
            const currentParentId = hierarchy[group.id] ?? null;
            const hasChildren = (childrenByParent.get(group.id) ?? []).length > 0;
            const canChooseParent = !hasChildren;
            const parentOptions = rootGroups.filter(
              (candidate) =>
                candidate.id !== group.id &&
                !wouldCreateCycle(hierarchy, group.id, candidate.id),
            );

            return (
              <tr
                key={group.id}
                className={depth > 0 ? 'structure-table__row--child' : undefined}
              >
                <td>
                  <span
                    className="structure-table__name"
                    style={{ paddingLeft: `${Math.min(depth, 2) * 18}px` }}
                  >
                    {group.name}
                  </span>
                </td>
                <td>{group.memberIds.length}</td>
                <td>{formatDate(group.createdAt)}</td>
                <td>
                  <select
                    className="structure__row-select"
                    value={currentParentId ?? ''}
                    disabled={!canChooseParent && currentParentId === null}
                    onChange={(e) =>
                      onParentChange(
                        group.id,
                        e.target.value === '' ? null : e.target.value,
                      )
                    }
                  >
                    <option value="">(Пусто)</option>
                    {currentParentId !== null && !canChooseParent && (
                      <option value={currentParentId}>
                        {groupNameById.get(currentParentId) ?? currentParentId}
                      </option>
                    )}
                    {canChooseParent &&
                      parentOptions.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
