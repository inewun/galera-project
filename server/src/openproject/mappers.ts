import { idFromHref } from './client.js';

/* ─────────────────────────────────────────────────────────────
 * Domain DTOs
 * ───────────────────────────────────────────────────────────── */

export interface Task {
  id: string;
  subject: string;
  start: string | null;
  due: string | null;
  progress: number;
  status: string;
  typeName: string;
  assigneeId: string | null;
  assigneeType: 'user' | 'group' | null;
  parentId: string | null;
  projectId: string | null;
  dependencies: string[];
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  groupIds: string[];
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

/* ─────────────────────────────────────────────────────────────
 * Mapping functions  – raw HAL → domain DTO
 * ───────────────────────────────────────────────────────────── */

export function mapWorkPackage(wp: Record<string, any>): Task {
  const assigneeHref: string | null = wp._links?.assignee?.href ?? null;

  let assigneeType: Task['assigneeType'] = null;
  if (assigneeHref?.includes('/groups/')) {
    assigneeType = 'group';
  } else if (assigneeHref?.includes('/users/')) {
    assigneeType = 'user';
  }

  return {
    id: String(wp.id),
    subject: wp.subject,
    start: wp.startDate ?? null,
    due: wp.dueDate ?? null,
    progress: wp.percentageDone ?? 0,
    status: wp._links?.status?.title ?? '',
    typeName: wp._links?.type?.title ?? '',
    assigneeId: idFromHref(assigneeHref),
    assigneeType,
    parentId: idFromHref(wp._links?.parent?.href ?? null),
    projectId: idFromHref(wp._links?.project?.href ?? null),
    dependencies: [],
  };
}

export function mapUser(u: Record<string, any>): User {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email ?? null,
    avatarUrl: u._links?.avatar?.href ?? null,
    groupIds: [],
  };
}

export function mapGroup(g: Record<string, any>): Group {
  let memberIds: string[] = [];

  if (g._embedded?.members) {
    memberIds = g._embedded.members.map(
      (m: Record<string, any>) => idFromHref(m._links?.self?.href),
    ).filter(Boolean) as string[];
  } else if (g._links?.members) {
    const members: Array<{ href: string }> = g._links.members;
    memberIds = members.map(m => idFromHref(m.href)).filter(Boolean) as string[];
  }

  return {
    id: String(g.id),
    name: g.name,
    memberIds,
  };
}

export interface Project {
  id: string;
  name: string;
}

export function mapProject(p: Record<string, any>): Project {
  return {
    id: String(p.id),
    name: p.name,
  };
}