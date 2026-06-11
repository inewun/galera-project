import type { StructResult, StructNode } from './data';

/* ─────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────── */

export interface VisGroup {
  id: string;
  content: string;
  nestedGroups?: string[];
  showNested?: boolean;
}

export interface VisItem {
  id: string;
  group: string;
  content: string;
  start: Date;
  end: Date;
  type: 'range' | 'background';
  className: string;
  title?: string;
}

/* ─────────────────────────────────────────────
 * toVisData — рекурсивный обход StructResult
 * ───────────────────────────────────────────── */

export function toVisData(result: StructResult): {
  groups: VisGroup[];
  items: VisItem[];
} {
  const groups: VisGroup[] = [];
  const items: VisItem[] = [];

  /**
   * Обходит один узел. parentGroupId — id родительской группы
   * (для задач, которые лежат непосредственно в группе).
   */
  function walk(node: StructNode, parentGroupId?: string): void {
    if (node.kind === 'group') {
      // --- VisGroup ---
      const childGroupIds = node.children
        .filter((c) => c.kind === 'group')
        .map((c) => c.id);

      const visGroup: VisGroup = {
        id: node.id,
        content: `${node.name} (${node.taskCount})`,
      };
      if (childGroupIds.length > 0) {
        visGroup.nestedGroups = childGroupIds;
        visGroup.showNested = true;
      }
      groups.push(visGroup);

      // --- Фон-период группы (если есть даты) ---
      if (node.start && node.end) {
        items.push({
          id: 'agg:' + node.id,
          group: node.id,
          start: node.start,
          end: node.end,
          content: '',
          type: 'background',
          className: 'struct-agg',
        });
      }

      // --- Рекурсивно обходим детей с parentGroupId = node.id ---
      for (const child of node.children) {
        walk(child, node.id);
      }
    } else {
      // kind === 'task'
      if (!parentGroupId) return; // safety
      items.push({
        id: node.id,
        group: parentGroupId,
        content: node.name,
        start: node.start!,
        end: node.end!,
        type: 'range',
        className: 'struct-task',
        title: node.name,
      });
    }
  }

  for (const root of result.roots) {
    walk(root);
  }

  return { groups, items };
}
