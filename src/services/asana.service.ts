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
  private token: string = config.asanaToken || '';
  private workspacesCache: AsanaWorkspace[] | null = null;
  private workspacesCachePromise: Promise<AsanaWorkspace[]> | null = null;

  setToken(token: string) {
    this.token = token;
  }

  getToken(): string {
    return this.token;
  }

  clearToken() {
    this.token = config.asanaToken || '';
    this.workspacesCache = null;
    this.workspacesCachePromise = null;
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
    if (this.workspacesCache) {
      return this.workspacesCache;
    }
    if (this.workspacesCachePromise) {
      return this.workspacesCachePromise;
    }
    this.workspacesCachePromise = this.fetchAsana<AsanaWorkspace[]>('/workspaces').then(data => {
      this.workspacesCache = data;
      this.workspacesCachePromise = null;
      return data;
    });
    return this.workspacesCachePromise;
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
      `/tasks/${taskGid}?opt_fields=name,notes,completed,due_on,assignee.name,parent.name,num_subtasks,workspace.gid,projects.gid,projects.name,projects.workspace.gid,memberships,memberships.section,memberships.section.name,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.enum_options,custom_fields.enum_options.name,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value`
    );
  }

  async getSubtasks(taskGid: string): Promise<AsanaTask[]> {
    return this.fetchAsana<AsanaTask[]>(
      `/tasks/${taskGid}/subtasks?opt_fields=name,notes,completed,due_on,start_on,assignee.name,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.enum_options,custom_fields.enum_options.name,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value`
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
    const data = await this.fetchAsana<AsanaSection[]>(
      `/projects/${projectGid}/sections`
    );
    return data.filter(s => s.name !== 'Sección sin nombre');
  }

  // Método para obtener tareas con fechas para calendario
  async getProjectTasksForCalendar(projectGid: string): Promise<AsanaTask[]> {
    return this.fetchAsana<AsanaTask[]>(
      `/projects/${projectGid}/tasks?opt_fields=name,notes,completed,due_on,start_on,assignee.name,parent.name,parent.gid,num_subtasks,custom_fields,custom_fields.gid,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.text_value,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.enum_options,custom_fields.enum_options.name,custom_fields.enum_options.gid`
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

  async getProjectSectionsAndTasks(projectGid: string): Promise<{
    sections: AsanaSection[];
    tasksBySection: Map<string, AsanaTask[]>;
  }> {
    const [sections, tasks] = await Promise.all([
      this.getSections(projectGid),
      this.getProjectTasks(projectGid),
    ]);

    const parentTasks = tasks.filter(task => !task.parent);

    const tasksBySection = new Map<string, AsanaTask[]>();
    sections.forEach(section => {
      const sectionTasks = parentTasks.filter(task =>
        task.memberships?.some(m => m.section?.gid === section.gid)
      );
      tasksBySection.set(section.gid, sectionTasks);
    });

    return { sections, tasksBySection };
  }

  async getSectionTasksWithAttachments(tasks: AsanaTask[]): Promise<AsanaTask[]> {
    const CHUNK_SIZE = 5;
    const DELAY_MS = 300;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const result: AsanaTask[] = [];
    for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
      const chunk = tasks.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (task) => {
          const [attachments, subtasks] = await Promise.all([
            this.getTaskAttachments(task.gid),
            task.num_subtasks ? this.getSubtasksWithAttachments(task.gid) : Promise.resolve([])
          ]);
          return { ...task, attachments, subtasks };
        })
      );
      result.push(...chunkResults);
      if (i + CHUNK_SIZE < tasks.length) {
        await delay(DELAY_MS);
      }
    }
    return result;
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

  /**
   * Actualizar una tarea (nombre, notas, custom fields, etc.)
   */
  async updateTask(
    taskGid: string, 
    data: { 
      name?: string; 
      notes?: string;
      completed?: boolean;
      custom_fields?: { [fieldGid: string]: string | number | null };
    }
  ): Promise<AsanaTask> {
    const optFields = 'name,notes,completed,due_on,assignee.name,parent.name,num_subtasks,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.type,custom_fields.gid,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.enum_options,custom_fields.enum_options.name,custom_fields.enum_options.gid,custom_fields.multi_enum_values,custom_fields.multi_enum_values.name,custom_fields.number_value,custom_fields.text_value';
    return this.fetchAsana<AsanaTask>(`/tasks/${taskGid}?opt_fields=${optFields}`, {
      method: 'PUT',
      body: JSON.stringify({ data })
    });
  }

  /**
   * Obtener plantillas de proyecto disponibles en el workspace
   */
  async getProjectTemplates(workspaceGid: string): Promise<{ gid: string; name: string }[]> {
    return this.fetchAsana<{ gid: string; name: string }[]>(
      `/project_templates?workspace=${workspaceGid}&opt_fields=name`
    );
  }

  /**
   * Obtener detalles de una plantilla, incluyendo sus variables de fecha requeridas.
   */
  async getProjectTemplateDetails(templateGid: string): Promise<{ requested_dates: { gid: string; name: string }[] }> {
    return this.fetchAsana<{ requested_dates: { gid: string; name: string }[] }>(
      `/project_templates/${templateGid}?opt_fields=requested_dates`
    );
  }

  /**
   * Instanciar un proyecto desde una plantilla. Devuelve el GID del Job creado.
   * Obtiene automáticamente las variables de fecha requeridas y las llena con la fecha actual.
   */
  async instantiateProjectTemplate(templateGid: string, name: string, workspaceGid: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);

    // Obtener variables de fecha que exige la plantilla
    const details = await this.getProjectTemplateDetails(templateGid);
    const requested_dates = (details.requested_dates ?? []).map(d => ({
      gid: d.gid,
      value: today,
    }));

    const job = await this.fetchAsana<{ gid: string }>(`/project_templates/${templateGid}/instantiateProject`, {
      method: 'POST',
      body: JSON.stringify({
        data: { name, workspace: workspaceGid, requested_dates }
      })
    });
    return job.gid;
  }

  /**
   * Espera a que un Job de Asana termine. Devuelve el resultado del job.
   */
  async pollJob(jobGid: string): Promise<{ new_project?: { gid: string } }> {
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const job = await this.fetchAsana<{ status: string; new_project?: { gid: string } }>(`/jobs/${jobGid}`);
      if (job.status === 'succeeded') return job;
      if (job.status === 'failed') throw new Error('La creación del proyecto falló en Asana');
    }
    throw new Error('Tiempo de espera excedido al crear el proyecto');
  }

  /**
   * Obtener la configuración de campos personalizados de un proyecto
   */
  async getProjectCustomFieldSettings(projectGid: string): Promise<{ field_gid: string; field_name: string; enum_options: { gid: string; name: string }[] }[]> {
    const settings = await this.fetchAsana<{ custom_field: { gid: string; name: string; enum_options?: { gid: string; name: string }[] } }[]>(
      `/projects/${projectGid}/custom_field_settings?opt_fields=custom_field.gid,custom_field.name,custom_field.enum_options,custom_field.enum_options.gid,custom_field.enum_options.name`
    );
    return settings.map(s => ({
      field_gid: s.custom_field.gid,
      field_name: s.custom_field.name,
      enum_options: s.custom_field.enum_options ?? [],
    }));
  }

}

export const asanaService = new AsanaService();

