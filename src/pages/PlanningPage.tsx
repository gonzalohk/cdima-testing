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
    responsables?: string;
    estado?: string;
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
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [exportingTables, setExportingTables] = useState(false);

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
      getCustomFieldValue(t, 'Estado') === 'Ejecutado'
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

  // Tareas ejecutadas y pendientes del mes actual
  const executedTasks = useMemo(() => {
    let filtered = currentMonthTasks.filter(t => 
      getCustomFieldValue(t, 'Estado') === 'Ejecutado'
    );
    
    if (areaFilter !== 'todas') {
      filtered = filtered.filter(t => 
        getCustomFieldValue(t, 'Area') === areaFilter
      );
    }
    
    return filtered;
  }, [currentMonthTasks, areaFilter]);

  const pendingTasks = useMemo(() => {
    let filtered = currentMonthTasks.filter(t => 
      getCustomFieldValue(t, 'Estado') === 'En Proceso'
    );
    
    if (areaFilter !== 'todas') {
      filtered = filtered.filter(t => 
        getCustomFieldValue(t, 'Area') === areaFilter
      );
    }
    
    return filtered;
  }, [currentMonthTasks, areaFilter]);

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
              
              // Obtener estado desde custom field
              const taskData = tasks.find(t => t.gid === task.id);
              const estado = taskData ? getCustomFieldValue(taskData, 'Estado') : '-';
              const status = estado === 'Ejecutado' ? 'Ejecutado' : estado === 'En Proceso' ? 'En Proceso' : '-';
              
              const rowStyles: any = {};
              if (estado === 'Ejecutado') {
                rowStyles.fillColor = [232, 245, 233];
              } else if (estado === 'En Proceso') {
                rowStyles.fillColor = [255, 243, 224];
              } else {
                rowStyles.fillColor = [250, 250, 250];
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
      pdf.text(`En Proceso: ${statistics.pending}`, margins.left + 95, finalY + 5);
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

  // Función para exportar tablas de tareas a PDF
  const exportTablesToPDF = async () => {
    setExportingTables(true);
    try {
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
      
      // Título principal
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Reporte de Tareas - CDIMA', pageWidth / 2, margins.top, { align: 'center' });
      
      // Información del proyecto
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Proyecto: ${projectName}`, margins.left, margins.top + 10);
      pdf.text(`Período: ${format(date, 'MMMM yyyy', { locale: es })}`, margins.left, margins.top + 15);
      if (areaFilter !== 'todas') {
        pdf.text(`Área: ${areaFilter}`, margins.left, margins.top + 20);
      }
      pdf.text(`Fecha de generación: ${format(new Date(), 'dd/MM/yyyy', { locale: es })}`, margins.left, margins.top + (areaFilter !== 'todas' ? 25 : 20));
      
      // Línea separadora
      pdf.setLineWidth(0.5);
      const separatorY = margins.top + (areaFilter !== 'todas' ? 28 : 23);
      pdf.line(margins.left, separatorY, pageWidth - margins.right, separatorY);

      let startY = separatorY + 5;

      // Tabla de Tareas Ejecutadas
      if (executedTasks.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('✓ Tareas Ejecutadas', margins.left, startY + 5);
        
        const executedHeaders = [['Tarea', 'Responsables de actividad', 'Fecha', 'Estado']];
        const executedBody = executedTasks.map(task => {
          const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
          const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
          let fecha = '-';
          if (inicio && fin) fecha = `${inicio} - ${fin}`;
          else if (inicio) fecha = inicio;
          else if (fin) fecha = fin;

          return [
            task.name,
            getCustomFieldValue(task, 'Responsables de actividad'),
            fecha,
            'Ejecutado'
          ];
        });

        autoTable(pdf, {
          head: executedHeaders,
          body: executedBody,
          startY: startY + 8,
          margin: { left: margins.left, right: margins.right },
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
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
          bodyStyles: {
            fillColor: [232, 245, 233],
          },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 50 },
            2: { cellWidth: 40 },
            3: { cellWidth: 30, halign: 'center' },
          },
        });

        startY = (pdf as any).lastAutoTable.finalY + 10;
      }

      // Tabla de Tareas En Proceso
      if (pendingTasks.length > 0) {
        // Si no hay espacio suficiente, agregar nueva página
        if (startY > 160) {
          pdf.addPage();
          startY = margins.top;
        }

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('○ Tareas En Proceso', margins.left, startY + 5);
        
        const pendingHeaders = [['Tarea', 'Responsables de actividad', 'Fecha', 'Estado']];
        const pendingBody = pendingTasks.map(task => {
          const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
          const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
          let fecha = '-';
          if (inicio && fin) fecha = `${inicio} - ${fin}`;
          else if (inicio) fecha = inicio;
          else if (fin) fecha = fin;

          return [
            task.name,
            getCustomFieldValue(task, 'Responsables de actividad'),
            fecha,
            'En Proceso'
          ];
        });

        autoTable(pdf, {
          head: pendingHeaders,
          body: pendingBody,
          startY: startY + 8,
          margin: { left: margins.left, right: margins.right },
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
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
          bodyStyles: {
            fillColor: [255, 243, 224],
          },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 50 },
            2: { cellWidth: 40 },
            3: { cellWidth: 30, halign: 'center' },
          },
        });

        startY = (pdf as any).lastAutoTable.finalY + 10;
      }

      // Resumen
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumen:', margins.left, startY);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Total de tareas ejecutadas: ${executedTasks.length}`, margins.left, startY + 5);
      pdf.text(`Total de tareas en proceso: ${pendingTasks.length}`, margins.left, startY + 10);

      // Guardar PDF
      const areaText = areaFilter !== 'todas' ? `_${areaFilter.replace(/\s+/g, '_')}` : '';
      const fileName = `Tareas_${projectName.replace(/\s+/g, '_')}${areaText}_${format(date, 'yyyy-MM', { locale: es })}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    } finally {
      setExportingTables(false);
    }
  };

  // Estilos personalizados para los eventos
  const eventStyleGetter = (event: CalendarEvent) => {
    const isEjecutado = event.resource.estado === 'Ejecutado';
    
    // Obtener colores únicos basados en el ID de la tarea
    const colors = getTaskColor(event.id);

    return {
      style: {
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '6px',
        opacity: isEjecutado ? 0.65 : 1,
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
              {moment(date).format('MMMM YYYY')} · {currentMonthTasks.length} {currentMonthTasks.length === 1 ? 'tarea programada' : 'tareas programadas'} · {statistics.completed} ejecutadas · {statistics.pending} en proceso
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
          <span>Opacidad reducida indica tarea ejecutada</span>
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
          className="btn-export"
          onClick={exportToPDF}
          disabled={exporting || events.length === 0}
          title="Exportar a PDF"
          style={{ marginBottom: '1rem' }}
        >
          {exporting ? 'Exportando...' : '📄 Exportar'}
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
              className="btn-export"
              onClick={exportTablesToPDF}
              disabled={exportingTables || (executedTasks.length === 0 && pendingTasks.length === 0)}
              title="Exportar tablas a PDF"
            >
              {exportingTables ? 'Exportando...' : '📄 Exportar'}
            </button>
          </div>

          {/* Tareas Ejecutadas */}
          <div className="card">
            <h2>✓ Tareas Ejecutadas - {moment(date).format('MMMM YYYY')}</h2>
            
            {executedTasks.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                {areaFilter !== 'todas' 
                  ? `No hay tareas ejecutadas en el área "${areaFilter}" en este mes`
                  : 'No hay tareas ejecutadas en este mes'
                }
              </p>
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
                            ✓ Ejecutado
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
            <h2>○ Tareas En Proceso - {moment(date).format('MMMM YYYY')}</h2>
            
            {pendingTasks.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                {areaFilter !== 'todas' 
                  ? `No hay tareas en proceso en el área "${areaFilter}" en este mes`
                  : 'No hay tareas en proceso en este mes'
                }
              </p>
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
                            ○ En Proceso
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
              
              {selectedEvent.resource.responsables && selectedEvent.resource.responsables !== '-' && (
                <div className="task-detail-field">
                  <span className="field-label">Responsables de actividad:</span>
                  <span className="field-value">{selectedEvent.resource.responsables}</span>
                </div>
              )}
              
              <div className="task-detail-field">
                <span className="field-label">Estado:</span>
                <span className={`status-badge ${selectedEvent.resource.estado === 'Ejecutado' ? 'completed' : 'pending'}`}>
                  {selectedEvent.resource.estado === 'Ejecutado' ? '✓ Ejecutado' : selectedEvent.resource.estado === 'En Proceso' ? '○ En Proceso' : '-'}
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
