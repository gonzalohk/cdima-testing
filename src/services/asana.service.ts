import {
  AsanaAttachment,
  AsanaProject,
  AsanaSection,
  AsanaTask,
  AsanaWorkspace,
} from '../types/asana.types';
import config from '../config/env';

const BASE_URL = 'https://app.asana.com/api/1.0';

class AsanaService {
  private token: string = '';

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('asana_token', token);
  }

  getToken(): string {
    if (!this.token) {
      // Primero intenta obtener el token desde localStorage
      const storedToken = localStorage.getItem('asana_token');
      
      // Si no hay token en localStorage, usa el de las variables de entorno
      this.token = storedToken || config.asanaToken || '';
    }
    return this.token;
  }

  clearToken() {
    this.token = '';
    localStorage.removeItem('asana_token');
  }

  private async fetchAsana<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Token de acceso no configurado');
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
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
      `/projects/${projectGid}/tasks?opt_fields=name,notes,completed,due_on,assignee.name,parent.name,num_subtasks,memberships,memberships.section,memberships.section.name,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.enum_options,custom_fields.enum_options.name,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value`
    );
  }

  async getTask(taskGid: string): Promise<AsanaTask> {
    return this.fetchAsana<AsanaTask>(
      `/tasks/${taskGid}?opt_fields=name,notes,completed,due_on,assignee.name,parent.name,num_subtasks,workspace.gid,projects.gid,projects.name,projects.workspace.gid,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.enum_options,custom_fields.enum_options.name,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value`
    );
  }

  async getSubtasks(taskGid: string): Promise<AsanaTask[]> {
    return this.fetchAsana<AsanaTask[]>(
      `/tasks/${taskGid}/subtasks?opt_fields=name,notes,completed,due_on,assignee.name,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.enum_options,custom_fields.enum_options.name,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value`
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

  // Método para obtener tareas con fechas para calendario
  async getProjectTasksForCalendar(projectGid: string): Promise<AsanaTask[]> {
    return this.fetchAsana<AsanaTask[]>(
      `/projects/${projectGid}/tasks?opt_fields=name,notes,completed,due_on,start_on,assignee.name,parent.name,parent.gid,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name`
    );
  }

  async createSubtask(parentTaskGid: string, workspaceGid: string, subtaskData: {
    name: string;
    notes?: string;
    due_on?: string;
    custom_fields?: Record<string, string>;
  }): Promise<AsanaTask> {
    return this.fetchAsana<AsanaTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          ...subtaskData,
          workspace: workspaceGid,
          parent: parentTaskGid
        }
      })
    });
  }

  // Métodos para Biblioteca de Recursos
  async getTaskAttachments(taskGid: string): Promise<AsanaAttachment[]> {
    const attachments = await this.fetchAsana<AsanaAttachment[]>(
      `/tasks/${taskGid}/attachments?opt_fields=gid,name,resource_type,resource_subtype,view_url,download_url,host,parent`
    );
    
    // Log para debugging
    if (attachments.length > 0) {
      console.log(`Attachments for task ${taskGid}:`, attachments.map(a => ({
        name: a.name,
        hasViewUrl: !!a.view_url,
        hasDownloadUrl: !!a.download_url,
        viewUrl: a.view_url,
        downloadUrl: a.download_url,
        host: a.host
      })));
    }
    
    return attachments;
  }

  async getTaskWithAttachments(taskGid: string): Promise<AsanaTask> {
    const task = await this.getTask(taskGid);
    const attachments = await this.getTaskAttachments(taskGid);
    return { ...task, attachments };
  }

  async getSubtasksWithAttachments(taskGid: string): Promise<AsanaTask[]> {
    const subtasks = await this.getSubtasks(taskGid);
    const subtasksWithAttachments = await Promise.all(
      subtasks.map(async (subtask) => {
        const attachments = await this.getTaskAttachments(subtask.gid);
        return { ...subtask, attachments };
      })
    );
    return subtasksWithAttachments;
  }

  async getProjectResourceLibrary(projectGid: string): Promise<{
    sections: AsanaSection[];
    tasksBySection: Map<string, AsanaTask[]>;
  }> {
    const [sections, tasks] = await Promise.all([
      this.getSections(projectGid),
      this.getProjectTasks(projectGid),
    ]);

    // Filtrar solo tareas principales (no subtareas)
    const parentTasks = tasks.filter(task => !task.parent);

    // Obtener attachments para todas las tareas principales
    const tasksWithAttachments = await Promise.all(
      parentTasks.map(async (task) => {
        const [attachments, subtasks] = await Promise.all([
          this.getTaskAttachments(task.gid),
          task.num_subtasks ? this.getSubtasksWithAttachments(task.gid) : Promise.resolve([])
        ]);
        return { ...task, attachments, subtasks };
      })
    );

    // Organizar tareas por sección
    const tasksBySection = new Map<string, AsanaTask[]>();
    sections.forEach(section => {
      const sectionTasks = tasksWithAttachments.filter(task =>
        task.memberships?.some(m => m.section?.gid === section.gid)
      );
      tasksBySection.set(section.gid, sectionTasks);
    });

    return { sections, tasksBySection };
  }

  // ===== Métodos para Diplomados =====
  
  /**
   * Crear una nueva sección en un proyecto
   */
  async createSection(projectGid: string, sectionName: string): Promise<AsanaSection> {
    return this.fetchAsana<AsanaSection>('/sections', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          name: sectionName,
          project: projectGid
        }
      })
    });
  }

  /**
   * Crear una nueva tarea en un proyecto y sección específica
   */
  async createTask(data: {
    name: string;
    projectGid: string;
    workspaceGid: string;
    sectionGid?: string;
    notes?: string;
  }): Promise<AsanaTask> {
    const taskData: any = {
      name: data.name,
      projects: [data.projectGid],
      workspace: data.workspaceGid,
    };

    if (data.notes) {
      taskData.notes = data.notes;
    }

    const task = await this.fetchAsana<AsanaTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify({ data: taskData })
    });

    // Si se especifica sección, mover la tarea a esa sección
    if (data.sectionGid) {
      await this.addTaskToSection(task.gid, data.sectionGid);
    }

    return task;
  }

  /**
   * Mover una tarea a una sección específica
   */
  async addTaskToSection(taskGid: string, sectionGid: string): Promise<void> {
    await this.fetchAsana<void>(`/sections/${sectionGid}/addTask`, {
      method: 'POST',
      body: JSON.stringify({
        data: {
          task: taskGid
        }
      })
    });
  }

  /**
   * Obtener tareas de una sección específica
   */
  async getSectionTasks(sectionGid: string): Promise<AsanaTask[]> {
    return this.fetchAsana<AsanaTask[]>(
      `/sections/${sectionGid}/tasks?opt_fields=name,notes,completed,due_on,num_subtasks,created_at`
    );
  }

  /**
   * Eliminar una sección
   */
  async deleteSection(sectionGid: string): Promise<void> {
    await this.fetchAsana<void>(`/sections/${sectionGid}`, {
      method: 'DELETE'
    });
  }

  /**
   * Actualizar nombre de una sección
   */
  async updateSection(sectionGid: string, newName: string): Promise<AsanaSection> {
    return this.fetchAsana<AsanaSection>(`/sections/${sectionGid}`, {
      method: 'PUT',
      body: JSON.stringify({
        data: {
          name: newName
        }
      })
    });
  }

  /**
   * Eliminar una tarea
   */
  async deleteTask(taskGid: string): Promise<void> {
    await this.fetchAsana<void>(`/tasks/${taskGid}`, {
      method: 'DELETE'
    });
  }
}

export const asanaService = new AsanaService();

