import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AsanaTask, TaskStatistics } from '../../types/asana.types';
import logoInicial from '../../assets/logoinicial.png';

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
  const { events, currentMonthTasks, statistics, date, projectName } = params;

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

  // Abrir PDF en nueva pestaña
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};
