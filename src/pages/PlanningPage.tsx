import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, View, Event as BigCalendarEvent } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { asanaService } from '../services/asana.service';
import { AsanaTask, AsanaProject, TaskStatistics } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';
import StatisticsSection from '../components/StatisticsSection';
import { getTaskColor } from '../utils/colors';
import { exportCalendarViewToPDF, exportTasksTablesToPDF, exportTasksTablesToWord, exportMonthlyCalendarSchedule, exportMonthlyCalendarScheduleWord } from '../services/reports/planning-reports.service';

// Función auxiliar para obtener el valor de un campo personalizado
const getCustomFieldValue = (task: AsanaTask, fieldName: string): string => {
  if (!task.custom_fields) return '-';
  const field = task.custom_fields.find(f => f.name === fieldName);
  if (!field) return '-';
  
  // Si tiene display_value, usarlo directamente
  if (field.display_value) return field.display_value;
  
  // Para multi_enum, concatenar los valores
  if (field.type === 'multi_enum' && field.multi_enum_values && field.multi_enum_values.length > 0) {
    return field.multi_enum_values.map(v => v.name).join(', ');
  }
  
  // Para enum, usar el nombre del valor
  if (field.type === 'enum' && field.enum_value) {
    return field.enum_value.name;
  }
  
  // Para text
  if (field.type === 'text' && field.text_value) {
    return field.text_value;
  }
  
  return '-';
};

// Configurar moment en español (para formateo de fechas)
moment.locale('es');

// Configurar localizer de date-fns para el calendario
const locales = {
  'es': es,
};

const localizer = dateFnsLocalizer({
  format: (date: Date, formatStr: string) => format(date, formatStr, { locale: es }),
  parse: (dateStr: string, formatStr: string) => parse(dateStr, formatStr, new Date(), { locale: es }),
  startOfWeek: (date: Date) => startOfWeek(date, { locale: es, weekStartsOn: 1 }),
  getDay: (date: Date) => getDay(date),
  locales,
});

interface CalendarEvent extends BigCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    taskGid: string;
    completed: boolean;
    assignee?: string;
    responsables?: string;
    estado?: string;
    area?: string;
    isSubtask: boolean;
    parentName?: string;
    notes?: string;
  };
}

const PlanningPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [tasks, setTasks] = useState<AsanaTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [exportingTables, setExportingTables] = useState(false);
  const [exportingTablesWord, setExportingTablesWord] = useState(false);
  const [exportingCalendar, setExportingCalendar] = useState(false);
  const [exportingSchedule, setExportingSchedule] = useState(false);
  const [exportingScheduleWord, setExportingScheduleWord] = useState(false);
  const [updatingTaskGid, setUpdatingTaskGid] = useState<string | null>(null);

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
      
      // Auto-seleccionar "CDIMA"
      const cdima = data.find(ws => ws.name === 'CDIMA');
      if (cdima) {
        await loadProjects(cdima.gid);
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
    try {
      const data = await asanaService.getProjects(workspaceGid);
      setProjects(data);
      
      // Auto-seleccionar "Planificacion CDIMA"
      const planificacion = data.find(p => 
        p.name.toLowerCase().includes('planificacion') || 
        p.name.toLowerCase().includes('planificación')
      );
      if (planificacion) {
        setSelectedProject(planificacion.gid);
        await loadTasks(planificacion.gid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (projectGid: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await asanaService.getProjectTasksForCalendar(projectGid);
      
      // Cargar subtareas para las tareas que las tienen
      const tasksWithSubtasks: AsanaTask[] = [];
      for (const task of data) {
        tasksWithSubtasks.push(task);
        
        // Si la tarea tiene subtareas, cargarlas
        if (task.num_subtasks && task.num_subtasks > 0) {
          const subtasks = await asanaService.getSubtasks(task.gid);
          tasksWithSubtasks.push(...subtasks);
        }
      }
      
      setTasks(tasksWithSubtasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar actividades');
    } finally {
      setLoading(false);
    }
  };

  // Convertir tareas de Asana a eventos del calendario
  const events: CalendarEvent[] = useMemo(() => {
    return tasks
      .filter(task => task.start_on || task.due_on) // Solo tareas con fechas
      .map(task => {
        // Usar start_on si existe, si no usar due_on
        const startDate = task.start_on 
          ? moment(task.start_on).toDate()
          : moment(task.due_on).toDate();
        
        // Usar due_on como fecha fin, si no existe usar start_on
        const endDate = task.due_on 
          ? moment(task.due_on).toDate()
          : moment(task.start_on).toDate();

        // Agregar responsables al título si existe
        const responsables = getCustomFieldValue(task, 'Responsables de actividad');
        const titleWithResponsibles = responsables !== '-'
          ? `${task.name} (${responsables})`
          : task.name;
        
        const estado = getCustomFieldValue(task, 'Estado');

        return {
          id: task.gid,
          title: titleWithResponsibles,
          start: startDate,
          end: endDate,
          resource: {
            taskGid: task.gid,
            completed: task.completed,
            assignee: task.assignee?.name,
            responsables: responsables,
            estado: estado,
            area: getCustomFieldValue(task, 'Area'),
            isSubtask: !!task.parent,
            parentName: task.parent?.name,
            notes: task.notes
          }
        };
      });
  }, [tasks]);

  // Filtrar tareas del mes actual visible
  const currentMonthTasks = useMemo(() => {
    const startOfMonth = moment(date).startOf('month');
    const endOfMonth = moment(date).endOf('month');
    
    return tasks.filter(task => {
      // Verificar si la tarea tiene fechas en el rango del mes actual
      const taskStart = task.start_on ? moment(task.start_on) : task.due_on ? moment(task.due_on) : null;
      const taskEnd = task.due_on ? moment(task.due_on) : task.start_on ? moment(task.start_on) : null;
      
      if (!taskStart && !taskEnd) return false;
      
      // Incluir si la tarea comienza, termina o está en progreso durante el mes
      return (taskStart && taskStart.isBetween(startOfMonth, endOfMonth, null, '[]')) ||
             (taskEnd && taskEnd.isBetween(startOfMonth, endOfMonth, null, '[]')) ||
             (taskStart && taskEnd && taskStart.isSameOrBefore(endOfMonth) && taskEnd.isSameOrAfter(startOfMonth));
    });
  }, [tasks, date]);

  // Estadísticas del mes actual
  const statistics: TaskStatistics = useMemo(() => {
    const total = currentMonthTasks.length;
    const completed = currentMonthTasks.filter(t => 
      getCustomFieldValue(t, 'Estado') === 'Ejecutado' || getCustomFieldValue(t, 'Estado') === 'Reprogramado'
    ).length;
    const pending = total - completed;
    const completionPercentage = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      completed,
      pending,
      completionPercentage,
      byAssignee: {},
      byResponsable: {}
    };
  }, [currentMonthTasks]);

  // Obtener valores únicos del campo Area
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    currentMonthTasks.forEach(task => {
      const area = getCustomFieldValue(task, 'Area');
      if (area && area !== '-') {
        areas.add(area);
      }
    });
    return Array.from(areas).sort();
  }, [currentMonthTasks]);

  // Actividades del mes actual: Atrasadas, En Proceso, y Ejecutadas
  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filtered = currentMonthTasks.filter(t => {
      if (getCustomFieldValue(t, 'Estado') !== 'En Proceso') return false;
      
      if (!t.due_on) return false;
      
      const [year, month, day] = t.due_on.split('-').map(Number);
      const dueDate = new Date(year, month - 1, day);
      dueDate.setHours(0, 0, 0, 0);
      
      return dueDate < today;
    });
    
    if (areaFilter !== 'todas') {
      filtered = filtered.filter(t => 
        getCustomFieldValue(t, 'Area') === areaFilter
      );
    }
    
    return filtered.sort((a, b) => {
      const dateA = a.due_on || a.start_on || '';
      const dateB = b.due_on || b.start_on || '';
      return dateA.localeCompare(dateB);
    });
  }, [currentMonthTasks, areaFilter]);

  const inProcessTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filtered = currentMonthTasks.filter(t => {
      if (getCustomFieldValue(t, 'Estado') !== 'En Proceso') return false;
      
      if (!t.due_on) return true; // Sin fecha de fin, se considera en proceso normal
      
      const [year, month, day] = t.due_on.split('-').map(Number);
      const dueDate = new Date(year, month - 1, day);
      dueDate.setHours(0, 0, 0, 0);
      
      return dueDate >= today;
    });
    
    if (areaFilter !== 'todas') {
      filtered = filtered.filter(t => 
        getCustomFieldValue(t, 'Area') === areaFilter
      );
    }
    
    return filtered.sort((a, b) => {
      const dateA = a.due_on || a.start_on || '';
      const dateB = b.due_on || b.start_on || '';
      return dateA.localeCompare(dateB);
    });
  }, [currentMonthTasks, areaFilter]);

  const executedTasks = useMemo(() => {
    let filtered = currentMonthTasks.filter(t => 
      getCustomFieldValue(t, 'Estado') === 'Ejecutado' || getCustomFieldValue(t, 'Estado') === 'Reprogramado'
    );
    
    if (areaFilter !== 'todas') {
      filtered = filtered.filter(t => 
        getCustomFieldValue(t, 'Area') === areaFilter
      );
    }
    
    return filtered.sort((a, b) => {
      const dateA = a.due_on || a.start_on || '';
      const dateB = b.due_on || b.start_on || '';
      return dateA.localeCompare(dateB);
    });
  }, [currentMonthTasks, areaFilter]);

  const getEstadoSelectStyle = (estado: string, isOverdue?: boolean): React.CSSProperties => {
    if (estado === 'Ejecutado') return { backgroundColor: '#c8f5c8', color: '#166534', border: '1px solid #16a34a', fontWeight: 700 };
    if (estado === 'En Proceso' && isOverdue) return { backgroundColor: '#fecaca', color: '#7f1d1d', border: '1px solid #dc2626', fontWeight: 700 };
    if (estado === 'En Proceso') return { backgroundColor: '#bfdbfe', color: '#1e3a8a', border: '1px solid #2563eb', fontWeight: 700 };
    if (estado === 'Reprogramado') return { backgroundColor: '#e9d5ff', color: '#4c1d95', border: '1px solid #7c3aed', fontWeight: 700 };
    return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #9ca3af' };
  };

  const handleEstadoChange = async (task: AsanaTask, newEstado: string) => {
    const estadoField = task.custom_fields?.find(f => f.name === 'Estado');
    if (!estadoField?.gid) return;
    const enumOption = estadoField.enum_options?.find(o => o.name === newEstado);
    if (!enumOption?.gid) return;
    setUpdatingTaskGid(task.gid);
    try {
      const updated = await asanaService.updateTask(task.gid, {
        custom_fields: { [estadoField.gid]: enumOption.gid }
      });
      setTasks(prev => prev.map(t => t.gid === task.gid ? { ...t, ...updated } : t));
    } catch (err) {
      alert('Error al actualizar el estado de la actividad.');
      console.error(err);
    } finally {
      setUpdatingTaskGid(null);
    }
  };

  const projectName = projects.find(p => p.gid === selectedProject)?.name || 'Planificación';

  // Handlers para exportación de reportes
  const handleExportCalendar = async () => {
    setExportingCalendar(true);
    try {
      await exportCalendarViewToPDF({
        events,
        currentMonthTasks,
        statistics,
        date,
        projectName
      });
    } catch (error) {
      console.error('Error al exportar calendario:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    } finally {
      setExportingCalendar(false);
    }
  };

  const handleExportTables = async () => {
    setExportingTables(true);
    try {
      await exportTasksTablesToPDF({
        executedTasks,
        overdueTasks,
        inProcessTasks,
        date,
        projectName,
        areaFilter
      });
    } catch (error) {
      console.error('Error al exportar tablas:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    } finally {
      setExportingTables(false);
    }
  };

  const handleExportTablesWord = async () => {
    setExportingTablesWord(true);
    try {
      await exportTasksTablesToWord({
        executedTasks,
        overdueTasks,
        inProcessTasks,
        date,
        projectName,
        areaFilter
      });
    } catch (error) {
      console.error('Error al exportar informe Word:', error);
      alert('Error al generar el Word. Por favor, intenta de nuevo.');
    } finally {
      setExportingTablesWord(false);
    }
  };

  const handleExportSchedule = async () => {
    setExportingSchedule(true);
    try {
      await exportMonthlyCalendarSchedule({
        tasks: currentMonthTasks,
        date,
        projectName
      });
    } catch (error) {
      console.error('Error al exportar cronograma:', error);
      alert('Error al generar el cronograma. Por favor, intenta de nuevo.');
    } finally {
      setExportingSchedule(false);
    }
  };

  const handleExportScheduleWord = async () => {
    setExportingScheduleWord(true);
    try {
      await exportMonthlyCalendarScheduleWord({
        tasks: currentMonthTasks,
        date,
        projectName
      });
    } catch (error) {
      console.error('Error al exportar cronograma Word:', error);
      alert('Error al generar el cronograma Word. Por favor, intenta de nuevo.');
    } finally {
      setExportingScheduleWord(false);
    }
  };

  // Estilos personalizados para los eventos
  const eventStyleGetter = (event: CalendarEvent) => {
    const isEjecutadoOReprogramado = event.resource.estado === 'Ejecutado' || event.resource.estado === 'Reprogramado';
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Resetear a medianoche para comparación justa
    
    // Verificar si está atrasada (no ejecutada/reprogramada y fecha de fin ya pasó)
    const isOverdue = !isEjecutadoOReprogramado && event.end < today;
    
    // Obtener colores únicos basados en el ID de la actividad
    const colors = isOverdue 
      ? { bg: '#ffebee', border: '#c62828', text: '#b71c1c' } // Rojo para atrasadas
      : isEjecutadoOReprogramado
        ? { bg: '#f0f0f0', border: '#aaaaaa', text: '#666666' } // Gris suave para ejecutadas/reprogramadas
        : getTaskColor(event.id);

    return {
      style: {
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '6px',
        opacity: isEjecutadoOReprogramado ? 0.65 : 1,
        color: colors.text,
        fontSize: '0.875rem',
        fontWeight: isOverdue ? 600 : 500, // Más negrita si está atrasada
        padding: '4px 8px',
        boxShadow: isOverdue ? '0 2px 6px rgba(198, 40, 40, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
      }
    };
  };

  // Mensajes personalizados en español
  const messages = {
    allDay: 'Todo el día',
    previous: 'Anterior',
    next: 'Siguiente',
    today: 'Hoy',
    month: 'Mes',
    week: 'Semana',
    day: 'Día',
    agenda: 'Agenda',
    date: 'Fecha',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'No hay actividades en este rango de fechas',
    showMore: (total: number) => `+ (${total}) más`
  };

  // Formatos de fecha personalizados
  const formats = {
    dayHeaderFormat: (date: Date) => format(date, 'EEEE d', { locale: es }),
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`,
    monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: es }).toUpperCase(),
    weekdayFormat: (date: Date) => format(date, 'EEE', { locale: es }),
  };

  if (loading) {
    return <LoadingOverlay message="Cargando planificación..." />;
  }

  if (error) {
    return (
      <div className="planning-page">
        <h1 className="page-title">Planificación</h1>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="planning-page">
      {/* Header */}
      <div className="planning-header">
        <div className="planning-header-left">
          <div className="planning-icon">📅</div>
          <div className="planning-info">
            <h1 className="planning-title">{projectName}</h1>
            <p className="planning-subtitle">
              {moment(date).format('MMMM YYYY')} · {currentMonthTasks.length} {currentMonthTasks.length === 1 ? 'actividad programada' : 'actividades programadas'} · {statistics.completed} ejecutadas · {statistics.pending} en proceso
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="planning-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'linear-gradient(135deg, #FFE5E5, #E5F4E5, #E5E5FF, #FFF4E5)' }}></div>
          <span>Cada color representa una actividad diferente</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ffebee', border: '2px solid #c62828' }}></div>
          <span>Actividades atrasadas (no ejecutadas y fecha vencida)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#999', opacity: 0.65 }}></div>
          <span>Opacidad reducida indica actividad ejecutada o reprogramada</span>
        </div>
        <div className="legend-item">
          <span style={{ fontWeight: 600, color: '#666' }}>
            📌 Los nombres entre paréntesis indican responsables de actividad
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="planning-calendar-container">
        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="btn-export-ghost"
            onClick={handleExportCalendar}
            disabled={exportingCalendar || events.length === 0}
            title="Exportar actividades del mes a PDF"
          >
            {exportingCalendar ? 'Exportando...' : '📄 Actividades PDF'}
          </button>
          <button
            className="btn-export-ghost"
            onClick={handleExportSchedule}
            disabled={exportingSchedule || currentMonthTasks.length === 0}
            title="Exportar cronograma mensual a PDF"
          >
            {exportingSchedule ? 'Exportando...' : '📋 Cronograma PDF'}
          </button>
          <button
            className="btn-export-ghost"
            onClick={handleExportScheduleWord}
            disabled={exportingScheduleWord || currentMonthTasks.length === 0}
            title="Exportar cronograma mensual a Word (.docx)"
          >
            {exportingScheduleWord ? 'Exportando...' : '📝 Cronograma Word'}
          </button>
        </div>
        
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: view === 'month' ? '1200px' : view === 'week' ? '800px' : '600px' }}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          messages={messages}
          formats={formats}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(event) => setSelectedEvent(event)}
          selectable
          step={60}
          showMultiDayTimes
          defaultView="month"
          views={['month', 'week', 'day']}
          dayLayoutAlgorithm="no-overlap"
        />
      </div>

      {/* Estadísticas del mes actual */}
      {currentMonthTasks.length > 0 && (
        <>
          <StatisticsSection statistics={statistics} />

          {/* Filtro y Exportar - Compartido para ambas tablas */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            alignItems: 'center', 
            gap: '1rem', 
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="area-filter" style={{ fontWeight: 500, color: '#666' }}>
                Filtrar por área:
              </label>
              <select
                id="area-filter"
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  minWidth: '200px'
                }}
              >
                <option value="todas">Todas las áreas</option>
                {uniqueAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
              {areaFilter !== 'todas' && (
                <button
                  onClick={() => setAreaFilter('todas')}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#e0e0e0',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#666',
                    fontWeight: 500
                  }}
                  title="Limpiar filtro"
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
            <button
              className="btn-export-ghost"
              onClick={handleExportTables}
              disabled={exportingTables || (overdueTasks.length === 0 && inProcessTasks.length === 0 && executedTasks.length === 0)}
              title="Exportar tablas a PDF"
            >
              {exportingTables ? 'Exportando...' : '📄 Informe PDF'}
            </button>
            <button
              className="btn-export-ghost"
              onClick={handleExportTablesWord}
              disabled={exportingTablesWord || (overdueTasks.length === 0 && inProcessTasks.length === 0 && executedTasks.length === 0)}
              title="Exportar tablas a Word"
            >
              {exportingTablesWord ? 'Exportando...' : '📝 Informe Word'}
            </button>
          </div>

          {/* Tabla 1: Actividades En Proceso (Atrasadas) */}
          <div className="card">
            <h2 style={{ color: '#d32f2f', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚠️ Actividades En Proceso (Atrasadas) - {moment(date).format('MMMM YYYY')}
            </h2>
            
            {overdueTasks.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                {areaFilter !== 'todas' 
                  ? `No hay actividades atrasadas en el área "${areaFilter}" en este mes`
                  : 'No hay actividades atrasadas en este mes'
                }
              </p>
            ) : (
              <div className="planning-tasks-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#fafafa' }}>
                      <th style={{ padding: '0.875rem', textAlign: 'left', fontWeight: 600, color: '#333', width: '65%' }}>Actividad</th>
                      <th style={{ padding: '0.875rem', textAlign: 'left', fontWeight: 600, color: '#333', width: '20%' }}>Fecha</th>
                      <th style={{ padding: '0.875rem', textAlign: 'center', fontWeight: 600, color: '#333', width: '15%' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueTasks.map((task, index) => (
                      <tr 
                        key={task.gid}
                        style={{ 
                          borderBottom: index < overdueTasks.length - 1 ? '1px solid #f0f0f0' : 'none',
                          backgroundColor: 'white'
                        }}
                      >
                        <td style={{ padding: '0.875rem', verticalAlign: 'top' }}>
                          <div>
                            <div style={{ fontWeight: 500, color: '#333', lineHeight: '1.4' }}>
                              {task.name}
                            </div>
                            {task.parent && (
                              <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                                Subactividad de: {task.parent.name}
                              </div>
                            )}
                            {(() => {
                              const area = getCustomFieldValue(task, 'Area');
                              return area && area !== '-' ? (
                                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ opacity: 0.6 }}>📂</span> {area}
                                </div>
                              ) : null;
                            })()}
                            {(() => {
                              const resp = getCustomFieldValue(task, 'Responsables de actividad');
                              return resp && resp !== '-' ? (
                                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ opacity: 0.6 }}>👤</span> {resp}
                                </div>
                              ) : null;
                            })()} 
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem', color: '#555', verticalAlign: 'top' }}>
                          {(() => {
                            const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
                            const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
                            if (inicio && fin) return `${inicio} - ${fin}`;
                            if (inicio) return inicio;
                            if (fin) return fin;
                            return '-';
                          })()}
                        </td>
                        <td style={{ padding: '0.875rem', textAlign: 'center', verticalAlign: 'top' }}>
                          {updatingTaskGid === task.gid ? (
                            <span style={{ fontSize: '0.8rem', color: '#999' }}>Actualizando...</span>
                          ) : (() => {
                            const estadoActual = getCustomFieldValue(task, 'Estado');
                            const opciones = task.custom_fields?.find(f => f.name === 'Estado')?.enum_options ?? [];
                            return (
                              <select
                                value={estadoActual}
                                onChange={e => handleEstadoChange(task, e.target.value)}
                                style={{
                                  padding: '0.375rem 0.5rem',
                                  borderRadius: '6px',
                                  fontSize: '0.813rem',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  ...getEstadoSelectStyle(estadoActual, true),
                                }}
                              >
                                {opciones.length === 0 && <option value={estadoActual}>{estadoActual}</option>}
                                {opciones.map(opt => (
                                  <option key={opt.gid} value={opt.name}>{opt.name}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabla 2: Actividades En Proceso */}
          <div className="card">
            <h2>Actividades En Proceso - {moment(date).format('MMMM YYYY')}</h2>
            
            {inProcessTasks.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                {areaFilter !== 'todas' 
                  ? `No hay actividades en proceso en el área "${areaFilter}" en este mes`
                  : 'No hay actividades en proceso en este mes'
                }
              </p>
            ) : (
              <div className="planning-tasks-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#fafafa' }}>
                      <th style={{ padding: '0.875rem', textAlign: 'left', fontWeight: 600, color: '#333', width: '65%' }}>Actividad</th>
                      <th style={{ padding: '0.875rem', textAlign: 'left', fontWeight: 600, color: '#333', width: '20%' }}>Fecha</th>
                      <th style={{ padding: '0.875rem', textAlign: 'center', fontWeight: 600, color: '#333', width: '15%' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inProcessTasks.map((task, index) => (
                      <tr 
                        key={task.gid}
                        style={{ 
                          borderBottom: index < inProcessTasks.length - 1 ? '1px solid #f0f0f0' : 'none',
                          backgroundColor: 'white'
                        }}
                      >
                        <td style={{ padding: '0.875rem', verticalAlign: 'top' }}>
                          <div>
                            <div style={{ fontWeight: 500, color: '#333', lineHeight: '1.4' }}>
                              {task.name}
                            </div>
                            {task.parent && (
                              <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                                Subactividad de: {task.parent.name}
                              </div>
                            )}
                            {(() => {
                              const area = getCustomFieldValue(task, 'Area');
                              return area && area !== '-' ? (
                                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ opacity: 0.6 }}>📂</span> {area}
                                </div>
                              ) : null;
                            })()}
                            {(() => {
                              const resp = getCustomFieldValue(task, 'Responsables de actividad');
                              return resp && resp !== '-' ? (
                                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ opacity: 0.6 }}>👤</span> {resp}
                                </div>
                              ) : null;
                            })()} 
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem', color: '#555', verticalAlign: 'top' }}>
                          {(() => {
                            const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
                            const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
                            if (inicio && fin) return `${inicio} - ${fin}`;
                            if (inicio) return inicio;
                            if (fin) return fin;
                            return '-';
                          })()}
                        </td>
                        <td style={{ padding: '0.875rem', textAlign: 'center', verticalAlign: 'top' }}>
                          {updatingTaskGid === task.gid ? (
                            <span style={{ fontSize: '0.8rem', color: '#999' }}>Actualizando...</span>
                          ) : (() => {
                            const estadoActual = getCustomFieldValue(task, 'Estado');
                            const opciones = task.custom_fields?.find(f => f.name === 'Estado')?.enum_options ?? [];
                            return (
                              <select
                                value={estadoActual}
                                onChange={e => handleEstadoChange(task, e.target.value)}
                                style={{
                                  padding: '0.375rem 0.5rem',
                                  borderRadius: '6px',
                                  fontSize: '0.813rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  ...getEstadoSelectStyle(estadoActual),
                                }}
                              >
                                {opciones.length === 0 && <option value={estadoActual}>{estadoActual}</option>}
                                {opciones.map(opt => (
                                  <option key={opt.gid} value={opt.name}>{opt.name}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabla 3: Actividades Ejecutadas */}
          <div className="card">
            <h2>Actividades Ejecutadas / Reprogramadas - {moment(date).format('MMMM YYYY')}</h2>
            
            {executedTasks.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                {areaFilter !== 'todas' 
                  ? `No hay actividades ejecutadas o reprogramadas en el área "${areaFilter}" en este mes`
                  : 'No hay actividades ejecutadas o reprogramadas en este mes'
                }
              </p>
            ) : (
              <div className="planning-tasks-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#fafafa' }}>
                      <th style={{ padding: '0.875rem', textAlign: 'left', fontWeight: 600, color: '#333', width: '65%' }}>Actividad</th>
                      <th style={{ padding: '0.875rem', textAlign: 'left', fontWeight: 600, color: '#333', width: '20%' }}>Fecha</th>
                      <th style={{ padding: '0.875rem', textAlign: 'center', fontWeight: 600, color: '#333', width: '15%' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executedTasks.map((task, index) => (
                      <tr 
                        key={task.gid}
                        style={{ 
                          borderBottom: index < executedTasks.length - 1 ? '1px solid #f0f0f0' : 'none',
                          backgroundColor: 'white'
                        }}
                      >
                        <td style={{ padding: '0.875rem', verticalAlign: 'top' }}>
                          <div>
                            <div style={{ fontWeight: 500, color: '#333', lineHeight: '1.4' }}>
                              {task.name}
                            </div>
                            {task.parent && (
                              <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                                Subactividad de: {task.parent.name}
                              </div>
                            )}
                            {(() => {
                              const area = getCustomFieldValue(task, 'Area');
                              return area && area !== '-' ? (
                                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ opacity: 0.6 }}>📂</span> {area}
                                </div>
                              ) : null;
                            })()}
                            {(() => {
                              const resp = getCustomFieldValue(task, 'Responsables de actividad');
                              return resp && resp !== '-' ? (
                                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ opacity: 0.6 }}>👤</span> {resp}
                                </div>
                              ) : null;
                            })()} 
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem', color: '#555', verticalAlign: 'top' }}>
                          {(() => {
                            const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
                            const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
                            if (inicio && fin) return `${inicio} - ${fin}`;
                            if (inicio) return inicio;
                            if (fin) return fin;
                            return '-';
                          })()}
                        </td>
                        <td style={{ padding: '0.875rem', textAlign: 'center', verticalAlign: 'top' }}>
                          {updatingTaskGid === task.gid ? (
                            <span style={{ fontSize: '0.8rem', color: '#999' }}>Actualizando...</span>
                          ) : (() => {
                            const estadoActual = getCustomFieldValue(task, 'Estado');
                            const opciones = task.custom_fields?.find(f => f.name === 'Estado')?.enum_options ?? [];
                            return (
                              <select
                                value={estadoActual}
                                onChange={e => handleEstadoChange(task, e.target.value)}
                                style={{
                                  padding: '0.375rem 0.5rem',
                                  borderRadius: '6px',
                                  fontSize: '0.813rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  ...getEstadoSelectStyle(estadoActual),
                                }}
                              >
                                {opciones.length === 0 && <option value={estadoActual}>{estadoActual}</option>}
                                {opciones.map(opt => (
                                  <option key={opt.gid} value={opt.name}>{opt.name}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Task Detail Modal */}
      {selectedEvent && (
        <div className="task-detail-modal" onClick={() => setSelectedEvent(null)}>
          <div className="task-detail-content" onClick={(e) => e.stopPropagation()}>

            {/* Franja Wiphala */}
            <div style={{ display: 'flex', height: 5, overflow: 'hidden', borderRadius: '16px 16px 0 0' }}>
              {['#D32F2F','#E65100','#F9A825','#388E3C','#1565C0','#6A1B9A','#880E4F'].map((color, i) => (
                <div key={i} style={{ flex: 1, backgroundColor: color }} />
              ))}
            </div>

            {/* Cabecera */}
            <div className="task-detail-header" style={{ background: 'linear-gradient(180deg, #f8faff 0%, #ffffff 100%)', alignItems: 'flex-start', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)', fontSize: 20
                }}>📅</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a2332', lineHeight: 1.35, wordBreak: 'break-word' }}>
                    {selectedEvent.title}
                  </div>
                  {selectedEvent.resource.area && selectedEvent.resource.area !== '-' && (
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ opacity: 0.7 }}>📂</span> {selectedEvent.resource.area}
                    </div>
                  )}
                </div>
              </div>
              <button className="close-btn" style={{ flexShrink: 0, marginTop: '0.1rem' }} onClick={() => setSelectedEvent(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Cuerpo */}
            <div className="task-detail-body">
              {selectedEvent.resource.isSubtask && (
                <div className="task-detail-field">
                  <span className="field-label">🔗 Actividad padre:</span>
                  <span className="field-value">{selectedEvent.resource.parentName}</span>
                </div>
              )}

              <div className="task-detail-field">
                <span className="field-label">📅 Inicio:</span>
                <span className="field-value">{moment(selectedEvent.start).format('DD/MM/YYYY')}</span>
              </div>

              <div className="task-detail-field">
                <span className="field-label">📅 Fin:</span>
                <span className="field-value">{moment(selectedEvent.end).format('DD/MM/YYYY')}</span>
              </div>

              {selectedEvent.resource.responsables && selectedEvent.resource.responsables !== '-' && (
                <div className="task-detail-field">
                  <span className="field-label">👤 Responsables:</span>
                  <span className="field-value">{selectedEvent.resource.responsables}</span>
                </div>
              )}

              <div className="task-detail-field">
                <span className="field-label">Estado:</span>
                <span className={`status-badge ${
                  selectedEvent.resource.estado === 'Ejecutado' ? 'completed' :
                  selectedEvent.resource.estado === 'Reprogramado' ? 'reprogrammed' : 'pending'
                }`}>
                  {selectedEvent.resource.estado === 'Ejecutado' ? '✓ Ejecutado' :
                   selectedEvent.resource.estado === 'Reprogramado' ? '↩ Reprogramado' :
                   selectedEvent.resource.estado === 'En Proceso' ? '○ En Proceso' :
                   selectedEvent.resource.estado || '-'}
                </span>
              </div>

              {selectedEvent.resource.notes && (
                <div className="task-detail-field full-width">
                  <span className="field-label">📝 Notas:</span>
                  <p className="field-notes">{selectedEvent.resource.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanningPage;