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
import logoInicial from '../assets/logoinicial.png';

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
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [exportingTables, setExportingTables] = useState(false);
  const [exportingCalendar, setExportingCalendar] = useState(false);

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

  // Función para exportar vista de calendario a PDF
  const exportCalendarViewToPDF = async () => {
    setExportingCalendar(true);
    try {
      // Márgenes para diseño ejecutivo
      const margins = {
        top: 20,
        bottom: 20,
        left: 20,
        right: 20
      };

      // Colores del diseño ejecutivo
      const colors = {
        navyBlue: [70, 100, 140],
        forestGreen: [46, 125, 50],
        charcoalGray: [110, 110, 110],
        steelBlue: [69, 123, 157],
        lightGray: [117, 117, 117],
        ultraLightGray: [249, 249, 249],
        white: [255, 255, 255],
        dateHeader: [220, 230, 240]  // Azul claro para fechas
      };

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // ============ ENCABEZADO ============
      
      // Logo CDIMA (lado izquierdo)
      try {
        const logoWidth = 28;
        pdf.addImage(logoInicial, 'PNG', margins.left, margins.top, logoWidth, 0);
      } catch (error) {
        console.error('Error al cargar logo:', error);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
        pdf.text('CDIMA', margins.left, margins.top + 8);
      }
      
      // Título Principal (lado derecho) - Incluye período
      const periodoHeader = format(date, 'MMMM yyyy', { locale: es }).toUpperCase();
      pdf.setFontSize(15);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
      pdf.text(`CALENDARIO MENSUAL DE ACTIVIDADES - ${periodoHeader}`, pageWidth - margins.right, margins.top + 5, { align: 'right' });
      
      // Metadatos (alineados a la derecha)
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(45, 45, 45);
      
      let metaY = margins.top + 12;
      pdf.text(`PROYECTO: ${projectName}`, pageWidth - margins.right, metaY, { align: 'right' });
      
      metaY += 5;
      const periodoText = format(date, 'MMMM yyyy', { locale: es });
      pdf.text(`PERÍODO: ${periodoText.charAt(0).toUpperCase() + periodoText.slice(1)}`, pageWidth - margins.right, metaY, { align: 'right' });
      
      metaY += 5;
      const fechaGeneracion = `${format(new Date(), 'dd', { locale: es })} de ${format(new Date(), 'MMMM', { locale: es })} de ${format(new Date(), 'yyyy', { locale: es })}`;
      pdf.text(`FECHA DE GENERACIÓN: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });
      
      // Línea separadora
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.3);
      pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

      let startY = metaY + 16;

      // ============ CREAR TABLA DE ACTIVIDADES POR DÍA ============
      const startOfMonth = moment(date).startOf('month');
      const endOfMonth = moment(date).endOf('month');
      
      // Preparar datos para la tabla
      const tableData: any[] = [];
      const current = moment(startOfMonth);

      while (current.isSameOrBefore(endOfMonth)) {
        // Obtener tareas para este día
        const dayTasks = events.filter(event => {
          const eventDay = moment(event.start);
          return eventDay.isSame(current, 'day');
        });

        if (dayTasks.length > 0) {
          // Header de fecha
          const dayName = format(current.toDate(), 'EEEE', { locale: es });
          const dateString = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${current.date()} de ${format(current.toDate(), 'MMMM', { locale: es })}`;
          
          // Agregar fila de fecha como sub-header
          tableData.push([
            {
              content: dateString.toUpperCase(),
              colSpan: 1,
              styles: {
                fillColor: colors.dateHeader,
                textColor: [45, 45, 45],
                fontStyle: 'bold',
                fontSize: 9,
                cellPadding: 5
              }
            }
          ]);

          // Agregar cada tarea en su propia fila
          dayTasks.forEach(task => {
            // Verificar si la tarea está atrasada
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isEjecutado = task.resource.estado === 'Ejecutado';
            const isOverdue = !isEjecutado && task.end < today;
            
            tableData.push([
              {
                content: isOverdue ? `[ATRASADA] ${task.title}` : task.title,
                styles: {
                  fillColor: isOverdue ? [255, 235, 238] : colors.white,
                  textColor: isOverdue ? [183, 28, 28] : [45, 45, 45],
                  fontSize: 8.5,
                  cellPadding: 4,
                  fontStyle: isOverdue ? 'bold' : 'normal'
                }
              }
            ]);
          });
        }
        
        current.add(1, 'day');
      }

      // Si no hay actividades en el mes
      if (tableData.length === 0) {
        tableData.push([
          {
            content: 'No hay actividades programadas en este período',
            styles: {
              fillColor: colors.white,
              textColor: [150, 150, 150],
              fontStyle: 'italic',
              fontSize: 9,
              cellPadding: 10,
              halign: 'center'
            }
          }
        ]);
      }

      // Generar tabla con autoTable
      autoTable(pdf, {
        body: tableData,
        startY: startY,
        margin: { left: margins.left, right: margins.right },
        theme: 'plain',
        styles: {
          overflow: 'linebreak',
          cellWidth: 'wrap',
          valign: 'middle',
          lineColor: [230, 230, 230],
          lineWidth: 0.1,
        },
        tableWidth: 'auto',
        columnStyles: {
          0: { cellWidth: pageWidth - margins.left - margins.right }
        },
      });

      // ============ RESUMEN DEL PERÍODO ============
      const finalY = (pdf as any).lastAutoTable.finalY + 12;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
      pdf.text('RESUMEN DEL PERÍODO', margins.left, finalY);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(45, 45, 45);
      pdf.text(`Total de tareas: ${currentMonthTasks.length}`, margins.left, finalY + 7);
      pdf.text(`Completadas: ${statistics.completed}`, margins.left + 55, finalY + 7);
      pdf.text(`En Proceso: ${statistics.pending}`, margins.left + 105, finalY + 7);
      pdf.text(`Progreso: ${statistics.completionPercentage.toFixed(1)}%`, margins.left + 150, finalY + 7);

      // ============ PIE DE PÁGINA ============
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
      const footerText = `CDIMA - Vista Calendario ${format(date, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(date, 'MMMM yyyy', { locale: es }).slice(1)}`;
      pdf.text(footerText, pageWidth - margins.right, pageHeight - margins.bottom + 10, { align: 'right' });

      // Generar nombre descriptivo y descargar PDF
      const fechaFormato = format(date, 'yyyy-MM', { locale: es });
      const nombreProyecto = projectName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const filename = `Calendario_${nombreProyecto}_${fechaFormato}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error al exportar calendario:', error);
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    } finally {
      setExportingCalendar(false);
    }
  };

  // Función para exportar tablas de tareas a PDF
  const exportTablesToPDF = async () => {
    setExportingTables(true);
    try {
      // Márgenes para diseño ejecutivo
      const margins = {
        top: 20,
        bottom: 20,
        left: 20,
        right: 20
      };

      // Colores del diseño ejecutivo
      const colors = {
        navyBlue: [70, 100, 140],     // Azul marino más claro y sobrio
        forestGreen: [46, 125, 50],   // Verde bosque
        charcoalGray: [110, 110, 110], // Gris más claro y sobrio
        steelBlue: [69, 123, 157],    // Azul acero
        lightGray: [117, 117, 117],   // Gris claro para texto
        ultraLightGray: [249, 249, 249], // Gris ultra-claro para filas
        white: [255, 255, 255]
      };

      const pdf = new jsPDF({
        orientation: 'portrait',  // Formato carta vertical
        unit: 'mm',
        format: 'letter'  // Formato carta (US Letter)
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // ============ ENCABEZADO ============
      
      // Logo CDIMA (lado izquierdo) - Imagen
      try {
        const logoWidth = 28; // Ancho del logo en mm
        // No especificamos altura para mantener proporciones originales
        pdf.addImage(logoInicial, 'PNG', margins.left, margins.top, logoWidth, 0);
      } catch (error) {
        console.error('Error al cargar logo:', error);
        // Fallback a texto si falla la carga de la imagen
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
        pdf.text('CDIMA', margins.left, margins.top + 8);
      }
      
      // Título Principal (lado derecho)
      pdf.setFontSize(15);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
      pdf.text('REPORTE EJECUTIVO DE AVANCE', pageWidth - margins.right, margins.top + 5, { align: 'right' });
      
      // Metadatos (alineados a la derecha)
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(45, 45, 45); // Negro suave
      
      let metaY = margins.top + 12;
      pdf.text(`PROYECTO: ${projectName}`, pageWidth - margins.right, metaY, { align: 'right' });
      
      metaY += 5;
      const periodoText = format(date, 'MMMM yyyy', { locale: es });
      pdf.text(`PERÍODO DE REPORTE: ${periodoText.charAt(0).toUpperCase() + periodoText.slice(1)}`, pageWidth - margins.right, metaY, { align: 'right' });
      
      if (areaFilter !== 'todas') {
        metaY += 5;
        pdf.text(`ÁREA: ${areaFilter}`, pageWidth - margins.right, metaY, { align: 'right' });
      }
      
      metaY += 5;
      const fechaGeneracion = `${format(new Date(), 'dd', { locale: es })} de ${format(new Date(), 'MMMM', { locale: es })} de ${format(new Date(), 'yyyy', { locale: es })}`;
      pdf.text(`FECHA DE GENERACIÓN: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });
      
      // Línea separadora fina
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.3);
      pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

      let startY = metaY + 16;

      // ============ SECCIÓN 1: TAREAS EJECUTADAS ============
      if (executedTasks.length > 0) {
        // Título de sección
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
        pdf.text('TAREAS EJECUTADAS', margins.left, startY);
        
        const executedHeaders = [['TAREA', 'RESPONSABLE(S)', 'FECHA', 'ESTADO']];
        const executedBody = executedTasks.map(task => {
          const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
          const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
          let fecha = '-';
          if (inicio && fin) fecha = fin; // Mostrar solo fecha de fin para ejecutadas
          else if (fin) fecha = fin;
          else if (inicio) fecha = inicio;

          return [
            task.name,
            getCustomFieldValue(task, 'Responsables de actividad'),
            fecha,
            'EJECUTADO'
          ];
        });

        autoTable(pdf, {
          head: executedHeaders,
          body: executedBody,
          startY: startY + 4,
          margin: { left: margins.left, right: margins.right },
          theme: 'plain',
          styles: {
            fontSize: 9,
            cellPadding: 4, // Espaciado amplio
            overflow: 'linebreak',
            cellWidth: 'wrap',
            valign: 'middle',
            textColor: [45, 45, 45],
            lineColor: [230, 230, 230], // Líneas grises muy finas
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: colors.navyBlue, // Azul marino oscuro sólido
            textColor: colors.white,
            fontStyle: 'bold',
            halign: 'left',
            fontSize: 9,
            cellPadding: 5,
          },
          bodyStyles: {
            fillColor: colors.white,
          },
          alternateRowStyles: {
            fillColor: colors.ultraLightGray, // Cebreado sutil
          },
          columnStyles: {
            0: { cellWidth: 68, halign: 'left' },
            1: { cellWidth: 45, halign: 'left' },
            2: { cellWidth: 35, halign: 'left' },
            3: { 
              cellWidth: 30, 
              halign: 'center',
              textColor: colors.forestGreen, // Verde bosque
              fontStyle: 'bold'
            },
          },
        });

        startY = (pdf as any).lastAutoTable.finalY + 12;
      }

      // ============ SECCIÓN 2: TAREAS EN PROCESO ============
      if (pendingTasks.length > 0) {
        // Si no hay espacio suficiente, agregar nueva página
        if (startY > pageHeight - 80) {
          pdf.addPage();
          startY = margins.top + 10;
        }

        // Título de sección
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.charcoalGray[0], colors.charcoalGray[1], colors.charcoalGray[2]);
        pdf.text('TAREAS EN PROCESO', margins.left, startY);
        
        const pendingHeaders = [['TAREA', 'RESPONSABLE(S)', 'FECHA', 'ESTADO']];
        const pendingBody = pendingTasks.map(task => {
          const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
          const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
          let fecha = '-';
          if (inicio) fecha = inicio; // Mostrar solo fecha de inicio para en proceso
          else if (fin) fecha = fin;
          
          // Verificar si está atrasada
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          // Parsear fecha en zona horaria local (Bolivia) para evitar desplazamiento UTC
          let dueDate: Date | null = null;
          if (task.due_on) {
            const [year, month, day] = task.due_on.split('-').map(Number);
            dueDate = new Date(year, month - 1, day);
            dueDate.setHours(0, 0, 0, 0);
          }
          const isOverdue = dueDate && dueDate < today;

          return [
            task.name,
            getCustomFieldValue(task, 'Responsables de actividad'),
            fecha,
            isOverdue ? 'ATRASADA' : 'EN PROCESO'
          ];
        });

        autoTable(pdf, {
          head: pendingHeaders,
          body: pendingBody,
          startY: startY + 4,
          margin: { left: margins.left, right: margins.right },
          theme: 'plain',
          styles: {
            fontSize: 9,
            cellPadding: 4,
            overflow: 'linebreak',
            cellWidth: 'wrap',
            valign: 'middle',
            textColor: [45, 45, 45],
            lineColor: [230, 230, 230],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: colors.charcoalGray, // Gris grafito oscuro sólido
            textColor: colors.white,
            fontStyle: 'bold',
            halign: 'left',
            fontSize: 9,
            cellPadding: 5,
          },
          bodyStyles: {
            fillColor: colors.white,
          },
          alternateRowStyles: {
            fillColor: colors.ultraLightGray,
          },
          columnStyles: {
            0: { cellWidth: 68, halign: 'left' },
            1: { cellWidth: 45, halign: 'left' },
            2: { cellWidth: 35, halign: 'left' },
            3: { 
              cellWidth: 30, 
              halign: 'center',
              fontStyle: 'bold'
            },
          },
        });

        startY = (pdf as any).lastAutoTable.finalY + 10;
      }

      // ============ PIE DE PÁGINA ============
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
      const footerText = `CDIMA - Avance ${format(date, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(date, 'MMMM yyyy', { locale: es }).slice(1)}`;
      pdf.text(footerText, pageWidth - margins.right, pageHeight - margins.bottom + 10, { align: 'right' });

      // Generar nombre descriptivo y descargar PDF
      const fechaFormato = format(date, 'yyyy-MM', { locale: es });
      const nombreProyecto = projectName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const filename = `Avance_Tareas_${nombreProyecto}_${fechaFormato}.pdf`;
      pdf.save(filename);
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
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Resetear a medianoche para comparación justa
    
    // Verificar si está atrasada (no ejecutada y fecha de fin ya pasó)
    const isOverdue = !isEjecutado && event.end < today;
    
    // Obtener colores únicos basados en el ID de la tarea
    const colors = isOverdue 
      ? { bg: '#ffebee', border: '#c62828', text: '#b71c1c' } // Rojo para atrasadas
      : getTaskColor(event.id);

    return {
      style: {
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '6px',
        opacity: isEjecutado ? 0.65 : 1,
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
      </div>

      {/* Legend */}
      <div className="planning-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'linear-gradient(135deg, #FFE5E5, #E5F4E5, #E5E5FF, #FFF4E5)' }}></div>
          <span>Cada color representa una tarea diferente</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ffebee', border: '2px solid #c62828' }}></div>
          <span>Tareas atrasadas (no ejecutadas y fecha vencida)</span>
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
          onClick={exportCalendarViewToPDF}
          disabled={exportingCalendar || events.length === 0}
          title="Exportar vista de calendario a PDF"
          style={{ marginBottom: '1rem' }}
        >
          {exportingCalendar ? 'Exportando...' : '📅 Exportar Calendario'}
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
            <h2>Tareas Ejecutadas - {moment(date).format('MMMM YYYY')}</h2>
            
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
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Responsables</th>
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
                            Ejecutado
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
            <h2>Tareas En Proceso - {moment(date).format('MMMM YYYY')}</h2>
            
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
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Responsables</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#666' }}>Fecha</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#666' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTasks.map((task, index) => {
                      // Verificar si la tarea está atrasada
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      // Parsear fecha en zona horaria local (Bolivia) para evitar desplazamiento UTC
                      let dueDate: Date | null = null;
                      if (task.due_on) {
                        const [year, month, day] = task.due_on.split('-').map(Number);
                        dueDate = new Date(year, month - 1, day);
                        dueDate.setHours(0, 0, 0, 0);
                      }
                      const isOverdue = dueDate && dueDate < today;
                      
                      return (
                        <tr 
                          key={task.gid}
                          style={{ 
                            borderBottom: index < pendingTasks.length - 1 ? '1px solid #f0f0f0' : 'none',
                            backgroundColor: isOverdue ? '#ffebee' : (index % 2 === 0 ? '#fafafa' : 'white')
                          }}
                        >
                          <td style={{ padding: '0.75rem' }}>
                            <div>
                              <div style={{ 
                                fontWeight: isOverdue ? 600 : 500, 
                                color: isOverdue ? '#c62828' : '#333' 
                              }}>
                                {isOverdue && '⚠️ '}{task.name}
                              </div>
                              {task.parent && (
                                <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem' }}>
                                  Subtarea de: {task.parent.name}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', color: isOverdue ? '#b71c1c' : '#666' }}>
                            {getCustomFieldValue(task, 'Responsables de actividad')}
                          </td>
                          <td style={{ padding: '0.75rem', color: isOverdue ? '#b71c1c' : '#666' }}>
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
                              backgroundColor: isOverdue ? '#d32f2f' : '#fff3e0',
                              color: isOverdue ? 'white' : '#e65100'
                            }}>
                              {isOverdue ? 'Atrasada' : 'En Proceso'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
