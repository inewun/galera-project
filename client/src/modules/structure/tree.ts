import type { Group, HierarchyMap } from '../../core/types';

export interface TreeNode {
  id: string;
  name: string;
  children: TreeNode[];
}

/**
 * Builds a tree of groups from the flat list and hierarchy map.
 * Groups whose parent is null, missing, or points to a non-existent group
 * become root nodes.
 */
export function buildTree(groups: Group[], hierarchy: HierarchyMap): TreeNode[] {
  const groupMap = new Map<string, Group>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  const childrenMap = new Map<string, TreeNode[]>();
  const roots: TreeNode[] = [];

  for (const g of groups) {
    const parentId = hierarchy[g.id] ?? null;

    // If parent is specified but doesn't exist among known groups → treat as root
    if (parentId !== null && groupMap.has(parentId)) {
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push({ id: g.id, name: g.name, children: [] });
    } else {
      roots.push({ id: g.id, name: g.name, children: [] });
    }
  }

  // Recursively nest children
  function nest(node: TreeNode): void {
    const kids = childrenMap.get(node.id);
    if (kids) {
      node.children = kids;
      for (const child of kids) {
        nest(child);
      }
    }
  }

  for (const root of roots) {
    nest(root);
  }

  return roots;
}

/**
 * Checks whether assigning newParentId as the parent of childId would create
 * a cycle in the hierarchy.
 *
 * Returns true if:
 *   - newParentId === childId (self-reference)
 *   - childId appears somewhere in the ancestor chain of newParentId
 */
export function wouldCreateCycle(
  hierarchy: HierarchyMap,
  childId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return false;
  if (newParentId === childId) return true;

  // Walk up from newParentId; if we ever reach childId, it's a cycle
  let current: string | null = newParentId;
  const visited = new Set<string>();
  while (current !== null) {
    if (current === childId) return true;
    if (visited.has(current)) break; // safety: should not happen in valid data
    visited.add(current);
    current = hierarchy[current] ?? null;
  }

  return false;
}
