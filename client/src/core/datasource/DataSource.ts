import type {
  ApprovalRequest,
  ApprovalArchiveDeleteResult,
  ApprovalArchiveParams,
  ApprovalArchiveResponse,
  ApprovalDecision,
  ApprovalRequestCreate,
  ApprovalStatus,
  JiraAuthPayload,
  JiraImportPayload,
  JiraImportResult,
  JiraIssuePreview,
  JiraUpdatePayload,
  JiraUpdateResult,
  OpenProjectAssignee,
  Task,
  User,
  Group,
  OpenProjectType,
  Project,
  HierarchyMap,
} from '../types';

export interface ListParams {
  projectId?: string;
}

export interface DataSource {
  getTasks(params?: ListParams): Promise<Task[]>;
  getUsers(): Promise<User[]>;
  getGroups(): Promise<Group[]>;
  getProjects(): Promise<Project[]>;
  getHierarchy(): Promise<HierarchyMap>;
  saveHierarchy(map: HierarchyMap): Promise<HierarchyMap>;
  getApprovalRequests(status?: ApprovalStatus): Promise<ApprovalRequest[]>;
  getApprovalArchive(params?: ApprovalArchiveParams): Promise<ApprovalArchiveResponse>;
  createApprovalRequest(data: ApprovalRequestCreate): Promise<ApprovalRequest>;
  approveApprovalRequest(id: string, decision?: ApprovalDecision): Promise<ApprovalRequest>;
  rejectApprovalRequest(id: string, decision?: ApprovalDecision): Promise<ApprovalRequest>;
  deleteApprovalArchiveItem(id: string): Promise<ApprovalArchiveDeleteResult>;
  pruneApprovalArchive(unit: 'month' | 'year', count: number): Promise<ApprovalArchiveDeleteResult>;
  previewJiraIssue(data: JiraAuthPayload): Promise<JiraIssuePreview>;
  getOpenProjectTypes(projectId: string): Promise<OpenProjectType[]>;
  getOpenProjectAssignees(projectId: string, typeId?: string): Promise<OpenProjectAssignee[]>;
  importJiraIssue(data: JiraImportPayload): Promise<JiraImportResult>;
  updateOpenProjectFromJira(data: JiraUpdatePayload): Promise<JiraUpdateResult>;

  /** ЗАДЕЛ: обновление задачи */
  updateTask?(id: string, patch: Partial<Task>): Promise<Task>;
  /** ЗАДЕЛ: создание задачи */
  createTask?(data: Omit<Task, 'id'>): Promise<Task>;
  /** ЗАДЕЛ: удаление задачи */
  deleteTask?(id: string): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`Not implemented yet: ${method}`);
    this.name = 'NotImplementedError';
  }
}
