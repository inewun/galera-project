import type { DataSource, ListParams } from './DataSource';
import { NotImplementedError } from './DataSource';
import type { Task, User, Group, Project, HierarchyMap } from '../types';
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
