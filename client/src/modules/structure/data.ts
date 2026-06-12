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
  users: User[],
  tasks: Task[],
): StructResult {
  const groupMap = new Map<string, Group>();
  for (const g of groups) groupMap.set(g.id, g);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const userNameById = new Map(users.map((user) => [user.id, user.name]));

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

  const directGroupTaskIds = new Map<string, Set<string>>();
  const userTaskIdsByGroup = new Map<string, Map<string, Set<string>>>();

  // Группы → memberIds → userIds
  const userIdsInGroups = new Map<string, Set<string>>();
  for (const g of groups) {
    userIdsInGroups.set(g.id, new Set(g.memberIds));
  }

  for (const t of tasks) {
    if (t.assigneeType === 'group' && t.assigneeId !== null && groupMap.has(t.assigneeId)) {
      if (!directGroupTaskIds.has(t.assigneeId)) directGroupTaskIds.set(t.assigneeId, new Set());
      directGroupTaskIds.get(t.assigneeId)!.add(t.id);
    } else if (t.assigneeType === 'user' && t.assigneeId !== null) {
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
        if (!userTaskIdsByGroup.has(gid)) userTaskIdsByGroup.set(gid, new Map());
        const userTaskIds = userTaskIdsByGroup.get(gid)!;
        if (!userTaskIds.has(t.assigneeId)) userTaskIds.set(t.assigneeId, new Set());
        userTaskIds.get(t.assigneeId)!.add(t.id);
      }
    }
  }

  /* -- hiddenNoDateCount: задачи без дат, которые привязались бы куда-то -- */
  const hiddenNoDateIds = new Set<string>();
  for (const t of tasks) {
    if (isDated(t)) continue;
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

  function buildTaskNodes(taskIds: Set<string>, ownerId: string): StructNode[] {
    return [...taskIds]
      .map((tid): StructNode | null => {
        const t = taskMap.get(tid);
        if (!t || !isDated(t)) return null;
        const { s, e } = taskRange(t);
        return {
          id: 't:' + t.id + '@' + ownerId,
          kind: 'task',
          name: t.subject,
          start: s,
          end: e,
          progress: clamp(t.progress ?? 0, 0, 100),
          taskCount: 1,
          children: [],
        };
      })
      .filter((node): node is StructNode => node !== null)
      .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
  }

  function aggregateNode(
    id: string,
    name: string,
    children: StructNode[],
    memberCount?: number,
  ): StructNode {
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;
    for (const child of children) {
      if (child.start !== null && (minStart === null || child.start < minStart)) minStart = child.start;
      if (child.end !== null && (maxEnd === null || child.end > maxEnd)) maxEnd = child.end;
    }

    return {
      id,
      kind: 'group',
      name,
      start: minStart,
      end: maxEnd,
      progress: 0,
      taskCount: children.reduce((sum, child) => sum + child.taskCount, 0),
      memberCount,
      children,
    };
  }

  /* -- Рекурсивный convert -- */
  function convert(groupNode: TreeNode): StructNode {
    const g = groupMap.get(groupNode.id)!;

    const childGroups = groupNode.children.map(convert);
    const directTaskNodes = buildTaskNodes(
      directGroupTaskIds.get(groupNode.id) ?? new Set(),
      `${groupNode.id}:direct`,
    );
    const directTaskBucket = directTaskNodes.length > 0
      ? aggregateNode(`g:${groupNode.id}:direct`, 'Задачи отдела', directTaskNodes)
      : null;

    const userTaskNodes = [...(userTaskIdsByGroup.get(groupNode.id) ?? new Map()).entries()]
      .map(([userId, taskIds]) => {
        const taskNodes = buildTaskNodes(taskIds, `${groupNode.id}:user:${userId}`);
        if (taskNodes.length === 0) return null;
        return aggregateNode(
          `g:${groupNode.id}:user:${userId}`,
          userNameById.get(userId) ?? `Сотрудник #${userId}`,
          taskNodes,
        );
      })
      .filter((node): node is StructNode => node !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    const children = [
      ...childGroups,
      ...(directTaskBucket ? [directTaskBucket] : []),
      ...userTaskNodes,
    ];

    if (children.length === 0) {
      return {
        id: 'g:' + groupNode.id,
        kind: 'group',
        name: g.name,
        start: null,
        end: null,
        progress: 0,
        taskCount: 0,
        memberCount: g.memberIds.length,
        children: [],
      };
    }

    return aggregateNode('g:' + groupNode.id, g.name, children, g.memberIds.length);
  }

  const roots = groupTree.map(convert);
  return { roots, hiddenNoDateCount: hiddenNoDateIds.size };
}
