import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AsanaTask } from '../../types/asana.types';
import logoInicial from '../../assets/logoinicial.png';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ============ CONSTANTES DE ESTILO EJECUTIVO - ESTÁNDAR CDIMA ============

// Márgenes uniformes (formato carta)
const PDF_MARGINS = {
  top: 20,
  bottom: 20,
  left: 20,
  right: 20
};

// Dimensiones del logo
const PDF_LOGO = {
  width: 28,     // mm - mantener proporciones automáticas con height = 0
  height: 0      // 0 = mantener aspect ratio original
};

// ============ FIN DE CONSTANTES ============

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
  
  // Para number
  if (field.type === 'number' && field.number_value !== null && field.number_value !== undefined) {
    return field.number_value.toString();
  }
  
  // Para text
  if (field.type === 'text' && field.text_value) {
    return field.text_value;
  }
  
  return '-';
};

export const exportTaskReportToPDF = (
  _mainTask: AsanaTask,
  subtasks: AsanaTask[],
  projectName: string
) => {
  // ============ CONFIGURACIÓN PDF - CARTA HORIZONTAL ============
  const margins = PDF_MARGINS;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ============ ENCABEZADO - ESTILO PLANNING ============
  try {
    doc.addImage(logoInicial, 'PNG', margins.left, margins.top, PDF_LOGO.width, PDF_LOGO.height);
  } catch (error) {
    console.error('Error al cargar logo:', error);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CDIMA', margins.left, margins.top + 8);
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('REPORTE EJECUTIVO DE AVANCE', pageWidth - margins.right, margins.top + 5, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const fechaActual1 = new Date();
  const monthName = format(fechaActual1, 'MMMM', { locale: es });
  const yearNumber = format(fechaActual1, 'yyyy', { locale: es });
  const dayNumber = format(fechaActual1, 'd', { locale: es });
  const metaX = pageWidth - margins.right;
  let metaY = margins.top + 12;

  doc.text(`PROYECTO: ${projectName}`, metaX, metaY, { align: 'right' });
  metaY += 5;
  doc.text(`PERÍODO: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${yearNumber}`, metaX, metaY, { align: 'right' });
  metaY += 5;
  doc.text(`FECHA DE GENERACIÓN: ${dayNumber} de ${monthName} de ${yearNumber}`, metaX, metaY, { align: 'right' });

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

  let startY = metaY + 16;
  // ============ FIN ENCABEZADO ============

  // Filtrar subtareas por estado y vencimiento
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueTasks = subtasks.filter(task => {
    const estado = getCustomFieldValue(task, 'Estado');
    if (estado === 'EJECUTADO') return false;
    if (task.due_on) {
      const [year, month, day] = task.due_on.split('-').map(Number);
      const dueDate = new Date(year, month - 1, day);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }
    return false;
  });

  const inProcessTasks = subtasks.filter(task => {
    const estado = getCustomFieldValue(task, 'Estado');
    return estado === 'EN PROCESO';
  });

  const completedTasks = subtasks.filter(task => {
    const estado = getCustomFieldValue(task, 'Estado');
    return estado === 'EJECUTADO';
  });

  const tableHeaders = [['ACTIVIDAD', 'RESPONSABLE', 'FECHA', 'ESTADO']];
  const formatDate = (dateStr: string | null | undefined): string | null => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  };
  const generateRow = (task: AsanaTask): string[] => {
    const startDate = formatDate(task.start_on);
    const endDate = formatDate(task.due_on);
    let fecha = '-';
    if (startDate && endDate) fecha = `${startDate} - ${endDate}`;
    else if (startDate) fecha = startDate;
    else if (endDate) fecha = endDate;
    return [
      task.name,
      getCustomFieldValue(task, 'Responsable de Actividad'),
      fecha,
      getCustomFieldValue(task, 'Estado') || '-',
    ];
  };

  // Ancho disponible: 279.4 - 20 - 20 = 239.4mm
  const tableStyles = {
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      overflow: 'linebreak' as const,
      valign: 'middle' as const,
      textColor: [0, 0, 0] as [number, number, number],
      lineColor: [180, 180, 180] as [number, number, number],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [220, 220, 220] as [number, number, number],
      textColor: [0, 0, 0] as [number, number, number],
      fontStyle: 'bold' as const,
      halign: 'left' as const,
      fontSize: 9,
      cellPadding: 5,
    },
    bodyStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: 100, halign: 'left' as const },
      1: { cellWidth: 55, halign: 'left' as const },
      2: { cellWidth: 50, halign: 'left' as const },
      3: { cellWidth: 34, halign: 'center' as const, fontStyle: 'bold' as const },
    },
  };

  // ============ SECCIÓN 1: ACTIVIDADES EJECUTADAS (CON RETRASO) ============
  if (overdueTasks.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`ACTIVIDADES EJECUTADAS (CON RETRASO) (${overdueTasks.length})`, margins.left, startY);

    autoTable(doc, {
      head: tableHeaders,
      body: overdueTasks.map(generateRow),
      startY: startY + 8,
      margin: { left: margins.left, right: margins.right },
      theme: 'plain',
      ...tableStyles,
    });

    startY = (doc as any).lastAutoTable.finalY + 12;
  }

  // ============ SECCIÓN 2: ACTIVIDADES EN PROCESO ============
  if (inProcessTasks.length > 0) {
    if (startY > pageHeight - 80) {
      doc.addPage();
      startY = margins.top + 10;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`ACTIVIDADES EN PROCESO (${inProcessTasks.length})`, margins.left, startY);

    autoTable(doc, {
      head: tableHeaders,
      body: inProcessTasks.map(generateRow),
      startY: startY + 8,
      margin: { left: margins.left, right: margins.right },
      theme: 'plain',
      ...tableStyles,
    });

    startY = (doc as any).lastAutoTable.finalY + 12;
  }

  // ============ SECCIÓN 3: ACTIVIDADES EJECUTADAS ============
  if (completedTasks.length > 0) {
    if (startY > pageHeight - 80) {
      doc.addPage();
      startY = margins.top + 10;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`ACTIVIDADES EJECUTADAS (${completedTasks.length})`, margins.left, startY);

    autoTable(doc, {
      head: tableHeaders,
      body: completedTasks.map(generateRow),
      startY: startY + 8,
      margin: { left: margins.left, right: margins.right },
      theme: 'plain',
      ...tableStyles,
    });
  }

  // ============ PIE DE PÁGINA ============
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('CDIMA - Reporte Ejecutivo de Avance', pageWidth - margins.right, pageHeight - margins.bottom + 10, { align: 'right' });

  // Abrir PDF en nueva pestaña
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
};

export const exportDistributionReportToPDF = (
  byAssignee: { [key: string]: { total: number; completed: number; pending: number } },
  title: string,
  columnName: string,
  projectName: string
) => {
  const margins = PDF_MARGINS;
  const pageWidth = 215.9;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });
  
  // Logo CDIMA (lado izquierdo)
  // @ts-ignore - base64 inline no utilizado; se usa logoInicial desde assets
  const _logoBase64 = "data:image/png;base64,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";
  
  try {
    doc.addImage(logoInicial, 'PNG', margins.left, margins.top, 28, 0);
  } catch (error) {
    console.error('Error al cargar logo:', error);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CDIMA', margins.left, margins.top + 8);
  }
  
// Título principal (lado derecho)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('REPORTE EJECUTIVO DE AVANCE', pageWidth - margins.right, margins.top + 5, { align: 'right' });

  // Metadatos (lado derecho, debajo del título)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const metadataX = pageWidth - margins.right;
  let metadataY = margins.top + 12;

  doc.text(`PROYECTO: ${projectName}`, metadataX, metadataY, { align: 'right' });
  metadataY += 5;
  doc.text(`REPORTE: ${title}`, metadataX, metadataY, { align: 'right' });
  metadataY += 5;
  const fechaDist = new Date();
  doc.text(`FECHA DE GENERACIÓN: ${format(fechaDist, 'd', { locale: es })} de ${format(fechaDist, 'MMMM', { locale: es })} de ${format(fechaDist, 'yyyy', { locale: es })}`, metadataX, metadataY, { align: 'right' });

  // Línea separadora fina
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margins.left, metadataY + 6, pageWidth - margins.right, metadataY + 6);

  let yPos = metadataY + 16;

  // Título de la sección
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(title.toUpperCase(), margins.left, yPos);

  yPos += 7;
  
  // Preparar datos para la tabla
  const tableData = Object.entries(byAssignee)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([name, stats]) => {
      const progress = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0.0';
      return [
        name,
        stats.total.toString(),
        stats.completed.toString(),
        stats.pending.toString(),
        `${progress}%`,
      ];
    });
  
  autoTable(doc, {
    startY: yPos,
    head: [[columnName, 'Total', 'Ejecutadas', 'En Proceso', 'Progreso']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [220, 220, 220] as [number, number, number],
      textColor: [0, 0, 0] as [number, number, number],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 9,
      cellPadding: 5,
    },
    bodyStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'middle',
      textColor: [0, 0, 0] as [number, number, number],
      lineColor: [180, 180, 180] as [number, number, number],
      lineWidth: 0.2,
    },
    margin: { left: margins.left, right: margins.right },
    tableWidth: 'auto',
  });

  // Pie de página
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`CDIMA - ${title}`, pageWidth - margins.right, pageH - margins.bottom + 10, { align: 'right' });

  // Abrir PDF en una nueva pestaña
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
};
