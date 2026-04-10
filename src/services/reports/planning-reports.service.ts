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

const decodeObservacion = (task: AsanaTask): string | null => {
  const obsField = task.custom_fields?.find(f => f.name === 'Observaciones');
  const encoded = obsField?.text_value;
  if (!encoded) return null;
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    return null;
  }
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
  overdueTasks: AsanaTask[];
  inProcessTasks: AsanaTask[];
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
    // Obtener tareas para este día (incluyendo actividades con rango de fechas)
    // event.end es exclusivo (+1 día), así que isBefore cubre hasta el due_on original
    const dayTasks = events.filter(event => {
      return current.isSameOrAfter(moment(event.start), 'day') && current.isBefore(moment(event.end), 'day');
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
  const { executedTasks, overdueTasks, inProcessTasks, date, projectName, areaFilter } = params;

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
    headerGray: [220, 220, 220]
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

  // ============ SECCIÓN 1: ACTIVIDADES EN PROCESO (ATRASADAS) ============
  if (overdueTasks.length > 0) {
    // Título de sección
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text('ACTIVIDADES EN PROCESO (ATRASADAS)', margins.left, startY);
    
    // Subtítulo con mes y año
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const mesAnio = format(date, 'MMMM yyyy', { locale: es });
    const mesAnioCapitalizado = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);
    pdf.text(mesAnioCapitalizado, margins.left, startY + 5);
    
    const pendingHeaders = [['ACTIVIDAD', 'RESPONSABLE(S)', 'FECHA', 'ESTADO']];
    
    const pendingBody = overdueTasks.map(task => {
      const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
      const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
      let fecha = '-';
      if (inicio && fin) fecha = `${inicio} - ${fin}`;
      else if (inicio) fecha = inicio;
      else if (fin) fecha = fin;
      const obs = decodeObservacion(task);
      return [
        task.name,
        getCustomFieldValue(task, 'Responsables de actividad'),
        fecha,
        {
          content: obs ? `EN PROCESO\n(${obs})` : 'EN PROCESO',
          styles: {
            textColor: colors.black,
            fontStyle: obs ? 'normal' : 'bold',
            fontSize: obs ? 7.5 : 8.5,
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
        2: { cellWidth: 30, halign: 'left' },
        3: { 
          cellWidth: 35, 
          halign: 'center',
          textColor: colors.black,
          fontStyle: 'bold'
        },
      },
    });

    startY = (pdf as any).lastAutoTable.finalY + 12;
  }

  // ============ SECCIÓN 2: ACTIVIDADES EN PROCESO ============
  if (inProcessTasks.length > 0) {
    if (startY > pageHeight - 80) {
      pdf.addPage();
      startY = margins.top + 10;
    }

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text('ACTIVIDADES EN PROCESO', margins.left, startY);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const mesAnioInProcess = format(date, 'MMMM yyyy', { locale: es });
    pdf.text(mesAnioInProcess.charAt(0).toUpperCase() + mesAnioInProcess.slice(1), margins.left, startY + 5);

    const inProcessHeaders = [['ACTIVIDAD', 'RESPONSABLE(S)', 'FECHA', 'ESTADO']];
    const inProcessBody = inProcessTasks.map(task => {
      const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
      const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
      let fecha = '-';
      if (inicio && fin) fecha = `${inicio} - ${fin}`;
      else if (inicio) fecha = inicio;
      else if (fin) fecha = fin;
      const obs = decodeObservacion(task);
      return [
        task.name,
        getCustomFieldValue(task, 'Responsables de actividad'),
        fecha,
        {
          content: obs ? `EN PROCESO\n(${obs})` : 'EN PROCESO',
          styles: {
            textColor: colors.black,
            fontStyle: obs ? 'normal' : 'bold',
            fontSize: obs ? 7.5 : 8.5,
          }
        }
      ];
    });

    autoTable(pdf, {
      head: inProcessHeaders,
      body: inProcessBody,
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
        2: { cellWidth: 30, halign: 'left' },
        3: {
          cellWidth: 35,
          halign: 'center',
          textColor: colors.black,
          fontStyle: 'bold'
        },
      },
    });

    startY = (pdf as any).lastAutoTable.finalY + 12;
  }

  // Separar ejecutadas de reprogramadas
  const realExecutedTasks = executedTasks.filter(task => getCustomFieldValue(task, 'Estado') !== 'Reprogramado');
  const reprogrammedTasks = executedTasks.filter(task => getCustomFieldValue(task, 'Estado') === 'Reprogramado');

  // ============ SECCIÓN 3: ACTIVIDADES EJECUTADAS ============
  if (realExecutedTasks.length > 0) {
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
    const mesAnioEjecutadas = format(date, 'MMMM yyyy', { locale: es });
    const mesAnioEjecutadasCapitalizado = mesAnioEjecutadas.charAt(0).toUpperCase() + mesAnioEjecutadas.slice(1);
    pdf.text(mesAnioEjecutadasCapitalizado, margins.left, startY + 5);
    
    const executedHeaders = [['ACTIVIDAD', 'RESPONSABLE(S)', 'FECHA', 'ESTADO']];
    const executedBody = realExecutedTasks.map(task => {
      const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
      const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
      let fecha = '-';
      if (inicio && fin) fecha = fin;
      else if (fin) fecha = fin;
      else if (inicio) fecha = inicio;
      const obs = decodeObservacion(task);
      return [
        task.name,
        getCustomFieldValue(task, 'Responsables de actividad'),
        fecha,
        {
          content: obs ? `EJECUTADO\n(${obs})` : 'EJECUTADO',
          styles: {
            textColor: colors.black,
            fontStyle: obs ? 'normal' : 'bold',
            fontSize: obs ? 7.5 : 8.5,
          }
        }
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
        2: { cellWidth: 30, halign: 'left' },
        3: { 
          cellWidth: 35, 
          halign: 'center',
          textColor: colors.black,
          fontStyle: 'bold'
        },
      },
    });

    startY = (pdf as any).lastAutoTable.finalY + 12;
  }

  // ============ SECCIÓN 4: ACTIVIDADES REPROGRAMADAS ============
  if (reprogrammedTasks.length > 0) {
    if (startY > pageHeight - 80) {
      pdf.addPage();
      startY = margins.top + 10;
    }

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text('ACTIVIDADES REPROGRAMADAS', margins.left, startY);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const mesAnioRepr = format(date, 'MMMM yyyy', { locale: es });
    pdf.text(mesAnioRepr.charAt(0).toUpperCase() + mesAnioRepr.slice(1), margins.left, startY + 5);

    const reprHeaders = [['ACTIVIDAD', 'RESPONSABLE(S)', 'FECHA', 'ESTADO']];
    const reprBody = reprogrammedTasks.map(task => {
      const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
      const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
      let fecha = '-';
      if (inicio && fin) fecha = fin;
      else if (fin) fecha = fin;
      else if (inicio) fecha = inicio;
      const obs = decodeObservacion(task);
      return [
        task.name,
        getCustomFieldValue(task, 'Responsables de actividad'),
        fecha,
        {
          content: obs ? `REPROGRAMADO\n(${obs})` : 'REPROGRAMADO',
          styles: {
            textColor: colors.black,
            fontStyle: obs ? 'normal' : 'bold',
            fontSize: obs ? 7.5 : 8.5,
          }
        }
      ];
    });

    autoTable(pdf, {
      head: reprHeaders,
      body: reprBody,
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
        2: { cellWidth: 30, halign: 'left' },
        3: {
          cellWidth: 35,
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
 * Exporta las tablas de tareas a Word (.doc) — mismo contenido que exportTasksTablesToPDF
 */
export const exportTasksTablesToWord = async (params: ExportTablesParams): Promise<void> => {
  const { executedTasks, overdueTasks, inProcessTasks, date, projectName, areaFilter } = params;

  moment.locale('es');

  const realExecutedTasks = executedTasks.filter(task => getCustomFieldValue(task, 'Estado') !== 'Reprogramado');
  const reprogrammedTasks = executedTasks.filter(task => getCustomFieldValue(task, 'Estado') === 'Reprogramado');

  const periodoHeader = format(date, 'MMMM yyyy', { locale: es });
  const periodoCapitalizado = periodoHeader.charAt(0).toUpperCase() + periodoHeader.slice(1);
  const nowStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });
  const fechaGeneracion = `${format(new Date(), 'dd', { locale: es })} de ${format(new Date(), 'MMMM', { locale: es })} de ${format(new Date(), 'yyyy', { locale: es })}`;

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const headerStyle = 'border:0.2pt solid #b4b4b4;padding:4pt 4pt;font-size:9pt;font-weight:bold;background-color:#dcdcdc;text-align:left;vertical-align:middle;';
  const cellStyle = 'border:0.2pt solid #b4b4b4;padding:4pt 4pt;font-size:8.5pt;text-align:left;vertical-align:top;background-color:#ffffff;';
  const cellCenterStyle = 'border:0.2pt solid #b4b4b4;padding:4pt 4pt;font-size:8.5pt;text-align:center;vertical-align:top;font-weight:bold;background-color:#ffffff;';

  const buildTable = (rows: { name: string; responsables: string; fecha: string; estado: string; observacion?: string | null }[]): string => `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:6pt;">
      <colgroup>
        <col style="width:38%;"/>
        <col style="width:25%;"/>
        <col style="width:17%;"/>
        <col style="width:20%;"/>
      </colgroup>
      <thead>
        <tr>
          <th style="${headerStyle}">ACTIVIDAD</th>
          <th style="${headerStyle}">RESPONSABLE(S)</th>
          <th style="${headerStyle}">FECHA</th>
          <th style="${headerStyle}text-align:center;">ESTADO</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
        <tr>
          <td style="${cellStyle}">${escapeHtml(r.name)}</td>
          <td style="${cellStyle}">${escapeHtml(r.responsables)}</td>
          <td style="${cellStyle}">${escapeHtml(r.fecha)}</td>
          <td style="${cellCenterStyle}">${escapeHtml(r.estado)}${r.observacion ? `<br/><span style="font-size:7pt;color:#6b7280;font-style:italic;font-weight:normal;line-height:1.4;">(${escapeHtml(r.observacion)})</span>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;

  const taskRow = (task: AsanaTask, estadoLabel: string) => {
    const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
    const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
    let fecha = '-';
    if (inicio && fin) fecha = `${inicio} - ${fin}`;
    else if (fin) fecha = fin;
    else if (inicio) fecha = inicio;
    return {
      name: task.name,
      responsables: getCustomFieldValue(task, 'Responsables de actividad') !== '-' ? getCustomFieldValue(task, 'Responsables de actividad') : '',
      fecha,
      estado: estadoLabel,
      observacion: decodeObservacion(task),
    };
  };

  const executedTaskRowFn = (task: AsanaTask, estadoLabel: string) => {
    const fin = task.due_on ? moment(task.due_on).format('DD/MM/YYYY') : null;
    const inicio = task.start_on ? moment(task.start_on).format('DD/MM/YYYY') : null;
    let fecha = '-';
    if (fin) fecha = fin;
    else if (inicio) fecha = inicio;
    return {
      name: task.name,
      responsables: getCustomFieldValue(task, 'Responsables de actividad') !== '-' ? getCustomFieldValue(task, 'Responsables de actividad') : '',
      fecha,
      estado: estadoLabel,
      observacion: decodeObservacion(task),
    };
  };

  const sectionTitle = (title: string, subtitle: string) => `
    <div style="margin-top:10pt;margin-bottom:2pt;">
      <span style="font-size:11pt;font-weight:bold;font-family:Arial,sans-serif;">${title}</span><br/>
      <span style="font-size:10pt;font-family:Arial,sans-serif;">${subtitle}</span>
    </div>
  `;

  let sections = '';

  if (overdueTasks.length > 0) {
    sections += sectionTitle('ACTIVIDADES EN PROCESO (ATRASADAS)', periodoCapitalizado);
    sections += buildTable(overdueTasks.map(t => taskRow(t, 'EN PROCESO')));
  }

  if (inProcessTasks.length > 0) {
    sections += sectionTitle('ACTIVIDADES EN PROCESO', periodoCapitalizado);
    sections += buildTable(inProcessTasks.map(t => taskRow(t, 'EN PROCESO')));
  }

  if (realExecutedTasks.length > 0) {
    sections += sectionTitle('ACTIVIDADES EJECUTADAS', periodoCapitalizado);
    sections += buildTable(realExecutedTasks.map(t => executedTaskRowFn(t, 'EJECUTADO')));
  }

  if (reprogrammedTasks.length > 0) {
    sections += sectionTitle('ACTIVIDADES REPROGRAMADAS', periodoCapitalizado);
    sections += buildTable(reprogrammedTasks.map(t => executedTaskRowFn(t, 'REPROGRAMADO')));
  }

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8"/>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Normal</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page WordSection1 {
          size: 21.59cm 27.94cm;
          margin: 2.0cm 2.0cm 2.0cm 2.0cm;
          mso-header-margin: 0.5cm;
          mso-footer-margin: 0.5cm;
        }
        div.WordSection1 { page: WordSection1; }
        body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; margin: 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 0.2pt solid #b4b4b4; padding: 4pt; font-size: 8.5pt; color: #000; word-wrap: break-word; }
      </style>
    </head>
    <body>
      <div class="WordSection1">
        <!-- Encabezado -->
        <div style="border-bottom:0.3pt solid #dcdcdc;padding-bottom:6pt;margin-bottom:8pt;">
          <div style="text-align:right;font-size:14pt;font-weight:bold;font-family:Arial,sans-serif;">
            ESTADO DE ACTIVIDADES MENSUALES &mdash; ${periodoHeader.toUpperCase()}
          </div>
          <div style="text-align:right;font-size:9pt;font-family:Arial,sans-serif;margin-top:3pt;">
            PROYECTO: ${escapeHtml(projectName)}<br/>
            PER&#205;ODO DE REPORTE: ${periodoCapitalizado}${areaFilter !== 'todas' ? `<br/>&#193;REA: ${escapeHtml(areaFilter)}` : ''}<br/>
            FECHA DE GENERACI&#211;N: ${fechaGeneracion}
          </div>
        </div>

        <!-- Secciones -->
        ${sections}

        <!-- Pie de página -->
        <div style="margin-top:8pt;font-size:8pt;color:#000;font-family:Arial,sans-serif;text-align:right;">
          CDIMA &mdash; Estado de Actividades ${periodoCapitalizado} &mdash; ${nowStr}
        </div>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `informe-actividades-${format(date, 'MMMM-yyyy', { locale: es }).toLowerCase()}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

    // Filtrar tareas que se solapan con esta semana y tienen al menos un día en el mes actual
    const weekTasks = tasks.filter(task => {
      const taskStart = task.start_on ? moment(task.start_on) : task.due_on ? moment(task.due_on) : null;
      const taskEnd = task.due_on ? moment(task.due_on) : task.start_on ? moment(task.start_on) : null;

      if (!taskStart || !taskEnd) return false;

      const overlapsWeek = taskStart.isSameOrBefore(currentWeekEnd) && taskEnd.isSameOrAfter(currentWeekStart);
      const monthStart = moment(date).startOf('month');
      const monthEnd = moment(date).endOf('month');
      const hasCurrentMonthDay = taskStart.isSameOrBefore(monthEnd) && taskEnd.isSameOrAfter(monthStart);

      return overlapsWeek && hasCurrentMonthDay;
    });

    // Agrupar tareas por área y día (las tareas multi-día se repiten en cada día del rango)
    weekTasks.forEach(task => {
      const taskArea = getCustomFieldValue(task, 'Area');
      const area = taskArea && taskArea !== '-' ? taskArea : '';

      const taskStart = task.start_on ? moment(task.start_on) : task.due_on ? moment(task.due_on) : null;
      const taskEnd = task.due_on ? moment(task.due_on) : task.start_on ? moment(task.start_on) : null;

      if (!taskStart || !taskEnd) return;

      const dayMap: { [key: number]: keyof AreaData['days'] } = {
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
        0: 'sunday'
      };

      const areaData = weekAreas.find(a => a.name === area);
      if (!areaData) return;

      const responsables = getCustomFieldValue(task, 'Responsables de actividad');
      const activityText = responsables && responsables !== '-'
        ? `${task.name} (${responsables})`
        : task.name;

      // Agregar a cada día de la semana que caiga dentro del rango de la tarea y pertenezca al mes actual
      for (let i = 0; i < 7; i++) {
        const dayDate = moment(currentWeekStart).add(i, 'days');
        if (dayDate.month() === currentMonth && dayDate.isBetween(taskStart, taskEnd, 'day', '[]')) {
          const dayProp = dayMap[dayDate.day()];
          if (dayProp) {
            areaData.days[dayProp].push(activityText);
          }
        }
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
    format: 'letter'
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
    [headerDayNames[0], headerDayNames[1], headerDayNames[2], headerDayNames[3], headerDayNames[4], headerDayNames[5], headerDayNames[6]]
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

        // Celdas de los días: mostrar la actividad del índice i si existe
        dayActivities.forEach(activities => {
          const activity = activities[i] || '';
          row.push(activity);
        });

        tableBody.push(row);
      }
    });
  });

  if (tableBody.length === 0) {
    tableBody.push([
      {
        content: 'No hay actividades programadas en este período',
        colSpan: 7,
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

  // Calcular ancho disponible: pageWidth - márgenes izq y der
  const availableWidth = pageWidth - margins.left - margins.right;
  const dayColumnWidth = availableWidth / 7; // 7 columnas iguales

  // Generar UNA SOLA tabla continua con todo el mes
  autoTable(pdf, {
    head: tableHeaders,
    body: tableBody,
    startY: currentY,
    margin: { left: margins.left, right: margins.right },
    theme: 'grid',
    showHead: 'firstPage',
    tableWidth: availableWidth,
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
      0: { cellWidth: dayColumnWidth, halign: 'left' },
      1: { cellWidth: dayColumnWidth, halign: 'left' },
      2: { cellWidth: dayColumnWidth, halign: 'left' },
      3: { cellWidth: dayColumnWidth, halign: 'left' },
      4: { cellWidth: dayColumnWidth, halign: 'left' },
      5: { cellWidth: dayColumnWidth, halign: 'left' },
      6: { cellWidth: dayColumnWidth, halign: 'left' },
    },
  });

  // Abrir PDF en nueva pestaña
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

/**
 * Exporta el cronograma mensual en formato Word (.doc)
 * Mismo contenido y estilos que exportMonthlyCalendarSchedule (PDF)
 */
export const exportMonthlyCalendarScheduleWord = async (params: ExportMonthlyScheduleParams): Promise<void> => {
  const { tasks, date } = params;

  moment.locale('es');

  // ============ PREPARAR DATOS (idéntico a exportMonthlyCalendarSchedule) ============

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

  const areas = Array.from(areasSet).sort();
  if (hasTasksWithoutArea || areas.length === 0) {
    areas.push('');
  }

  const startOfMonth = moment(date).startOf('month');
  const endOfMonth = moment(date).endOf('month');
  const currentMonth = moment(date).month();

  const weeks: WeekData[] = [];
  let currentWeekStart = moment(startOfMonth).startOf('isoWeek');

  while (currentWeekStart.isSameOrBefore(endOfMonth)) {
    const currentWeekEnd = moment(currentWeekStart).endOf('isoWeek');

    let hasCurrentMonthDay = false;
    for (let i = 0; i < 7; i++) {
      const checkDay = moment(currentWeekStart).add(i, 'days');
      if (checkDay.month() === currentMonth) {
        hasCurrentMonthDay = true;
        break;
      }
    }

    if (!hasCurrentMonthDay) {
      currentWeekStart.add(1, 'week');
      continue;
    }

    const weekTitle = `Semana ${weeks.length + 1} (${currentWeekStart.locale('es').format('D')} - ${currentWeekEnd.locale('es').format('D MMM')})`;

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

    const weekTasks = tasks.filter(task => {
      const taskStart = task.start_on ? moment(task.start_on) : task.due_on ? moment(task.due_on) : null;
      const taskEnd = task.due_on ? moment(task.due_on) : task.start_on ? moment(task.start_on) : null;
      if (!taskStart || !taskEnd) return false;
      const overlapsWeek = taskStart.isSameOrBefore(currentWeekEnd) && taskEnd.isSameOrAfter(currentWeekStart);
      const monthStart = moment(date).startOf('month');
      const monthEnd = moment(date).endOf('month');
      const hasCurrentMonthDayFlag = taskStart.isSameOrBefore(monthEnd) && taskEnd.isSameOrAfter(monthStart);
      return overlapsWeek && hasCurrentMonthDayFlag;
    });

    weekTasks.forEach(task => {
      const taskArea = getCustomFieldValue(task, 'Area');
      const area = taskArea && taskArea !== '-' ? taskArea : '';
      const taskStart = task.start_on ? moment(task.start_on) : task.due_on ? moment(task.due_on) : null;
      const taskEnd = task.due_on ? moment(task.due_on) : task.start_on ? moment(task.start_on) : null;
      if (!taskStart || !taskEnd) return;

      const dayMap: { [key: number]: keyof AreaData['days'] } = {
        1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
        5: 'friday', 6: 'saturday', 0: 'sunday'
      };

      const areaData = weekAreas.find(a => a.name === area);
      if (!areaData) return;

      const responsables = getCustomFieldValue(task, 'Responsables de actividad');
      const activityText = responsables && responsables !== '-'
        ? `${task.name} (${responsables})`
        : task.name;

      for (let i = 0; i < 7; i++) {
        const dayDate = moment(currentWeekStart).add(i, 'days');
        if (dayDate.month() === currentMonth && dayDate.isBetween(taskStart, taskEnd, 'day', '[]')) {
          const dayProp = dayMap[dayDate.day()];
          if (dayProp) areaData.days[dayProp].push(activityText);
        }
      }
    });

    weeks.push({ title: weekTitle, areas: weekAreas });
    currentWeekStart.add(1, 'week');
  }

  const scheduleData: MonthlyScheduleData = {
    month: format(date, 'MMMM', { locale: es }).charAt(0).toUpperCase() + format(date, 'MMMM', { locale: es }).slice(1),
    year: date.getFullYear(),
    weeks
  };

  // ============ GENERAR WORD ============

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const cellStyle = 'border:0.3pt solid #c8c8c8;padding:2pt 3pt;font-size:8pt;vertical-align:top;text-align:left;';
  const beigeCellStyle = `border:0.3pt solid #c8c8c8;padding:2pt 3pt;font-size:9pt;font-weight:bold;text-align:center;background-color:#f5f5dc;vertical-align:middle;`;
  const areaCellStyle = `border:0.3pt solid #c8c8c8;padding:2pt 3pt;font-size:8pt;font-weight:bold;background-color:#f0f0f0;vertical-align:middle;text-align:left;`;

  const tableRows: string[] = [];

  scheduleData.weeks.forEach((week, weekIndex) => {
    const weekMoment = moment(startOfMonth).startOf('isoWeek').add(weekIndex, 'weeks');
    const weekMonth = moment(date).month();
    const dayNumbers: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = moment(weekMoment).add(i, 'days');
      dayNumbers.push(dayDate.month() === weekMonth ? dayDate.date().toString() : '');
    }

    // Fila con números de día (beige)
    tableRows.push(`
      <tr>
        <td style="${beigeCellStyle}"></td>
        ${dayNumbers.map(d => `<td style="${beigeCellStyle}">${d}</td>`).join('')}
      </tr>
    `);

    // Filas de área con actividades (usando rowspan como el PDF)
    week.areas.forEach(area => {
      const dayActivities = [
        area.days.monday, area.days.tuesday, area.days.wednesday,
        area.days.thursday, area.days.friday, area.days.saturday, area.days.sunday
      ];
      const totalActivities = dayActivities.reduce((sum, acts) => sum + acts.length, 0);
      if (totalActivities === 0) return;

      const maxActivitiesPerDay = Math.max(...dayActivities.map(acts => acts.length), 1);

      for (let i = 0; i < maxActivitiesPerDay; i++) {
        const rowParts: string[] = [];
        if (i === 0) {
          rowParts.push(`<td rowspan="${maxActivitiesPerDay}" style="${areaCellStyle}">${escapeHtml(area.name)}</td>`);
        }
        dayActivities.forEach(activities => {
          rowParts.push(`<td style="${cellStyle}background-color:#ffffff;">${escapeHtml(activities[i] || '')}</td>`);
        });
        tableRows.push(`<tr>${rowParts.join('')}</tr>`);
      }
    });
  });

  if (tableRows.length === 0) {
    tableRows.push(`
      <tr>
        <td colspan="8" style="${cellStyle}padding:10pt;font-style:italic;text-align:center;">
          No hay actividades programadas en este per&#237;odo
        </td>
      </tr>
    `);
  }

  const nowStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8"/>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Normal</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page WordSection1 {
          size: 27.94cm 21.59cm;
          mso-page-orientation: landscape;
          margin: 1.0cm 1.0cm 1.0cm 1.0cm;
          mso-header-margin: 0.5cm;
          mso-footer-margin: 0.5cm;
        }
        div.WordSection1 { page: WordSection1; }
        body { font-family: Arial, sans-serif; font-size: 8pt; color: #000; margin: 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { border: 0.3pt solid #c8c8c8; padding: 3pt 2pt; font-size: 9pt; font-weight: bold; text-align: center; background-color: #f5f5dc; color: #000; word-wrap: break-word; }
        td { border: 0.3pt solid #c8c8c8; padding: 2pt 3pt; font-size: 8pt; color: #000; word-wrap: break-word; }
      </style>
    </head>
    <body>
      <div class="WordSection1">
        <div style="text-align:center;font-size:16pt;font-weight:bold;margin-bottom:6pt;font-family:Arial,sans-serif;">
          Cronograma de ${scheduleData.month} ${scheduleData.year}
        </div>
        <table>
          <colgroup>
            <col style="width:35mm;"/>
            <col style="width:auto;"/>
            <col style="width:auto;"/>
            <col style="width:auto;"/>
            <col style="width:auto;"/>
            <col style="width:auto;"/>
            <col style="width:auto;"/>
            <col style="width:auto;"/>
          </colgroup>
          <tbody>
            <tr>
              <th>&#193;rea</th>
              <th>Lunes</th>
              <th>Martes</th>
              <th>Mi&#233;rcoles</th>
              <th>Jueves</th>
              <th>Viernes</th>
              <th>S&#225;bado</th>
              <th>Domingo</th>
            </tr>
            ${tableRows.join('')}
          </tbody>
        </table>
        <div style="margin-top:6pt;font-size:9pt;color:#555;font-family:Arial,sans-serif;">
          Generaci&#243;n de reporte: ${nowStr} &#8212; CDIMA - Cronograma Mensual
        </div>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cronograma-${scheduleData.month.toLowerCase()}-${scheduleData.year}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
