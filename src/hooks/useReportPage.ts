import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanaService } from '../services/asana.service';
import { exportToPDF } from '../services/pdf.service';
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
  const [lugarFilter, setLugarFilter] = useState('all');
  
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
      setProjects(data);
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
    // Si hay actividad seleccionada, mostrar sus subtareas
    if (selectedMainTask && subtasks.length > 0) {
      return subtasks;
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
    
    displayTasks.forEach((task) => {
      // Usar Responsable de Actividad en lugar de assignee
      const responsableField = task.custom_fields?.find(f => f.name === 'Responsable de Actividad');
      let responsableName = 'Sin asignar';
      if (responsableField?.display_value) {
        responsableName = responsableField.display_value;
      } else if (responsableField?.type === 'text' && responsableField.text_value) {
        responsableName = responsableField.text_value;
      }
      
      if (!byAssignee[responsableName]) {
        byAssignee[responsableName] = { total: 0, completed: 0, pending: 0 };
      }
      byAssignee[responsableName].total += 1;
      
      // Verificar el campo Estado en lugar de completed
      const estado = task.custom_fields?.find(f => f.name === 'Estado');
      const isCompleted = estado?.enum_value?.name === 'EJECUTADO';
      
      if (isCompleted) {
        byAssignee[responsableName].completed += 1;
      } else {
        byAssignee[responsableName].pending += 1;
      }
    });

    return { total, completed, pending, completionPercentage, byAssignee };
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
      
      // Filtro por lugar
      const lugarField = task.custom_fields?.find(f => f.name === 'Lugar');
      let lugarValue = '-';
      if (lugarField?.display_value) {
        lugarValue = lugarField.display_value;
      } else if (lugarField?.type === 'multi_enum' && lugarField.multi_enum_values && lugarField.multi_enum_values.length > 0) {
        lugarValue = lugarField.multi_enum_values.map(v => v.name).join(', ');
      }
      
      const matchesLugar =
        lugarFilter === 'all' ||
        lugarValue === lugarFilter;
      
      return matchesSearch && matchesStatus && matchesLugar;
    });
  }, [displayTasks, searchTerm, statusFilter, lugarFilter]);

  // Lista única de lugares para el filtro
  const uniqueLugares = useMemo(() => {
    const lugares = new Set<string>();
    displayTasks.forEach((task) => {
      const lugarField = task.custom_fields?.find(f => f.name === 'Lugar');
      let lugarValue = '-';
      if (lugarField?.display_value) {
        lugarValue = lugarField.display_value;
      } else if (lugarField?.type === 'multi_enum' && lugarField.multi_enum_values && lugarField.multi_enum_values.length > 0) {
        lugarValue = lugarField.multi_enum_values.map(v => v.name).join(', ');
      }
      lugares.add(lugarValue);
    });
    // Eliminar el valor '-' si existe y hay otros lugares
    const lugaresArray = Array.from(lugares).sort();
    return lugaresArray.filter(l => l !== '-' || lugaresArray.length === 1);
  }, [displayTasks]);

  const handleExportPDF = () => {
    if (!selectedTask && !selectedProject) return;
    
    const projectName = projects.find((p) => p.gid === selectedProject)?.name || 'Proyecto';
    const taskForPDF = selectedTask || { 
      name: projectName, 
      notes: 'Reporte de todas las tareas del proyecto',
      completed: false 
    } as AsanaTask;
    exportToPDF(taskForPDF, displayTasks, projectName);
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
    lugarFilter,
    loading,
    error,
    
    // Datos computados
    statistics,
    filteredSubtasks,
    uniqueLugares,
    
    // Handlers
    handleWorkspaceChange,
    handleProjectChange,
    handleSectionChange,
    handleMainTaskChange,
    handleExportPDF,
    setSearchTerm,
    setStatusFilter,
    setLugarFilter,
  };
};
