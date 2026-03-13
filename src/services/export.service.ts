import { AsanaTask } from '../types/asana.types';
import { asanaService } from './asana.service';

/**
 * Servicio para exportar proyectos de Asana a formato CSV
 * Compatible con la importación de Asana
 */

class ExportService {
  /**
   * Escapa valores para CSV (maneja comillas, saltos de línea, etc.)
   */
  private escapeCsvValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // Si contiene comillas, saltos de línea, comas o punto y coma, debe ir entre comillas
    if (stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes(',') || stringValue.includes(';')) {
      // Escapar comillas duplicándolas
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  /**
   * Formatea una fecha al formato que espera Asana (YYYY-MM-DD)
   */
  private formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }

  /**
   * Obtiene el valor de un campo personalizado
   */
  private getCustomFieldValue(task: AsanaTask, fieldName: string): string {
    if (!task.custom_fields) return '';
    
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '';
    
    // Manejar diferentes tipos de campos personalizados
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name || '';
    }
    
    if (field.type === 'number' && field.number_value !== undefined && field.number_value !== null) {
      return String(field.number_value);
    }
    
    if (field.type === 'text' && field.text_value) {
      return field.text_value;
    }
    
    if (field.display_value) {
      return field.display_value;
    }
    
    return '';
  }

  /**
   * Obtiene todos los nombres de campos personalizados únicos de un conjunto de tareas
   */
  private getAllCustomFieldNames(tasks: AsanaTask[]): string[] {
    const fieldNames = new Set<string>();
    
    tasks.forEach(task => {
      if (task.custom_fields) {
        task.custom_fields.forEach(field => {
          if (field.name) {
            fieldNames.add(field.name);
          }
        });
      }
    });
    
    return Array.from(fieldNames).sort();
  }

  /**
   * Convierte tareas a formato CSV compatible con Asana
   */
  private tasksToCSV(tasks: AsanaTask[], projectName: string): string {
    if (tasks.length === 0) {
      return '';
    }

    // Obtener todos los campos personalizados
    const customFieldNames = this.getAllCustomFieldNames(tasks);
    
    // Definir las columnas del CSV (formato compatible con importación de Asana)
    const headers = [
      'Name',
      'Notes',
      'Assignee',
      'Assignee Email',
      'Due Date',
      'Start Date',
      'Priority',
      'Projects',
      'Section',
      'Parent Task',
      'Tags',
      'Completed',
      'Approval Status',
      ...customFieldNames.map(name => `Custom Field: ${name}`)
    ];
    
    // Crear el encabezado
    const csvRows: string[] = [];
    csvRows.push(headers.map(h => this.escapeCsvValue(h)).join(','));
    
    // Crear un mapa de tareas por GID para buscar padres
    const taskMap = new Map<string, AsanaTask>();
    tasks.forEach(task => taskMap.set(task.gid, task));
    
    // Procesar cada tarea
    tasks.forEach(task => {
      const row: string[] = [];
      
      // Name
      row.push(this.escapeCsvValue(task.name));
      
      // Notes
      row.push(this.escapeCsvValue(task.notes || ''));
      
      // Assignee (nombre)
      row.push(this.escapeCsvValue(task.assignee?.name || ''));
      
      // Assignee Email
      row.push(this.escapeCsvValue(task.assignee?.email || ''));
      
      // Due Date
      row.push(this.escapeCsvValue(this.formatDate(task.due_on)));
      
      // Start Date
      row.push(this.escapeCsvValue(this.formatDate(task.start_on)));
      
      // Priority (no disponible directamente en API, dejarlo vacío)
      row.push('');
      
      // Projects
      row.push(this.escapeCsvValue(projectName));
      
      // Section
      row.push(this.escapeCsvValue(task.memberships?.[0]?.section?.name || ''));
      
      // Parent Task (buscar el nombre de la tarea padre)
      let parentName = '';
      if (task.parent) {
        const parentTask = taskMap.get(task.parent.gid);
        parentName = parentTask?.name || '';
      }
      row.push(this.escapeCsvValue(parentName));
      
      // Tags (no disponible en la API actual, dejar vacío)
      row.push('');
      
      // Completed
      row.push(task.completed ? 'Yes' : 'No');
      
      // Approval Status (no disponible en la API actual, dejar vacío)
      row.push('');
      
      // Campos personalizados
      customFieldNames.forEach(fieldName => {
        const value = this.getCustomFieldValue(task, fieldName);
        row.push(this.escapeCsvValue(value));
      });
      
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  /**
   * Descarga un archivo CSV
   */
  private downloadCSV(content: string, filename: string) {
    // Agregar BOM para compatibilidad con Excel UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Limpia el nombre del archivo para que sea válido
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  /**
   * Exporta un proyecto específico a CSV
   */
  async exportProject(projectGid: string, projectName: string, onProgress?: (message: string) => void): Promise<void> {
    try {
      if (onProgress) onProgress(`Obteniendo tareas del proyecto "${projectName}"...`);
      
      // Obtener todas las tareas del proyecto con campos personalizados
      const tasks = await asanaService.getProjectTasks(projectGid);
      
      if (onProgress) onProgress(`Procesando ${tasks.length} tareas...`);
      
      // Convertir a CSV
      const csvContent = this.tasksToCSV(tasks, projectName);
      
      if (!csvContent) {
        throw new Error('No se pudo generar el contenido CSV');
      }
      
      // Generar nombre de archivo
      const sanitizedName = this.sanitizeFilename(projectName);
      const date = new Date().toISOString().split('T')[0];
      const filename = `${sanitizedName}_${date}.csv`;
      
      if (onProgress) onProgress(`Descargando archivo "${filename}"...`);
      
      // Descargar
      this.downloadCSV(csvContent, filename);
      
      if (onProgress) onProgress(`✓ Proyecto "${projectName}" exportado exitosamente`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al exportar proyecto "${projectName}": ${errorMessage}`);
    }
  }

  /**
   * Exporta todos los proyectos del workspace CDIMA
   */
  async exportAllProjects(
    workspaceGid: string,
    onProgress?: (message: string) => void,
    onProjectComplete?: (projectName: string, index: number, total: number) => void
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      if (onProgress) onProgress('Obteniendo lista de proyectos del workspace...');
      
      // Obtener todos los proyectos
      const projects = await asanaService.getProjects(workspaceGid);
      
      if (projects.length === 0) {
        if (onProgress) onProgress('No se encontraron proyectos en el workspace');
        return results;
      }
      
      if (onProgress) onProgress(`Se encontraron ${projects.length} proyectos. Iniciando exportación...`);
      
      // Exportar cada proyecto
      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        
        try {
          if (onProgress) {
            onProgress(`[${i + 1}/${projects.length}] Exportando: ${project.name}`);
          }
          
          await this.exportProject(project.gid, project.name, onProgress);
          
          results.success++;
          
          if (onProjectComplete) {
            onProjectComplete(project.name, i + 1, projects.length);
          }
          
          // Pequeña pausa para no sobrecargar la API
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          results.errors.push(`${project.name}: ${errorMessage}`);
          
          if (onProgress) {
            onProgress(`✗ Error en "${project.name}": ${errorMessage}`);
          }
        }
      }
      
      if (onProgress) {
        onProgress(`\n✓ Exportación completada: ${results.success} exitosos, ${results.failed} fallidos`);
      }
      
      return results;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al exportar proyectos: ${errorMessage}`);
    }
  }
}

export default new ExportService();
