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

export interface Project {
  id: string;
  name: string;
}

/** groupId → parent groupId (or null for root groups). */
export type HierarchyMap = Record<string, string | null>;
