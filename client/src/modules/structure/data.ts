import type { Group, User, Task, HierarchyMap } from '../../core/types';
import { buildTree } from './tree';
import type { TreeNode } from './tree';

/* ─────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────── */

export interface StructNode {
  id: string;          // 'g:'+groupId для группы; 't:'+taskId+'@'+groupId для задачи (уникально)
  kind: 'group' | 'task';
  name: string;
  start: Date | null;
  end: Date | null;
  progress: number;    // задача — своя; группа — 0
  taskCount: number;   // группа — число датированных задач во всём поддереве; задача — 1
  memberCount?: number;// только для группы
  children: StructNode[];
}

export interface StructResult {
  roots: StructNode[];
  hiddenNoDateCount: number;
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function isDated(t: Task): boolean {
  return t.start !== null || t.due !== null;
}

function taskRange(t: Task): { s: Date; e: Date } {
  const s = new Date(t.start ?? t.due!);
  let e = new Date(t.due ?? t.start!);
  if (e < s) e = new Date(s);
  return { s, e };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/* ─────────────────────────────────────────────
 * buildStructureData
 * ───────────────────────────────────────────── */

export function buildStructureData(
  groups: Group[],
  hierarchy: HierarchyMap,
  _users: User[],
  tasks: Task[],
): StructResult {
  const groupMap = new Map<string, Group>();
  for (const g of groups) groupMap.set(g.id, g);

  const groupTree = buildTree(groups, hierarchy);

  /* -- Карта потомков для фильтрации deepest-member -- */
  const descendants = new Map<string, Set<string>>();
  function collectDesc(node: TreeNode): Set<string> {
    const set = new Set<string>();
    for (const ch of node.children) {
      set.add(ch.id);
      for (const d of collectDesc(ch)) set.add(d);
    }
    descendants.set(node.id, set);
    return set;
  }
  groupTree.forEach(collectDesc);

  /* -- Собираем привязку: groupId -> множество taskId -- */
  const groupTaskIds = new Map<string, Set<string>>();

  // Группы → memberIds → userIds
  const userIdsInGroups = new Map<string, Set<string>>();
  for (const g of groups) {
    userIdsInGroups.set(g.id, new Set(g.memberIds));
  }

  for (const t of tasks) {
    if (t.assigneeType === 'group' && t.assigneeId !== null && groupMap.has(t.assigneeId)) {
      // Своя задача группы
      if (!groupTaskIds.has(t.assigneeId)) groupTaskIds.set(t.assigneeId, new Set());
      groupTaskIds.get(t.assigneeId)!.add(t.id);
    } else if (t.assigneeType === 'user' && t.assigneeId !== null) {
      // Задача пользователя — показываем только в самой глубокой группе членства
      const memberGroups: string[] = [];
      for (const [gid, uids] of userIdsInGroups) {
        if (uids.has(t.assigneeId)) memberGroups.push(gid);
      }
      const effective = memberGroups.filter((gid) => {
        const desc = descendants.get(gid);
        if (!desc || desc.size === 0) return true;
        // Исключаем родительские группы, у которых среди потомков есть другая memberGroups
        return !memberGroups.some((other) => other !== gid && desc.has(other));
      });
      for (const gid of effective) {
        if (!groupTaskIds.has(gid)) groupTaskIds.set(gid, new Set());
        groupTaskIds.get(gid)!.add(t.id);
      }
    }
  }

  /* -- hiddenNoDateCount: задачи без дат, которые привязались бы куда-то -- */
  const hiddenNoDateIds = new Set<string>();
  for (const t of tasks) {
    if (isDated(t)) continue;
    // Проверяем, привязалась бы эта задача
    if (t.assigneeType === 'group' && t.assigneeId !== null && groupMap.has(t.assigneeId)) {
      hiddenNoDateIds.add(t.id);
    } else if (t.assigneeType === 'user' && t.assigneeId !== null) {
      const memberGroups: string[] = [];
      for (const [gid, uids] of userIdsInGroups) {
        if (uids.has(t.assigneeId)) memberGroups.push(gid);
      }
      const effective = memberGroups.filter((gid) => {
        const desc = descendants.get(gid);
        if (!desc || desc.size === 0) return true;
        return !memberGroups.some((other) => other !== gid && desc.has(other));
      });
      if (effective.length > 0) hiddenNoDateIds.add(t.id);
    }
  }

  /* -- Рекурсивный convert -- */
  function convert(groupNode: TreeNode): StructNode {
    const g = groupMap.get(groupNode.id)!;

    // Задачи-листья этой группы (датированные)
    const taskNodes: StructNode[] = [];
    const assigned = groupTaskIds.get(groupNode.id);
    if (assigned) {
      for (const tid of assigned) {
        const t = tasks.find((x) => x.id === tid);
        if (!t) continue;
        if (!isDated(t)) continue;
        const { s, e } = taskRange(t);
        taskNodes.push({
          id: 't:' + t.id + '@' + groupNode.id,
          kind: 'task',
          name: t.subject,
          start: s,
          end: e,
          progress: clamp(t.progress ?? 0, 0, 100),
          taskCount: 1,
          children: [],
        });
      }
    }

    const childGroups = groupNode.children.map(convert);
    const children = [...childGroups, ...taskNodes];

    // Вычисляем диапазон дат
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;
    for (const c of children) {
      if (c.start !== null && (minStart === null || c.start < minStart)) minStart = c.start;
      if (c.end !== null && (maxEnd === null || c.end > maxEnd)) maxEnd = c.end;
    }

    const taskCount = childGroups.reduce((sum, ch) => sum + ch.taskCount, 0) + taskNodes.length;

    return {
      id: 'g:' + groupNode.id,
      kind: 'group',
      name: g.name,
      start: minStart,
      end: maxEnd,
      progress: 0,
      taskCount,
      memberCount: g.memberIds.length,
      children,
    };
  }

  const roots = groupTree.map(convert);
  return { roots, hiddenNoDateCount: hiddenNoDateIds.size };
}
