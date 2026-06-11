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
  createdAt: string | null;
}

export interface Project {
  id: string;
  name: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequestCreate {
  taskId: string;
  taskSubject: string;
  projectId?: string | null;
  projectName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  currentDue?: string | null;
  proposedDue?: string | null;
}

export interface ApprovalRequest extends ApprovalRequestCreate {
  id: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt: string | null;
}

/** groupId → parent groupId (or null for root groups). */
export type HierarchyMap = Record<string, string | null>;
