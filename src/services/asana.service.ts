import {
  AsanaProject,
  AsanaSection,
  AsanaTask,
  AsanaWorkspace,
} from '../types/asana.types';

const BASE_URL = 'https://app.asana.com/api/1.0';

class AsanaService {
  private token: string = '';

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('asana_token', token);
  }

  getToken(): string {
    if (!this.token) {
      this.token = localStorage.getItem('asana_token') || '';
    }
    return this.token;
  }

  clearToken() {
    this.token = '';
    localStorage.removeItem('asana_token');
  }

  private async fetchAsana<T>(endpoint: string): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Token de acceso no configurado');
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.errors?.[0]?.message || `Error ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.data;
  }

  async getWorkspaces(): Promise<AsanaWorkspace[]> {
    return this.fetchAsana<AsanaWorkspace[]>('/workspaces');
  }

  async getProjects(workspaceGid: string): Promise<AsanaProject[]> {
    return this.fetchAsana<AsanaProject[]>(
      `/projects?workspace=${workspaceGid}&archived=false&opt_fields=name,notes,color`
    );
  }

  async getProjectTasks(projectGid: string): Promise<AsanaTask[]> {
    return this.fetchAsana<AsanaTask[]>(
      `/projects/${projectGid}/tasks?opt_fields=name,notes,completed,due_on,assignee.name,parent.name,num_subtasks,memberships,memberships.section,memberships.section.name,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value`
    );
  }

  async getTask(taskGid: string): Promise<AsanaTask> {
    return this.fetchAsana<AsanaTask>(
      `/tasks/${taskGid}?opt_fields=name,notes,completed,due_on,assignee.name,parent.name,num_subtasks,projects.name,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value`
    );
  }

  async getSubtasks(taskGid: string): Promise<AsanaTask[]> {
    return this.fetchAsana<AsanaTask[]>(
      `/tasks/${taskGid}/subtasks?opt_fields=name,notes,completed,due_on,assignee.name,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value`
    );
  }

  async getTasksByProject(projectGid: string, onlyParents: boolean = false): Promise<AsanaTask[]> {
    const tasks = await this.getProjectTasks(projectGid);
    if (onlyParents) {
      return tasks.filter(task => !task.parent);
    }
    return tasks;
  }

  async getSections(projectGid: string): Promise<AsanaSection[]> {
    return this.fetchAsana<AsanaSection[]>(
      `/projects/${projectGid}/sections`
    );
  }
}

export const asanaService = new AsanaService();
