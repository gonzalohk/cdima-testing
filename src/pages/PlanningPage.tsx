import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, momentLocalizer, View, Event as BigCalendarEvent } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { asanaService } from '../services/asana.service';
import { AsanaTask, AsanaProject, TaskStatistics } from '../types/asana.types';
import LoadingOverlay from '../components/LoadingOverlay';
import StatisticsSection from '../components/StatisticsSection';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getTaskColor } from '../utils/colors';

// Configurar moment en español
moment.locale('es');
const localizer = momentLocalizer(moment);

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
  const calendarRef = useRef<HTMLDivElement>(null);
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

        // Agregar responsable al título si existe
        const titleWithAssignee = task.assignee?.name 
          ? `${task.name} (${task.assignee.name})`
          : task.name;

        return {
          id: task.gid,
          title: titleWithAssignee,
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
    if (!calendarRef.current) return;
    
    setExporting(true);
    try {
      // Capturar el calendario
      const canvas = await html2canvas(calendarRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: view === 'day' ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // Márgenes de 10mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Agregar título
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(projectName, pdfWidth / 2, 10, { align: 'center' });
      
      // Agregar subtítulo con vista y rango
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const viewText = view === 'month' ? 'Vista Mensual' : view === 'week' ? 'Vista Semanal' : 'Vista Diaria';
      const dateText = view === 'month' 
        ? moment(date).format('MMMM YYYY')
        : view === 'week'
        ? `Semana del ${moment(date).startOf('week').format('D MMM')} - ${moment(date).endOf('week').format('D MMM YYYY')}`
        : moment(date).format('D [de] MMMM YYYY');
      pdf.text(`${viewText} - ${dateText}`, pdfWidth / 2, 16, { align: 'center' });

      // Agregar imagen del calendario
      let yPosition = 22;
      if (imgHeight > pdfHeight - yPosition - 10) {
        // Si la imagen es muy alta, dividirla en páginas
        const pageHeight = pdfHeight - yPosition - 10;
        let srcY = 0;
        
        while (srcY < canvas.height) {
          const srcHeight = Math.min(
            (canvas.width * pageHeight) / imgWidth,
            canvas.height - srcY
          );
          
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = srcHeight;
          const ctx = pageCanvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(
              canvas,
              0,
              srcY,
              canvas.width,
              srcHeight,
              0,
              0,
              canvas.width,
              srcHeight
            );
            
            const pageImgData = pageCanvas.toDataURL('image/png');
            if (srcY > 0) pdf.addPage();
            pdf.addImage(pageImgData, 'PNG', 10, yPosition, imgWidth, pageHeight);
          }
          
          srcY += srcHeight;
        }
      } else {
        // Si cabe en una página
        pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);
      }

      // Guardar PDF
      const fileName = `${projectName}_${viewText}_${moment(date).format('YYYY-MM-DD')}.pdf`;
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
    dayHeaderFormat: (date: Date) => moment(date).format('dddd D'),
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('D MMM')} - ${moment(end).format('D MMM YYYY')}`,
    monthHeaderFormat: (date: Date) => moment(date).format('MMMM YYYY'),
    weekdayFormat: (date: Date) => moment(date).format('ddd'),
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
            📌 Los nombres entre paréntesis indican el responsable
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="planning-calendar-container" ref={calendarRef}>
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
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Responsable</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Inicio</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Fin</th>
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
                          {task.assignee?.name || 'Sin asignar'}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666' }}>
                          {task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666' }}>
                          {task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : '-'}
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
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Responsable</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Inicio</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Fin</th>
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
                          {task.assignee?.name || 'Sin asignar'}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666' }}>
                          {task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666' }}>
                          {task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : '-'}
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
