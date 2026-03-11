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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTaskColor } from '../utils/colors';

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
  const [view, setView] = useState<View>('week');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [exporting, setExporting] = useState(false);

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
      setError(err instanceof Error ? err.message : 'Error al cargar tareas');
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

        return {
          id: task.gid,
          title: titleWithResponsibles,
          start: startDate,
          end: endDate,
          resource: {
            taskGid: task.gid,
            completed: task.completed,
            assignee: task.assignee?.name,
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
    const completed = currentMonthTasks.filter(t => t.completed).length;
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

  // Tareas ejecutadas y pendientes del mes actual
  const executedTasks = useMemo(() => {
    return currentMonthTasks.filter(t => t.completed);
  }, [currentMonthTasks]);

  const pendingTasks = useMemo(() => {
    return currentMonthTasks.filter(t => !t.completed);
  }, [currentMonthTasks]);

  const projectName = projects.find(p => p.gid === selectedProject)?.name || 'Planificación';

  // Función para exportar a PDF
  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Configuración de márgenes según estándar de otros reportes
      const margins = {
        top: 25,
        bottom: 25,
        left: 30,
        right: 25
      };

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Título principal - H1: 20pt (Negrita)
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Calendario de Planificación - CDIMA', pageWidth / 2, margins.top, { align: 'center' });
      
      // Información del proyecto - Cuerpo: 10pt
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Proyecto: ${projectName}`, margins.left, margins.top + 10);
      pdf.text(`Período: ${format(date, 'MMMM yyyy', { locale: es })}`, margins.left, margins.top + 15);
      pdf.text(`Fecha de generación: ${format(new Date(), 'dd/MM/yyyy', { locale: es })}`, margins.left, margins.top + 20);
      
      // Línea separadora
      pdf.setLineWidth(0.5);
      pdf.line(margins.left, margins.top + 23, pageWidth - margins.right, margins.top + 23);

      // Calcular rango del mes
      const startOfMonth = moment(date).startOf('month');
      const endOfMonth = moment(date).endOf('month');
      
      // Ajustar al lunes de la primera semana
      const firstDay = moment(startOfMonth).isoWeekday(1);
      const lastDay = moment(endOfMonth).isoWeekday(7);
      
      // Crear estructura de la tabla - una fila por actividad
      const headers = [['Día', 'Fecha', 'Actividad', 'Estado']];
      const body: any[][] = [];
      
      // Iterar por cada día del rango
      const current = moment(firstDay);
      
      while (current.isSameOrBefore(lastDay)) {
        const isCurrentMonth = current.month() === moment(date).month();
        
        if (isCurrentMonth) {
          // Encontrar tareas para este día
          const dayTasks = events.filter(event => {
            const eventDay = moment(event.start);
            return eventDay.isSame(current, 'day');
          });
          
          if (dayTasks.length > 0) {
            // Crear una fila por cada actividad
            dayTasks.forEach((task, index) => {
              const dayName = format(current.toDate(), 'EEEE', { locale: es });
              const dayNumber = current.date();
              const status = task.resource.completed ? 'Completada' : 'Pendiente';
              
              const rowStyles: any = {};
              if (task.resource.completed) {
                rowStyles.fillColor = [232, 245, 233];
              } else {
                rowStyles.fillColor = [255, 243, 224];
              }
              
              // Si es la primera actividad del día, mostrar el día y fecha
              // Si no, dejar celdas vacías para agrupar visualmente
              if (index === 0) {
                body.push([
                  { content: dayName.charAt(0).toUpperCase() + dayName.slice(1), styles: rowStyles },
                  { content: dayNumber.toString(), styles: rowStyles },
                  { content: task.title, styles: rowStyles },
                  { content: status, styles: rowStyles }
                ]);
              } else {
                body.push([
                  { content: '', styles: rowStyles },
                  { content: '', styles: rowStyles },
                  { content: task.title, styles: rowStyles },
                  { content: status, styles: rowStyles }
                ]);
              }
            });
          } else {
            // Día sin actividades
            const dayName = format(current.toDate(), 'EEEE', { locale: es });
            const dayNumber = current.date();
            
            body.push([
              { content: dayName.charAt(0).toUpperCase() + dayName.slice(1), styles: { fillColor: [250, 250, 250] } },
              { content: dayNumber.toString(), styles: { fillColor: [250, 250, 250] } },
              { content: 'Sin actividades', styles: { fillColor: [250, 250, 250], textColor: [150, 150, 150], fontStyle: 'italic' } },
              { content: '-', styles: { fillColor: [250, 250, 250], textColor: [150, 150, 150] } }
            ]);
          }
        }
        
        current.add(1, 'day');
      }
      
      // Generar tabla con autoTable
      autoTable(pdf, {
        head: headers,
        body: body,
        startY: margins.top + 28,
        margin: { left: margins.left, right: margins.right },
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 4,
          overflow: 'linebreak',
          cellWidth: 'wrap',
          valign: 'middle',
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [70, 130, 180],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 10,
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' },    // Día
          1: { cellWidth: 20, halign: 'center' },  // Fecha
          2: { cellWidth: 'auto' },                 // Actividad (ancho automático)
          3: { cellWidth: 30, halign: 'center' },  // Estado
        },
      });
      
      // Agregar estadísticas al final
      const finalY = (pdf as any).lastAutoTable.finalY + 10;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumen del Período:', margins.left, finalY);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Total de tareas: ${currentMonthTasks.length}`, margins.left, finalY + 5);
      pdf.text(`Completadas: ${statistics.completed}`, margins.left + 50, finalY + 5);
      pdf.text(`Pendientes: ${statistics.pending}`, margins.left + 95, finalY + 5);
      pdf.text(`Progreso: ${statistics.completionPercentage.toFixed(1)}%`, margins.left + 135, finalY + 5);

      // Guardar PDF
      const fileName = `Calendario_${projectName.replace(/\s+/g, '_')}_${format(date, 'yyyy-MM', { locale: es })}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  // Estilos personalizados para los eventos
  const eventStyleGetter = (event: CalendarEvent) => {
    const isCompleted = event.resource.completed;
    
    // Obtener colores únicos basados en el ID de la tarea
    const colors = getTaskColor(event.id);

    return {
      style: {
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '6px',
        opacity: isCompleted ? 0.65 : 1,
        color: colors.text,
        fontSize: '0.875rem',
        fontWeight: 500,
        padding: '4px 8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
    noEventsInRange: 'No hay tareas en este rango de fechas',
    showMore: (total: number) => `+ (${total}) más`
  };

  // Formatos de fecha personalizados
  const formats = {
    dayHeaderFormat: (date: Date) => format(date, 'EEEE d', { locale: es }),
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`,
    monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: es }),
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
              {moment(date).format('MMMM YYYY')} · {currentMonthTasks.length} {currentMonthTasks.length === 1 ? 'tarea programada' : 'tareas programadas'} · {statistics.completed} ejecutadas · {statistics.pending} pendientes
            </p>
          </div>
        </div>
        
        {/* View Selector */}
        {/* <div className="planning-view-selector">
          <button
            className={`view-btn ${view === 'month' ? 'active' : ''}`}
            onClick={() => setView('month')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Mes
          </button>
          <button
            className={`view-btn ${view === 'week' ? 'active' : ''}`}
            onClick={() => setView('week')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Semana
          </button>
          <button
            className={`view-btn ${view === 'day' ? 'active' : ''}`}
            onClick={() => setView('day')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
            </svg>
            Día
          </button>
        </div> */}
      </div>

      {/* Legend */}
      <div className="planning-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'linear-gradient(135deg, #FFE5E5, #E5F4E5, #E5E5FF, #FFF4E5)' }}></div>
          <span>Cada color representa una tarea diferente</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#999', opacity: 0.65 }}></div>
          <span>Opacidad reducida indica tarea completada</span>
        </div>
        <div className="legend-item">
          <span style={{ fontWeight: 600, color: '#666' }}>
            📌 Los nombres entre paréntesis indican responsables de actividad
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="planning-calendar-container">
        {/* Export Button */}
        <button
          className="export-pdf-btn"
          onClick={exportToPDF}
          disabled={exporting || events.length === 0}
          title="Exportar a PDF"
          style={{ marginBottom: '1rem' }}
        >
          {exporting ? (
            <>
              <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
              </svg>
              Exportando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar
            </>
          )}
        </button>
        
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
          defaultView="week"
          views={['month', 'week', 'day']}
          dayLayoutAlgorithm="no-overlap"
        />
      </div>

      {/* Estadísticas del mes actual */}
      {currentMonthTasks.length > 0 && (
        <>
          <StatisticsSection statistics={statistics} />

          {/* Tareas Ejecutadas */}
          <div className="card">
            <h2>✓ Tareas Ejecutadas - {moment(date).format('MMMM YYYY')}</h2>
            {executedTasks.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>No hay tareas ejecutadas en este mes</p>
            ) : (
              <div className="planning-tasks-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Tarea</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Responsables de actividad</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Fecha</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#666' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executedTasks.map((task, index) => (
                      <tr 
                        key={task.gid}
                        style={{ 
                          borderBottom: index < executedTasks.length - 1 ? '1px solid #f0f0f0' : 'none',
                          backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>
                          <div>
                            <div style={{ fontWeight: 500, color: '#333' }}>{task.name}</div>
                            {task.parent && (
                              <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem' }}>
                                Subtarea de: {task.parent.name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666' }}>
                          {getCustomFieldValue(task, 'Responsables de actividad')}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666' }}>
                          {(() => {
                            const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
                            const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
                            if (inicio && fin) return `${inicio} - ${fin}`;
                            if (inicio) return inicio;
                            if (fin) return fin;
                            return '-';
                          })()}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            backgroundColor: '#e8f5e9',
                            color: '#2e7d32'
                          }}>
                            ✓ Completada
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tareas Pendientes */}
          <div className="card">
            <h2>○ Tareas Pendientes - {moment(date).format('MMMM YYYY')}</h2>
            {pendingTasks.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>No hay tareas pendientes en este mes</p>
            ) : (
              <div className="planning-tasks-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Tarea</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Responsables de actividad</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Fecha</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#666' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTasks.map((task, index) => (
                      <tr 
                        key={task.gid}
                        style={{ 
                          borderBottom: index < pendingTasks.length - 1 ? '1px solid #f0f0f0' : 'none',
                          backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>
                          <div>
                            <div style={{ fontWeight: 500, color: '#333' }}>{task.name}</div>
                            {task.parent && (
                              <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem' }}>
                                Subtarea de: {task.parent.name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666' }}>
                          {getCustomFieldValue(task, 'Responsables de actividad')}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666' }}>
                          {(() => {
                            const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
                            const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
                            if (inicio && fin) return `${inicio} - ${fin}`;
                            if (inicio) return inicio;
                            if (fin) return fin;
                            return '-';
                          })()}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            backgroundColor: '#fff3e0',
                            color: '#e65100'
                          }}>
                            ○ Pendiente
                          </span>
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
            <div className="task-detail-header">
              <h3>{selectedEvent.title}</h3>
              <button className="close-btn" onClick={() => setSelectedEvent(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="task-detail-body">
              {selectedEvent.resource.isSubtask && (
                <div className="task-detail-field">
                  <span className="field-label">Tarea padre:</span>
                  <span className="field-value">{selectedEvent.resource.parentName}</span>
                </div>
              )}
              
              <div className="task-detail-field">
                <span className="field-label">Inicio:</span>
                <span className="field-value">{moment(selectedEvent.start).format('DD/MM/YYYY')}</span>
              </div>
              
              <div className="task-detail-field">
                <span className="field-label">Fin:</span>
                <span className="field-value">{moment(selectedEvent.end).format('DD/MM/YYYY')}</span>
              </div>
              
              {selectedEvent.resource.assignee && (
                <div className="task-detail-field">
                  <span className="field-label">Asignado a:</span>
                  <span className="field-value">{selectedEvent.resource.assignee}</span>
                </div>
              )}
              
              <div className="task-detail-field">
                <span className="field-label">Estado:</span>
                <span className={`status-badge ${selectedEvent.resource.completed ? 'completed' : 'pending'}`}>
                  {selectedEvent.resource.completed ? '✓ Completada' : '○ Pendiente'}
                </span>
              </div>
              
              {selectedEvent.resource.notes && (
                <div className="task-detail-field full-width">
                  <span className="field-label">Notas:</span>
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
