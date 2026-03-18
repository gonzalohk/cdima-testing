import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { exportTaskReportToPDF } from '../services/reports/report-reports.service';
import {
  AsanaWorkspace,
  AsanaProject,
  AsanaTask,
  AsanaSection,
  TaskStatistics,
} from '../types/asana.types';

export const useReportPage = () => {
  const navigate = useNavigate();
  
  // Estado para datos de Asana
  const [workspaces, setWorkspaces] = useState<AsanaWorkspace[]>([]);
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [sections, setSections] = useState<AsanaSection[]>([]);
  const [mainTasks, setMainTasks] = useState<AsanaTask[]>([]);
  const [allProjectTasks, setAllProjectTasks] = useState<AsanaTask[]>([]);
  const [subtasks, setSubtasks] = useState<AsanaTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AsanaTask | null>(null);
  
  // Estado para selecciones
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedMainTask, setSelectedMainTask] = useState('');
  
  // Estado para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [lugarFilter, setLugarFilter] = useState('all');
  const [responsableFilter, setResponsableFilter] = useState('all');
  
  // Estado UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Verificar token al cargar
  useEffect(() => {
    const token = asanaService.getToken();
    if (!token) {
      navigate('/');
      return;
    }
    loadWorkspaces();
  }, [navigate]);

  const loadWorkspaces = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await asanaService.getWorkspaces();
      setWorkspaces(data);
      
      // Auto-seleccionar "My Workspace"
      const myWorkspace = data.find(ws => ws.name === 'CDIMA');
      if (myWorkspace) {
        setSelectedWorkspace(myWorkspace.gid);
        // Cargar proyectos automáticamente
        await loadProjects(myWorkspace.gid);
      } else {
        setError('No se encontró "My Workspace"');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar workspaces');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (workspaceGid: string) => {
    setLoading(true);
    setError('');
    setProjects([]);
    setSections([]);
    setMainTasks([]);
    setAllProjectTasks([]);
    setSubtasks([]);
    setSelectedTask(null);
    setSelectedProject('');
    setSelectedSection('');
    setSelectedMainTask('');
    
    try {
      const data = await asanaService.getProjects(workspaceGid);
      
      // Mostrar solo proyectos cuyo nombre no contenga "CDIMA"
      const proyectosFiltrados = data.filter(project => {
        const nombreLower = project.name.toLowerCase();
        return !nombreLower.includes('cdima');
      });
      
      setProjects(proyectosFiltrados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  const loadSections = async (projectGid: string) => {
    try {
      const data = await asanaService.getSections(projectGid);
      setSections(data);
    } catch (err) {
      console.error('Error al cargar secciones:', err);
      setSections([]);
    }
  };

  const loadMainTasks = async (projectGid: string) => {
    setLoading(true);
    setError('');
    setMainTasks([]);
    setAllProjectTasks([]);
    setSubtasks([]);
    setSelectedTask(null);
    setSelectedSection('');
    setSelectedMainTask('');
    
    try {
      const [allTasks] = await Promise.all([
        asanaService.getTasksByProject(projectGid, false),
        loadSections(projectGid),
      ]);
      const parentTasks = allTasks.filter(task => !task.parent);
      setMainTasks(parentTasks);
      setAllProjectTasks(allTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar actividades');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskDetails = async (taskGid: string) => {
    setLoading(true);
    setError('');
    setSubtasks([]);
    
    try {
      const [taskDetails, taskSubtasks] = await Promise.all([
        asanaService.getTask(taskGid),
        asanaService.getSubtasks(taskGid),
      ]);
      
      setSelectedTask(taskDetails);
      setSubtasks(taskSubtasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar detalles de la tarea');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceChange = (value: string) => {
    setSelectedWorkspace(value);
    if (value) {
      loadProjects(value);
    }
  };

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    if (value) {
      loadMainTasks(value);
    }
  };

  const handleSectionChange = (value: string) => {
    setSelectedSection(value);
    setSelectedMainTask('');
    setSubtasks([]);
    setSelectedTask(null);
  };

  const handleMainTaskChange = (value: string) => {
    setSelectedMainTask(value);
    if (value) {
      loadTaskDetails(value);
    }
  };

  // Filtrado de tareas principales por sección
  const filteredMainTasks = useMemo(() => {
    if (!selectedSection) {
      return mainTasks;
    }
    return mainTasks.filter((task) => {
      if (!task.memberships || task.memberships.length === 0) {
        return false;
      }
      return task.memberships.some(
        (membership) =>
          membership.section && membership.section.gid === selectedSection
      );
    });
  }, [mainTasks, selectedSection]);

  // Tareas a mostrar: si hay actividad seleccionada -> subtareas, 
  // si hay sección seleccionada -> tareas de esa sección,
  // si no -> todas las tareas del proyecto
  const displayTasks = useMemo(() => {
    // Si hay actividad seleccionada, mostrar sus subtareas (excluyendo FUENTES DE VERIFICACION)
    if (selectedMainTask && subtasks.length > 0) {
      return subtasks.filter(task => !task.name.startsWith('FUENTES DE VERIFICACION'));
    }
    
    // Si no hay actividad pero hay sección seleccionada, filtrar por sección
    if (selectedProject && selectedSection && allProjectTasks.length > 0) {
      return allProjectTasks.filter((task) => {
        if (!task.memberships || task.memberships.length === 0) {
          return false;
        }
        return task.memberships.some(
          (membership) =>
            membership.section && membership.section.gid === selectedSection
        );
      });
    }
    
    // Si no hay actividad ni sección seleccionadas, mostrar todas las tareas del proyecto
    if (selectedProject && allProjectTasks.length > 0) {
      return allProjectTasks;
    }
    
    return [];
  }, [selectedMainTask, selectedProject, selectedSection, subtasks, allProjectTasks]);

  // Estadísticas calculadas
  const statistics: TaskStatistics = useMemo(() => {
    const total = displayTasks.length;
    
    // Calcular completed usando el campo Estado
    const completed = displayTasks.filter((t) => {
      const estado = t.custom_fields?.find(f => f.name === 'Estado');
      return estado?.enum_value?.name === 'EJECUTADO';
    }).length;
    
    const pending = total - completed;
    const completionPercentage = total > 0 ? (completed / total) * 100 : 0;

    const byAssignee: TaskStatistics['byAssignee'] = {};
    const byResponsable: TaskStatistics['byResponsable'] = {};
    
    // Excluir subtareas que tienen "Tipo de Solicitud" definido (solicitudes de fondos/materiales) 
    // y también excluir FUENTES DE VERIFICACION
    const tasksForDistribution = displayTasks.filter((task) => {
      const tipoSolicitud = task.custom_fields?.find(f => f.name === 'Tipo de Solicitud');
      const isFuentesVerificacion = task.name.startsWith('FUENTES DE VERIFICACION');
      return (!tipoSolicitud?.enum_value?.name || tipoSolicitud?.enum_value?.name === '') && !isFuentesVerificacion;
    });
    
    tasksForDistribution.forEach((task) => {
      // Agrupar por Lugar (Municipio) - dividir múltiples municipios separados por coma
      const lugar = task.custom_fields?.find(f => f.name === 'Lugar');
      let lugarNames: string[] = [];
      
      if (lugar?.enum_value?.name) {
        lugarNames = lugar.enum_value.name.split(',').map(m => m.trim()).filter(m => m);
      } else if (lugar?.text_value) {
        lugarNames = lugar.text_value.split(',').map(m => m.trim()).filter(m => m);
      } else if (lugar?.display_value) {
        lugarNames = lugar.display_value.split(',').map(m => m.trim()).filter(m => m);
      }
      
      // Si no hay municipios, usar 'Sin municipio'
      if (lugarNames.length === 0) {
        lugarNames = ['Sin municipio'];
      }
      
      // Verificar el campo Estado
      const estado = task.custom_fields?.find(f => f.name === 'Estado');
      const isCompleted = estado?.enum_value?.name === 'EJECUTADO';
      
      // Contar cada municipio por separado
      lugarNames.forEach(lugarName => {
        if (!byAssignee[lugarName]) {
          byAssignee[lugarName] = { total: 0, completed: 0, pending: 0 };
        }
        byAssignee[lugarName].total += 1;
        
        if (isCompleted) {
          byAssignee[lugarName].completed += 1;
        } else {
          byAssignee[lugarName].pending += 1;
        }
      });
      
      // Agrupar por Responsable de Actividad
      const responsable = task.custom_fields?.find(f => f.name === 'Responsable de Actividad');
      const responsableName = responsable?.enum_value?.name || responsable?.text_value || 'Sin responsable';
      
      if (!byResponsable[responsableName]) {
        byResponsable[responsableName] = { total: 0, completed: 0, pending: 0 };
      }
      byResponsable[responsableName].total += 1;
      
      if (isCompleted) {
        byResponsable[responsableName].completed += 1;
      } else {
        byResponsable[responsableName].pending += 1;
      }
    });

    return { total, completed, pending, completionPercentage, byAssignee, byResponsable };
  }, [displayTasks]);

  // Filtrado de subtareas
  const filteredSubtasks = useMemo(() => {
    return displayTasks.filter((task) => {
      const matchesSearch = task.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      
      // Verificar el campo Estado en lugar de completed
      const estado = task.custom_fields?.find(f => f.name === 'Estado');
      const isCompleted = estado?.enum_value?.name === 'EJECUTADO';
      
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' && isCompleted) ||
        (statusFilter === 'pending' && !isCompleted);
      
      const matchesAssignee =
        assigneeFilter === 'all' ||
        (task.assignee?.name || 'Sin asignar') === assigneeFilter;
      
      // Filtro por lugar - verificar si alguno de los municipios coincide
      const lugarField = task.custom_fields?.find(f => f.name === 'Lugar');
      let municipios: string[] = [];
      
      if (lugarField?.display_value) {
        municipios = lugarField.display_value.split(',').map(m => m.trim()).filter(m => m);
      } else if (lugarField?.type === 'multi_enum' && lugarField.multi_enum_values && lugarField.multi_enum_values.length > 0) {
        const joinedValue = lugarField.multi_enum_values.map(v => v.name).join(', ');
        municipios = joinedValue.split(',').map(m => m.trim()).filter(m => m);
      }
      
      if (municipios.length === 0) {
        municipios = ['-'];
      }
      
      const matchesLugar =
        lugarFilter === 'all' ||
        municipios.includes(lugarFilter);
      
      // Filtro por responsable
      const responsableField = task.custom_fields?.find(f => f.name === 'Responsable de Actividad');
      const responsableName = responsableField?.enum_value?.name || responsableField?.text_value || '-';
      
      const matchesResponsable =
        responsableFilter === 'all' ||
        responsableName === responsableFilter;
      
      return matchesSearch && matchesStatus && matchesAssignee && matchesLugar && matchesResponsable;
    });
  }, [displayTasks, searchTerm, statusFilter, assigneeFilter, lugarFilter, responsableFilter]);

  // Lista única de asignados para el filtro
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    displayTasks.forEach((task) => {
      assignees.add(task.assignee?.name || 'Sin asignar');
    });
    return Array.from(assignees).sort();
  }, [displayTasks]);

  // Lista única de lugares para el filtro - dividir municipios por coma
  const uniqueLugares = useMemo(() => {
    const lugares = new Set<string>();
    displayTasks.forEach((task) => {
      const lugarField = task.custom_fields?.find(f => f.name === 'Lugar');
      let municipios: string[] = [];
      
      if (lugarField?.display_value) {
        municipios = lugarField.display_value.split(',').map(m => m.trim()).filter(m => m);
      } else if (lugarField?.type === 'multi_enum' && lugarField.multi_enum_values && lugarField.multi_enum_values.length > 0) {
        const joinedValue = lugarField.multi_enum_values.map(v => v.name).join(', ');
        municipios = joinedValue.split(',').map(m => m.trim()).filter(m => m);
      }
      
      if (municipios.length === 0) {
        municipios = ['-'];
      }
      
      // Agregar cada municipio individualmente
      municipios.forEach(m => lugares.add(m));
    });
    // Eliminar el valor '-' si existe y hay otros lugares
    const lugaresArray = Array.from(lugares).sort();
    return lugaresArray.filter(l => l !== '-' || lugaresArray.length === 1);
  }, [displayTasks]);

  // Lista única de responsables para el filtro
  const uniqueResponsables = useMemo(() => {
    const responsables = new Set<string>();
    displayTasks.forEach((task) => {
      const responsableField = task.custom_fields?.find(f => f.name === 'Responsable de Actividad');
      const responsableName = responsableField?.enum_value?.name || responsableField?.text_value || '-';
      responsables.add(responsableName);
    });
    return Array.from(responsables).sort();
  }, [displayTasks]);

  const handleExportPDF = () => {
    if (!selectedTask && !selectedProject) return;
    
    const projectName = projects.find((p) => p.gid === selectedProject)?.name || 'Proyecto';
    const taskForPDF = selectedTask || { 
      name: projectName, 
      notes: 'Reporte de todas las tareas del proyecto',
      completed: false 
    } as AsanaTask;
    exportTaskReportToPDF(taskForPDF, displayTasks, projectName);
  };

  return {
    // Estado
    workspaces,
    projects,
    sections,
    mainTasks,
    filteredMainTasks,
    subtasks,
    selectedTask,
    selectedWorkspace,
    selectedProject,
    selectedSection,
    selectedMainTask,
    searchTerm,
    statusFilter,
    assigneeFilter,
    lugarFilter,
    responsableFilter,
    loading,
    error,
    
    // Datos computados
    statistics,
    filteredSubtasks,
    uniqueAssignees,
    uniqueLugares,
    uniqueResponsables,
    
    // Handlers
    handleWorkspaceChange,
    handleProjectChange,
    handleSectionChange,
    handleMainTaskChange,
    handleExportPDF,
    setSearchTerm,
    setStatusFilter,
    setAssigneeFilter,
    setLugarFilter,
    setResponsableFilter,
    setSubtasks,
    loadTaskDetails,
  };
};
