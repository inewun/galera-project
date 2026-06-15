import type { DataSource, ListParams } from './DataSource';
import { NotImplementedError } from './DataSource';
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
import * as http from '../../api/http';

export class OpenProjectDataSource implements DataSource {
  async getTasks(params?: ListParams): Promise<Task[]> {
    let path = '/work-packages';
    if (params?.projectId) {
      path += `?projectId=${params.projectId}`;
    }
    return http.get<Task[]>(path);
  }

  async getUsers(): Promise<User[]> {
    return http.get<User[]>('/users');
  }

  async getGroups(): Promise<Group[]> {
    return http.get<Group[]>('/groups');
  }

  async getProjects(): Promise<Project[]> {
    return http.get<Project[]>('/projects');
  }

  async getHierarchy(): Promise<HierarchyMap> {
    return http.get<HierarchyMap>('/hierarchy');
  }

  async saveHierarchy(map: HierarchyMap): Promise<HierarchyMap> {
    return http.put<HierarchyMap>('/hierarchy', map);
  }

  async getApprovalRequests(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    const path = status
      ? `/approval-requests?status=${encodeURIComponent(status)}`
      : '/approval-requests';
    return http.get<ApprovalRequest[]>(path);
  }

  async getApprovalArchive(params?: ApprovalArchiveParams): Promise<ApprovalArchiveResponse> {
    const search = new URLSearchParams();
    if (params?.year) search.set('year', String(params.year));
    if (params?.month) search.set('month', String(params.month));
    if (params?.groupBy) search.set('groupBy', params.groupBy);
    if (params?.status) search.set('status', params.status);
    if (params?.projectId) search.set('projectId', params.projectId);
    if (params?.departmentId) search.set('departmentId', params.departmentId);
    if (params?.groupId) search.set('groupId', params.groupId);
    const query = search.toString();
    return http.get<ApprovalArchiveResponse>(`/approval-requests/archive${query ? `?${query}` : ''}`);
  }

  async createApprovalRequest(data: ApprovalRequestCreate): Promise<ApprovalRequest> {
    return http.post<ApprovalRequest>('/approval-requests', data);
  }

  async approveApprovalRequest(id: string, decision?: ApprovalDecision): Promise<ApprovalRequest> {
    return http.post<ApprovalRequest>(`/approval-requests/${id}/approve`, decision ?? {});
  }

  async rejectApprovalRequest(id: string, decision?: ApprovalDecision): Promise<ApprovalRequest> {
    return http.post<ApprovalRequest>(`/approval-requests/${id}/reject`, decision ?? {});
  }

  async deleteApprovalArchiveItem(id: string): Promise<ApprovalArchiveDeleteResult> {
    return http.del<ApprovalArchiveDeleteResult>(`/approval-requests/archive/${id}`);
  }

  async pruneApprovalArchive(unit: 'month' | 'year', count: number): Promise<ApprovalArchiveDeleteResult> {
    return http.del<ApprovalArchiveDeleteResult>(
      `/approval-requests/archive?olderThanUnit=${encodeURIComponent(unit)}&olderThanCount=${encodeURIComponent(String(count))}`,
    );
  }

  async previewJiraIssue(data: JiraAuthPayload): Promise<JiraIssuePreview> {
    return http.post<JiraIssuePreview>('/jira/preview', data);
  }

  async getOpenProjectTypes(projectId: string): Promise<OpenProjectType[]> {
    return http.get<OpenProjectType[]>(`/jira/openproject/projects/${encodeURIComponent(projectId)}/types`);
  }

  async getOpenProjectAssignees(projectId: string, typeId?: string): Promise<OpenProjectAssignee[]> {
    const search = new URLSearchParams();
    if (typeId) search.set('typeId', typeId);
    const query = search.toString();
    return http.get<OpenProjectAssignee[]>(
      `/jira/openproject/projects/${encodeURIComponent(projectId)}/assignees${query ? `?${query}` : ''}`,
    );
  }

  async importJiraIssue(data: JiraImportPayload): Promise<JiraImportResult> {
    return http.post<JiraImportResult>('/jira/import', data);
  }

  async updateOpenProjectFromJira(data: JiraUpdatePayload): Promise<JiraUpdateResult> {
    return http.post<JiraUpdateResult>('/jira/update-openproject', data);
  }

  updateTask(_id: string, _patch: Partial<Task>): Promise<Task> {
    throw new NotImplementedError('updateTask');
  }

  createTask(_data: Omit<Task, 'id'>): Promise<Task> {
    throw new NotImplementedError('createTask');
  }

  deleteTask(_id: string): Promise<void> {
    throw new NotImplementedError('deleteTask');
  }
}
