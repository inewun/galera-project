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

/* ───────────────────────────────────────────
 * Inline SVG icons (16×16)
 * ─────────────────────────────────────────── */

function GroupIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="structure-tree__icon"
    >
      <circle cx="5.5" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M1 13c0-2.5 2-3.5 4.5-3.5S10 10.5 10 13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M9 13c0-2 1.5-3 3.5-3s3.5 1 3.5 3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="structure-tree__person-icon"
    >
      <circle cx="5" cy="3.2" r="1.8" stroke="currentColor" strokeWidth="1" />
      <path
        d="M1.5 8.5c0-2 1.5-2.8 3.5-2.8s3.5.8 3.5 2.8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ───────────────────────────────────────────
 * TreeNodeView — рекурсивный рендер дерева
 * ─────────────────────────────────────────── */

interface TreeNodeViewProps {
  node: TreeNode;
  depth: number;
  memberCount: number;
  groupMembers: Map<string, number>;
}

function TreeNodeView({
  node,
  depth,
  memberCount,
  groupMembers,
}: TreeNodeViewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li className="structure-tree__item">
      <div className="structure-tree__row">
        {hasChildren ? (
          <button
            className="structure-tree__toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Развернуть' : 'Свернуть'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="structure-tree__toggle structure-tree__toggle--spacer" />
        )}

        <span className="structure-tree__chip">
          <GroupIcon />
          <span className="structure-tree__name">{node.name}</span>
          {memberCount > 0 && (
            <span className="structure-tree__badge">
              {memberCount}
              <PersonIcon />
            </span>
          )}
        </span>
      </div>

      {hasChildren && !collapsed && (
        <ul className="structure-tree__children">
          {node.children.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              memberCount={groupMembers.get(child.id) ?? 0}
              groupMembers={groupMembers}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ───────────────────────────────────────────
 * StructureView
 * ─────────────────────────────────────────── */

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; groups: Group[]; users: User[]; tasks: Task[]; hierarchy: HierarchyMap };

type ViewMode = 'editor' | 'timeline';

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

  /* ── Смена родителя (оптимистично, с откатом) ── */

  const handleParentChange = async (
    groupId: string,
    newParentId: string | null,
  ) => {
    setSaveError(null);

    const prevHierarchy = hierarchy;
    const updated = { ...hierarchy, [groupId]: newParentId };

    // Оптимистичное обновление
    setHierarchy(updated);
    setState((s) =>
      s.status === 'loaded' ? { ...s, hierarchy: updated } : s,
    );

    try {
      await dataSource.saveHierarchy(updated);
    } catch (err) {
      // Откат при ошибке
      setHierarchy(prevHierarchy);
      setState((s) =>
        s.status === 'loaded' ? { ...s, hierarchy: prevHierarchy } : s,
      );
      setSaveError((err as Error).message || 'Ошибка сохранения иерархии');
    }
  };

  /* ── Данные для таймлайна (мемоизировано) ── */

  const timelineResult: StructResult | undefined = useMemo(() => {
    if (state.status !== 'loaded') return undefined;
    const { groups, hierarchy, users, tasks } = state;
    return buildStructureData(groups, hierarchy, users, tasks);
  }, [state]);

  /* ── Рендер ── */

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

  // Строим дерево для предпросмотра
  const tree = buildTree(groups, hierarchy);

  // Карта количества участников: groupId → memberIds.length
  const groupMembers = new Map<string, number>(
    groups.map((g) => [g.id, g.memberIds.length]),
  );

  return (
    <div className="structure">
      <h1 className="structure__title">Структура групп</h1>

      {saveError && (
        <div className="structure__toast structure__toast--error">
          {saveError}
        </div>
      )}

      {/* ── Переключатель вида ── */}
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
        <div className="structure__columns">
          {/* ── Левая колонка: редактор ── */}
          <div className="structure__editor">
            <h2 className="structure__section-title">Редактор</h2>
            <div className="structure__list">
              {groups.map((group) => (
                <GroupEditorRow
                  key={group.id}
                  group={group}
                  groups={groups}
                  hierarchy={hierarchy}
                  currentParentId={hierarchy[group.id] ?? null}
                  onChange={handleParentChange}
                />
              ))}
            </div>
          </div>

          {/* ── Правая колонка: дерево ── */}
          <div className="structure__tree-panel">
            <h2 className="structure__section-title">Дерево</h2>
            {tree.length === 0 ? (
              <p className="structure__empty-tree">Нет корневых групп</p>
            ) : (
              <ul className="structure-tree">
                {tree.map((node) => (
                  <TreeNodeView
                    key={node.id}
                    node={node}
                    depth={0}
                    memberCount={groupMembers.get(node.id) ?? 0}
                    groupMembers={groupMembers}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
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

/* ───────────────────────────────────────────
 * GroupEditorRow — строка редактора с фильтром
 * ─────────────────────────────────────────── */

interface GroupEditorRowProps {
  group: Group;
  groups: Group[];
  hierarchy: HierarchyMap;
  currentParentId: string | null;
  onChange: (groupId: string, newParentId: string | null) => void;
}

function GroupEditorRow({
  group,
  groups,
  hierarchy,
  currentParentId,
  onChange,
}: GroupEditorRowProps) {
  return (
    <div className="structure__row">
      <span className="structure__row-name">{group.name}</span>
      <select
        className="structure__row-select"
        value={currentParentId ?? ''}
        onChange={(e) =>
          onChange(group.id, e.target.value === '' ? null : e.target.value)
        }
      >
        <option value="">— нет (корень) —</option>
        {groups
          .filter(
            (candidate) =>
              !wouldCreateCycle(hierarchy, group.id, candidate.id),
          )
          .map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
      </select>
    </div>
  );
}