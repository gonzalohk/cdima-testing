import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';
import 'moment/locale/es';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AsanaTask, TaskStatistics } from '../../types/asana.types';
import logoInicial from '../../assets/logoinicial.png';

// Configurar moment en español
moment.locale('es');

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

interface CalendarEvent {
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

interface ExportCalendarParams {
  events: CalendarEvent[];
  currentMonthTasks: AsanaTask[];
  statistics: TaskStatistics;
  date: Date;
  projectName: string;
}

interface ExportTablesParams {
  executedTasks: AsanaTask[];
  pendingTasks: AsanaTask[];
  date: Date;
  projectName: string;
  areaFilter: string;
}

/**
 * Exporta la vista de calendario a PDF
 */
export const exportCalendarViewToPDF = async (params: ExportCalendarParams): Promise<void> => {
  const { events, date, projectName } = params;

  // Forzar locale español para moment
  moment.locale('es');

  // Márgenes para diseño ejecutivo
  const margins = {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20
  };

  // Colores del diseño minimalista
  const colors = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    lightGray: [245, 245, 245],
    headerGray: [220, 220, 220]  // Gris para cabeceras
  };

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
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
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text('CDIMA', margins.left, margins.top + 8);
  }
  
  // Título Principal (lado derecho) - Incluye período
  const periodoHeader = format(date, 'MMMM yyyy', { locale: es }).toUpperCase();
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  pdf.text(`LISTADO MENSUAL DE ACTIVIDADES - ${periodoHeader}`, pageWidth - margins.right, margins.top + 5, { align: 'right' });
  
  // Metadatos (alineados a la derecha)
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  
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
            fillColor: colors.headerGray,
            textColor: colors.black,
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 5
          }
        }
      ]);

      // Agregar cada tarea en su propia fila
      dayTasks.forEach(task => {
        tableData.push([
          {
            content: task.title,
            styles: {
              fillColor: colors.white,
              textColor: colors.black,
              fontSize: 8.5,
              cellPadding: 4,
              fontStyle: 'normal'
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
          textColor: colors.black,
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
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    tableWidth: 'auto',
    columnStyles: {
      0: { cellWidth: pageWidth - margins.left - margins.right }
    },
  });

  // ============ PIE DE PÁGINA ============
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  const footerText = `CDIMA - Listado de Actividades ${format(date, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(date, 'MMMM yyyy', { locale: es }).slice(1)}`;
  pdf.text(footerText, pageWidth - margins.right, pageHeight - margins.bottom + 10, { align: 'right' });

  // Abrir PDF en nueva pestaña
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

/**
 * Exporta las tablas de tareas ejecutadas y pendientes a PDF
 */
export const exportTasksTablesToPDF = async (params: ExportTablesParams): Promise<void> => {
  const { executedTasks, pendingTasks, date, projectName, areaFilter } = params;

  // Forzar locale español para moment
  moment.locale('es');

  // Márgenes para diseño ejecutivo
  const margins = {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20
  };

  // Colores del diseño minimalista
  const colors = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    lightGray: [245, 245, 245],
    headerGray: [220, 220, 220],
    red: [220, 53, 69]  // Rojo para tareas atrasadas
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
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text('CDIMA', margins.left, margins.top + 8);
  }
  
  // Título Principal (lado derecho) - Incluye período
  const periodoHeader = format(date, 'MMMM yyyy', { locale: es }).toUpperCase();
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  pdf.text(`ESTADO DE ACTIVIDADES MENSUALES - ${periodoHeader}`, pageWidth - margins.right, margins.top + 5, { align: 'right' });
  
  // Metadatos (alineados a la derecha)
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  
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

  // ============ SECCIÓN 1: ACTIVIDADES EN PROCESO ============
  if (pendingTasks.length > 0) {
    // Título de sección
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text('ACTIVIDADES EN PROCESO (ATRASADAS)', margins.left, startY);
    
    // Subtítulo con mes y año
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const mesAnio = moment(date).locale('es').format('MMMM YYYY');
    const mesAnioCapitalizado = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);
    pdf.text(mesAnioCapitalizado, margins.left, startY + 5);
    
    const pendingHeaders = [['ACTIVIDAD', 'RESPONSABLE(S)', 'FECHA', 'ESTADO']];
    
    // Crear body con estilos condicionales para tareas atrasadas
    const pendingBody = pendingTasks.map(task => {
      const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
      const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
      let fecha = '-';
      if (inicio) fecha = inicio;
      else if (fin) fecha = fin;
      
      // Verificar si está atrasada
      const today = new Date();
      today.setHours(0, 0, 0, 0);
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
        {
          content: 'EN PROCESO',
          styles: {
            textColor: isOverdue ? colors.red : colors.black
          }
        }
      ];
    });

    autoTable(pdf, {
      head: pendingHeaders,
      body: pendingBody,
      startY: startY + 10,
      margin: { left: margins.left, right: margins.right },
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        valign: 'middle',
        textColor: colors.black,
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: colors.headerGray,
        textColor: colors.black,
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 9,
        cellPadding: 5,
      },
      bodyStyles: {
        fillColor: colors.white,
      },
      columnStyles: {
        0: { cellWidth: 68, halign: 'left' },
        1: { cellWidth: 45, halign: 'left' },
        2: { cellWidth: 35, halign: 'left' },
        3: { 
          cellWidth: 30, 
          halign: 'center',
          textColor: colors.black,
          fontStyle: 'bold'
        },
      },
    });

    startY = (pdf as any).lastAutoTable.finalY + 12;
  }

  // ============ SECCIÓN 2: ACTIVIDADES EJECUTADAS ============
  if (executedTasks.length > 0) {
    // Si no hay espacio suficiente, agregar nueva página
    if (startY > pageHeight - 80) {
      pdf.addPage();
      startY = margins.top + 10;
    }

    // Título de sección
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text('ACTIVIDADES EJECUTADAS', margins.left, startY);
    
    // Subtítulo con mes y año
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const mesAnioEjecutadas = moment(date).locale('es').format('MMMM YYYY');
    const mesAnioEjecutadasCapitalizado = mesAnioEjecutadas.charAt(0).toUpperCase() + mesAnioEjecutadas.slice(1);
    pdf.text(mesAnioEjecutadasCapitalizado, margins.left, startY + 5);
    
    const executedHeaders = [['ACTIVIDAD', 'RESPONSABLE(S)', 'FECHA', 'ESTADO']];
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
      startY: startY + 10,
      margin: { left: margins.left, right: margins.right },
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        valign: 'middle',
        textColor: colors.black,
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: colors.headerGray,
        textColor: colors.black,
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 9,
        cellPadding: 5,
      },
      bodyStyles: {
        fillColor: colors.white,
      },
      columnStyles: {
        0: { cellWidth: 68, halign: 'left' },
        1: { cellWidth: 45, halign: 'left' },
        2: { cellWidth: 35, halign: 'left' },
        3: { 
          cellWidth: 30, 
          halign: 'center',
          textColor: colors.black,
          fontStyle: 'bold'
        },
      },
    });

    startY = (pdf as any).lastAutoTable.finalY + 10;
  }

  // ============ PIE DE PÁGINA ============
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  const footerText = `CDIMA - Estado de Actividades ${format(date, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(date, 'MMMM yyyy', { locale: es }).slice(1)}`;
  pdf.text(footerText, pageWidth - margins.right, pageHeight - margins.bottom + 10, { align: 'right' });

  // Abrir PDF en nueva pestaña
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

/**
 * Estructura de datos para el cronograma mensual
 */
interface WeekData {
  title: string; // "Semana 1 (3 - 9 Nov)"
  areas: AreaData[];
}

interface AreaData {
  name: string; // "CDIMA"
  days: {
    monday: string[];
    tuesday: string[];
    wednesday: string[];
    thursday: string[];
    friday: string[];
    saturday: string[];
    sunday: string[];
  };
}

interface MonthlyScheduleData {
  month: string; // "Noviembre"
  year: number;  // 2025
  weeks: WeekData[];
}

interface ExportMonthlyScheduleParams {
  tasks: AsanaTask[];
  date: Date;
  projectName: string;
}

/**
 * Exporta el cronograma mensual en formato de calendario semanal
 * 
 * Genera un reporte PDF que muestra un calendario mensual donde:
 * - Cada sección representa una semana del mes
 * - Cada semana contiene una tabla con los días de la semana como columnas
 * - Las filas representan diferentes áreas o departamentos
 * - Cada celda contiene las actividades programadas para esa área en ese día específico
 * 
 * @param params - Parámetros de exportación
 * @param params.tasks - Tareas del mes a mostrar en el cronograma
 * @param params.date - Fecha del mes actual para generar el cronograma
 * @param params.projectName - Nombre del proyecto para incluir en el encabezado
 */
export const exportMonthlyCalendarSchedule = async (params: ExportMonthlyScheduleParams): Promise<void> => {
  const { tasks, date } = params;

  // Forzar locale español para moment
  moment.locale('es');

  // ============ PREPARAR DATOS ============
  
  // Obtener todas las áreas únicas
  const areasSet = new Set<string>();
  let hasTasksWithoutArea = false;
  
  tasks.forEach(task => {
    const area = getCustomFieldValue(task, 'Area');
    if (area && area !== '-') {
      areasSet.add(area);
    } else {
      hasTasksWithoutArea = true;
    }
  });
  
  // Construir lista de áreas ordenadas
  const areas = Array.from(areasSet).sort();
  
  // Agregar área vacía si hay tareas sin área definida
  if (hasTasksWithoutArea || areas.length === 0) {
    areas.push(''); // modificar el nombre del área vacía a "Sin Área" o similar si se desea mostrar un título en la tabla
  }

  // Agrupar tareas por semana
  const startOfMonth = moment(date).startOf('month');
  const endOfMonth = moment(date).endOf('month');
  const currentMonth = moment(date).month();
  
  const weeks: WeekData[] = [];
  // Configurar que la semana empiece en lunes (día 1)
  let currentWeekStart = moment(startOfMonth).startOf('isoWeek');

  while (currentWeekStart.isSameOrBefore(endOfMonth)) {
    const currentWeekEnd = moment(currentWeekStart).endOf('isoWeek');
    
    // Verificar si esta semana tiene al menos un día del mes actual
    let hasCurrentMonthDay = false;
    for (let i = 0; i < 7; i++) {
      const checkDay = moment(currentWeekStart).add(i, 'days');
      if (checkDay.month() === currentMonth) {
        hasCurrentMonthDay = true;
        break;
      }
    }
    
    // Solo incluir semanas que tengan al menos un día del mes actual
    if (!hasCurrentMonthDay) {
      currentWeekStart.add(1, 'week');
      continue;
    }
    
    // Título de la semana
    const weekTitle = `Semana ${weeks.length + 1} (${currentWeekStart.locale('es').format('D')} - ${currentWeekEnd.locale('es').format('D MMM')})`;
    
    // Inicializar estructura de datos para cada área
    const weekAreas: AreaData[] = areas.map(area => ({
      name: area,
      days: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      }
    }));

    // Filtrar tareas de esta semana que estén dentro del mes actual
    const weekTasks = tasks.filter(task => {
      const taskDate = task.start_on 
        ? moment(task.start_on) 
        : task.due_on ? moment(task.due_on) : null;
      
      if (!taskDate) return false;
      
      // Solo incluir tareas del mes actual
      return taskDate.month() === currentMonth && 
             taskDate.isBetween(currentWeekStart, currentWeekEnd, null, '[]');
    });

    // Agrupar tareas por área y día
    weekTasks.forEach(task => {
      const taskArea = getCustomFieldValue(task, 'Area');
      const area = taskArea && taskArea !== '-' ? taskArea : '';
      
      const taskDate = task.start_on 
        ? moment(task.start_on) 
        : task.due_on ? moment(task.due_on) : null;
      
      if (!taskDate) return;
      
      const dayOfWeek = taskDate.day(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
      
      // Mapear día de la semana a propiedad
      const dayMap: { [key: number]: keyof AreaData['days'] } = {
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
        0: 'sunday'
      };
      
      const dayProp = dayMap[dayOfWeek];
      
      // Encontrar el área correspondiente
      const areaData = weekAreas.find(a => a.name === area);
      if (areaData && dayProp) {
        const responsables = getCustomFieldValue(task, 'Responsables de actividad');
        const activityText = responsables && responsables !== '-'
          ? `${task.name} (${responsables})`
          : task.name;
        areaData.days[dayProp].push(activityText);
      }
    });

    weeks.push({
      title: weekTitle,
      areas: weekAreas
    });

    currentWeekStart.add(1, 'week');
  }

  const scheduleData: MonthlyScheduleData = {
    month: format(date, 'MMMM', { locale: es }).charAt(0).toUpperCase() + format(date, 'MMMM', { locale: es }).slice(1),
    year: date.getFullYear(),
    weeks
  };

  // ============ GENERAR PDF ============
  
  const margins = {
    top: 5,
    bottom: 5,
    left: 5,
    right: 5
  };

  const colors = {
    beige: [245, 245, 220],
    black: [0, 0, 0],
    white: [255, 255, 255],
    lightGray: [240, 240, 240],
    borderGray: [200, 200, 200]
  };

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'  // Formato carta (Letter)
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // ============ ENCABEZADO DEL DOCUMENTO ============
  
  // Título único: "Cronograma de {mes} {año}"
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  pdf.text(`Cronograma de ${scheduleData.month} ${scheduleData.year}`, pageWidth / 2, margins.top + 8, { align: 'center' });

  let currentY = margins.top + 18;

  // ============ GENERAR UNA SOLA TABLA CONTINUA PARA TODO EL MES ============
  
  // Preparar cabecera única con días de la semana (solo una vez)
  // Usar isoWeek para que empiece en lunes
  // Headers fijos empezando por lunes, sin abreviar
  const headerDayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  
  const tableHeaders = [
    ['Área', headerDayNames[0], headerDayNames[1], headerDayNames[2], headerDayNames[3], headerDayNames[4], headerDayNames[5], headerDayNames[6]]
  ];

  // Construir cuerpo de la tabla con todas las semanas
  const tableBody: any[] = [];

  scheduleData.weeks.forEach((week, weekIndex) => {
    // Calcular los números de día para esta semana
    // Usar isoWeek para que empiece en lunes
    const weekStart = moment(startOfMonth).startOf('isoWeek').add(weekIndex, 'weeks');
    const currentMonth = moment(date).month();
    const dayNumbers = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = moment(weekStart).add(i, 'days');
      // Solo mostrar número si el día pertenece al mes actual
      if (dayDate.month() === currentMonth) {
        dayNumbers.push(dayDate.date().toString());
      } else {
        dayNumbers.push(''); // Dejar vacío para días fuera del mes
      }
    }

    // Agregar fila con números de día
    tableBody.push([
      { content: '', styles: { fillColor: colors.beige, fontStyle: 'bold', halign: 'center' } },
      { content: dayNumbers[0], styles: { fillColor: colors.beige, halign: 'center', fontStyle: 'bold' } },
      { content: dayNumbers[1], styles: { fillColor: colors.beige, halign: 'center', fontStyle: 'bold' } },
      { content: dayNumbers[2], styles: { fillColor: colors.beige, halign: 'center', fontStyle: 'bold' } },
      { content: dayNumbers[3], styles: { fillColor: colors.beige, halign: 'center', fontStyle: 'bold' } },
      { content: dayNumbers[4], styles: { fillColor: colors.beige, halign: 'center', fontStyle: 'bold' } },
      { content: dayNumbers[5], styles: { fillColor: colors.beige, halign: 'center', fontStyle: 'bold' } },
      { content: dayNumbers[6], styles: { fillColor: colors.beige, halign: 'center', fontStyle: 'bold' } }
    ]);

    // Agregar filas de áreas con actividades
    week.areas.forEach(area => {
      // Recopilar todas las actividades del área organizadas por día
      const dayActivities = [
        area.days.monday,
        area.days.tuesday,
        area.days.wednesday,
        area.days.thursday,
        area.days.friday,
        area.days.saturday,
        area.days.sunday
      ];

      // Verificar si el área tiene al menos una actividad en algún día
      const totalActivities = dayActivities.reduce((sum, acts) => sum + acts.length, 0);
      
      // Si el área no tiene ninguna actividad, no mostrar la fila
      if (totalActivities === 0) {
        return;
      }

      // Encontrar el número máximo de actividades en un solo día
      const maxActivitiesPerDay = Math.max(...dayActivities.map(acts => acts.length), 1);

      // Crear una fila por cada "nivel" de actividad
      for (let i = 0; i < maxActivitiesPerDay; i++) {
        const row: any[] = [];

        // Primera celda: Área (solo en la primera fila con rowSpan)
        if (i === 0) {
          row.push({
            content: area.name,
            rowSpan: maxActivitiesPerDay,
            styles: {
              fontStyle: 'bold',
              fillColor: colors.lightGray,
              valign: 'middle',
              halign: 'left'
            }
          });
        }

        // Celdas de los días: mostrar la actividad del índice i si existe
        dayActivities.forEach(activities => {
          const activity = activities[i] || '';
          row.push(activity);
        });

        tableBody.push(row);
      }
    });
  });

  // Calcular ancho disponible: pageWidth - márgenes izq y der
  const availableWidth = pageWidth - margins.left - margins.right;
  const areaColumnWidth = 35; // Ancho fijo para columna de área
  const dayColumnWidth = (availableWidth - areaColumnWidth) / 7; // Distribuir resto entre 7 días

  // Generar UNA SOLA tabla continua con todo el mes
  autoTable(pdf, {
    head: tableHeaders,
    body: tableBody,
    startY: currentY,
    margin: { left: margins.left, right: margins.right },
    theme: 'grid',
    showHead: 'everyPage', // Mostrar cabecera en cada página
    tableWidth: availableWidth, // Forzar ancho completo
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      valign: 'middle',
      textColor: colors.black,
      lineColor: colors.borderGray,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: colors.beige,
      textColor: colors.black,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
      cellPadding: 3,
    },
    bodyStyles: {
      fillColor: colors.white,
    },
    columnStyles: {
      0: { 
        cellWidth: areaColumnWidth, 
        halign: 'left',
        fontStyle: 'bold',
        fillColor: colors.lightGray
      },
      1: { cellWidth: dayColumnWidth, halign: 'left' },
      2: { cellWidth: dayColumnWidth, halign: 'left' },
      3: { cellWidth: dayColumnWidth, halign: 'left' },
      4: { cellWidth: dayColumnWidth, halign: 'left' },
      5: { cellWidth: dayColumnWidth, halign: 'left' },
      6: { cellWidth: dayColumnWidth, halign: 'left' },
      7: { cellWidth: dayColumnWidth, halign: 'left' },
    },
  });

  // Abrir PDF en nueva pestaña
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};
