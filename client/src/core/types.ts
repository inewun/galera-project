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

export interface OpenProjectType {
  id: string;
  name: string;
  isMilestone: boolean;
}

export interface OpenProjectAssignee {
  id: string;
  name: string;
  href: string;
  assigneeType: 'user' | 'group' | 'placeholder';
}

export interface JiraAuthPayload {
  issueUrl: string;
  apiToken: string;
  email?: string | null;
}

export interface JiraIssuePreview {
  key: string;
  url: string;
  subject: string;
  description: string;
  issueType: string | null;
  status: string | null;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  startDate: string | null;
  dueDate: string | null;
}

export interface JiraImportPayload extends JiraAuthPayload {
  projectId: string;
  typeId: string;
  assigneeHref?: string | null;
  subject: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface JiraImportResult {
  issue: JiraIssuePreview;
  task: Task;
}

export interface JiraUpdatePayload extends JiraAuthPayload {
  workPackageId: string;
  subject: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeHref?: string | null;
}

export interface JiraUpdateResult {
  issue: JiraIssuePreview;
  task: Task;
  dueChanged: boolean;
  approvalRequest: ApprovalRequest | null;
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
  comment?: string | null;
}

export interface ApprovalRequest extends ApprovalRequestCreate {
  id: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface ApprovalDecision {
  comment?: string | null;
}

export interface ApprovalArchiveItem extends ApprovalRequest {
  decidedBy: string | null;
  decisionComment: string | null;
}

export type ApprovalArchiveGroupBy = 'all' | 'project' | 'department' | 'group';

export interface ApprovalArchiveSummaryItem {
  key: string;
  label: string;
  total: number;
  approved: number;
  rejected: number;
  averageShiftDays: number | null;
}

export interface ApprovalArchiveResponse {
  items: ApprovalArchiveItem[];
  total: number;
  approved: number;
  rejected: number;
  averageShiftDays: number | null;
  summary: ApprovalArchiveSummaryItem[];
}

export interface ApprovalArchiveParams {
  year?: number;
  month?: number;
  groupBy?: ApprovalArchiveGroupBy;
  status?: Exclude<ApprovalStatus, 'pending'>;
  projectId?: string;
  departmentId?: string;
  groupId?: string;
}

export interface ApprovalArchiveDeleteResult {
  deleted: number;
}

/** groupId → parent groupId (or null for root groups). */
export type HierarchyMap = Record<string, string | null>;
