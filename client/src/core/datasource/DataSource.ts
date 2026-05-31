import type { Task, User, Group, Project, HierarchyMap } from '../types';

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
