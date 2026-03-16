import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoInicial from '../../assets/logoinicial.png';
import logoCdima from '../../assets/logocdima.png';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ASANA_CUSTOM_FIELDS } from '../../constants/asana-fields';
import { 
  getCustomFieldValueSafe, 
  parseEstudianteData, 
  parseAsistenciaRecords
} from '../../utils/asana-helpers';
import { AsanaSection, AsanaTask } from '../../types/asana.types';

// ========================================
// INTERFACES
// ========================================

interface InfoPrimaria {
  nombre: string;
  genero: string;
  telefono: string;
  lugarNacimiento: string;
  fechaNacimiento: string;
  domicilio: string;
  especialidad: string;
  documentoIdentidad: string;
  identidadCultural: string;
  tipo: 'Docente' | 'Estudiante';
}

interface ExportDiplomadoGeneralParams {
  diplomado: AsanaSection;
  docentes: AsanaTask[];
  estudiantes: AsanaTask[];
}

interface ExportDiplomadoCentralizadorNotasParams {
  diplomado: AsanaSection;
  estudiantes: AsanaTask[];
}

interface ExportDiplomadoEstudianteParams {
  estudiante: AsanaTask;
  diplomado?: AsanaSection;
}

// ========================================
// FUNCIONES HELPER
// ========================================

/**
 * Formatea un nombre completo desde el formato "Nombre, Apellido Paterno, Apellido Materno"
 * al formato "Apellido Paterno Apellido Materno Nombre" (sin comas)
 */
const formatearNombreCompleto = (nombreCompleto: string): string => {
  // Parsear nombre en formato "Nombre, Apellido Paterno, Apellido Materno"
  const partes = nombreCompleto.split(',').map(p => p.trim());
  const nombre = partes[0] || '';
  const apellidoPaterno = partes[1] || '';
  const apellidoMaterno = partes[2] || '';
  
  // Retornar en formato: Apellido Paterno Apellido Materno Nombre (SIN COMAS)
  return `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim();
};

/**
 * Parsea la información primaria de una tarea (estudiante o docente)
 */
const parseInfoPrimariaLegacy = (task: AsanaTask, tipo: 'Docente' | 'Estudiante'): InfoPrimaria => {
  // Usa la nueva función helper robusta
  const data = parseEstudianteData(task.notes);
  
  return {
    nombre: formatearNombreCompleto(task.name),
    genero: data.genero,
    telefono: data.telefono || '',
    lugarNacimiento: data.lugarNacimiento || '',
    fechaNacimiento: data.fechaNacimiento || '',
    domicilio: data.domicilio || '',
    especialidad: data.especialidad || '',
    documentoIdentidad: data.documentoIdentidad || '',
    identidadCultural: data.identidadCultural || '',
    tipo
  };
};

// ========================================
// FUNCIONES DE EXPORTACIÓN
// ========================================

/**
 * Genera un reporte PDF general del diplomado con docentes y estudiantes
 */
export const exportDiplomadoGeneralPDF = ({ diplomado, docentes, estudiantes }: ExportDiplomadoGeneralParams): void => {
  const colors = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    lightGray: [245, 245, 245],
    headerGray: [220, 220, 220]
  };

  const margins = {
    top: 20,
    bottom: 20,
    left: 12,
    right: 12
  };

  const pdf = new jsPDF({
    orientation: 'landscape',
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

  // Título Principal (lado derecho)
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  pdf.text('LISTADO DE PARTICIPANTES', pageWidth - margins.right, margins.top + 5, { align: 'right' });
  
  // Metadatos
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  
  let metaY = margins.top + 12;
  pdf.text(`DIPLOMADO: ${diplomado.name}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  metaY += 5;
  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.text(`FECHA DE GENERACION: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });

  metaY += 5;
  pdf.text(`REGISTROS: DOCENTES ${docentes.length} | ESTUDIANTES ${estudiantes.length}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  // Línea separadora
  pdf.setDrawColor(colors.headerGray[0], colors.headerGray[1], colors.headerGray[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

  let startY = metaY + 22;

  // ============ TABLA DE DOCENTES ============
  if (startY > pageHeight - 40) {
    pdf.addPage();
    startY = margins.top;
  }

  autoTable(pdf, {
    body: [[`DOCENTES`]],
    startY,
    margin: { left: margins.left, right: margins.right },
    tableWidth: pageWidth - margins.left - margins.right,
    theme: 'plain',
    styles: {
      fillColor: colors.headerGray,
      textColor: colors.black,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
      cellWidth: 'wrap'
    }
  });

  startY = (pdf as any).lastAutoTable.finalY;

  if (docentes.length > 0) {

    const docentesData = docentes.map((docente, index) => {
      const info = parseInfoPrimariaLegacy(docente, 'Docente');
      
      // Parsear nombre en formato "Nombre, Apellido Paterno, Apellido Materno"
      const partes = docente.name.split(',').map(p => p.trim());
      const nombre = partes[0] || '';
      const apellidoPaterno = partes[1] || '';
      const apellidoMaterno = partes[2] || '';
      
      const nombreCompleto = [nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ').trim() || 'N/A';
      const lugarNacimiento = info.lugarNacimiento || 'N/A';
      const fechaNacimiento = info.fechaNacimiento || 'N/A';
      const nacimiento = `${lugarNacimiento} / ${fechaNacimiento}`;

      return [
        (index + 1).toString(),
        nombreCompleto,
        info.documentoIdentidad || 'N/A',
        info.genero || 'N/A',
        info.especialidad || 'N/A',
        nacimiento,
        info.identidadCultural || 'N/A',
        info.telefono || 'N/A',
        info.domicilio || 'N/A'
      ];
    });

    autoTable(pdf, {
      head: [['', 'Nombre', 'Doc. Identidad', 'Genero', 'Especialidad', 'Lugar y Fecha de Nacimiento', 'Identidad Cultural', 'Telefono', 'Domicilio']],
      body: docentesData,
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      tableWidth: pageWidth - margins.left - margins.right,
      theme: 'plain',
      headStyles: {
        fillColor: colors.headerGray,
        textColor: colors.black,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 3
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        overflow: 'linebreak',
        valign: 'middle',
        textColor: colors.black,
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
        cellWidth: 'wrap'
      },
      bodyStyles: {
        fillColor: colors.white
      },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 28 },
        5: { cellWidth: 44 },
        6: { cellWidth: 30 },
        7: { cellWidth: 24, halign: 'center' },
        8: { cellWidth: 40 }
      }
    } as any);
  } else {
    autoTable(pdf, {
      body: [['No hay actividades programadas en este periodo']],
      startY,
      margin: { left: margins.left, right: margins.right },
      theme: 'plain',
      styles: {
        fillColor: colors.white,
        textColor: colors.black,
        fontStyle: 'italic',
        fontSize: 9,
        cellPadding: 5,
        halign: 'center',
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
        overflow: 'linebreak',
        valign: 'middle',
        cellWidth: 'wrap'
      }
    });
  }

  startY = (pdf as any).lastAutoTable.finalY + 8;

  // ============ TABLA DE ESTUDIANTES ============
  if (startY > pageHeight - 45) {
    pdf.addPage();
    startY = margins.top;
  }

  autoTable(pdf, {
    body: [[`ESTUDIANTES`]],
    startY,
    margin: { left: margins.left, right: margins.right },
    tableWidth: pageWidth - margins.left - margins.right,
    theme: 'plain',
    styles: {
      fillColor: colors.headerGray,
      textColor: colors.black,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
      cellWidth: 'wrap'
    }
  });

  startY = (pdf as any).lastAutoTable.finalY;

  if (estudiantes.length > 0) {

    const estudiantesData = estudiantes.map((estudiante, index) => {
      const info = parseInfoPrimariaLegacy(estudiante, 'Estudiante');
      
      // Parsear nombre en formato "Nombre, Apellido Paterno, Apellido Materno"
      const partes = estudiante.name.split(',').map(p => p.trim());
      const nombre = partes[0] || '';
      const apellidoPaterno = partes[1] || '';
      const apellidoMaterno = partes[2] || '';
      
      const nombreCompleto = [nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ').trim() || 'N/A';
      const lugarNacimiento = info.lugarNacimiento || 'N/A';
      const fechaNacimiento = info.fechaNacimiento || 'N/A';
      const nacimiento = `${lugarNacimiento} / ${fechaNacimiento}`;

      return [
        (index + 1).toString(),
        nombreCompleto,
        info.documentoIdentidad || 'N/A',
        info.genero || 'N/A',
        info.especialidad || 'N/A',
        nacimiento,
        info.identidadCultural || 'N/A',
        info.telefono || 'N/A',
        info.domicilio || 'N/A'
      ];
    });

    autoTable(pdf, {
      head: [['', 'Nombre', 'Doc. Identidad', 'Genero', 'Especialidad', 'Lugar y Fecha de Nacimiento', 'Identidad Cultural', 'Telefono', 'Domicilio']],
      body: estudiantesData,
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      tableWidth: pageWidth - margins.left - margins.right,
      theme: 'plain',
      headStyles: {
        fillColor: colors.headerGray,
        textColor: colors.black,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 3
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        overflow: 'linebreak',
        valign: 'middle',
        textColor: colors.black,
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
        cellWidth: 'wrap'
      },
      bodyStyles: {
        fillColor: colors.white
      },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 28 },
        5: { cellWidth: 44 },
        6: { cellWidth: 30 },
        7: { cellWidth: 24, halign: 'center' },
        8: { cellWidth: 40 }
      }
    });
  } else {
    autoTable(pdf, {
      body: [['No hay actividades programadas en este periodo']],
      startY,
      margin: { left: margins.left, right: margins.right },
      theme: 'plain',
      styles: {
        fillColor: colors.white,
        textColor: colors.black,
        fontStyle: 'italic',
        fontSize: 9,
        cellPadding: 5,
        halign: 'center',
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
        overflow: 'linebreak',
        valign: 'middle',
        cellWidth: 'wrap'
      }
    });
  }

  // ============ PIE DE PÁGINA ============
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  const footerText = `Total Docentes: ${docentes.length} | Total Estudiantes: ${estudiantes.length}`;
  pdf.text(footerText, pageWidth - margins.right, pageHeight - margins.bottom + 10, { align: 'right' });

  // Abrir en nueva pestaña en lugar de descargar
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

/**
 * Genera un reporte PDF de centralizador de notas del diplomado
 */
export const exportDiplomadoCentralizadorNotasPDF = ({ diplomado, estudiantes }: ExportDiplomadoCentralizadorNotasParams): void => {
  const colors = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    lightGray: [245, 245, 245],
    headerGray: [220, 220, 220]
  };

  const margins = {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20
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
  
  // Título Principal (lado derecho)
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  pdf.text('Nómina Oficial de Aprobados/os', pageWidth - margins.right, margins.top + 5, { align: 'right' });
  
  // Metadatos
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  
  let metaY = margins.top + 12;
  pdf.text(`DIPLOMADO: ${diplomado.name}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  metaY += 5;
  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.text(`FECHA DE GENERACION: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });

  metaY += 5;
  pdf.text(`REGISTROS: ${estudiantes.length}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  // Línea separadora
  pdf.setDrawColor(colors.headerGray[0], colors.headerGray[1], colors.headerGray[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

  let startY = metaY + 22;

  // ============ TABLA DE NOTAS ============
  // Calcular datos de estudiantes con parseo de nombres
  const notasEstudiantes = estudiantes.map(estudiante => {
    // Parsear nombre en formato "Nombre, Apellido Paterno, Apellido Materno"
    const partes = estudiante.name.split(',').map(p => p.trim());
    const nombre = partes[0] || '';
    const apellidoPaterno = partes[1] || '';
    const apellidoMaterno = partes[2] || '';
    
    // Formato: Apellido Paterno Apellido Materno Nombre (SIN COMAS)
    const nombreFormateado = `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim();
    
    // Obtener CI de las notas
    const data = parseEstudianteData(estudiante.notes);
    const ci = data.documentoIdentidad || 'N/A';
    
    const modulo1 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
    const modulo2 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_2, 0);
    const modulo3 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_3, 0);
    const modulo4 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_4, 0);
    const modulo5 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_5, 0);
    const total = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;
    
    return {
      nombreFormateado,
      ci,
      modulo1,
      modulo2,
      modulo3,
      modulo4,
      modulo5,
      total: Math.round(total)
    };
  });

  const calcularPromedioModulo = (moduloKey: string): number => {
    if (notasEstudiantes.length === 0) return 0;
    const suma = notasEstudiantes.reduce((acc: number, est: any) => acc + est[moduloKey], 0);
    return Math.round(suma / notasEstudiantes.length);
  };
  
  // Contar aprobados (>= 51)
  const contarAprobados = (): number => {
    return notasEstudiantes.filter(est => est.total >= 51).length;
  };

  // Preparar datos para la tabla con numeración
  const tableBody = notasEstudiantes.map((est, index) => [
    (index + 1).toString(), // No.
    est.ci, // C.I
    est.nombreFormateado, // Nombres en formato Apellido Paterno, Apellido Materno, Nombre
    est.modulo1.toString(),
    est.modulo2.toString(),
    est.modulo3.toString(),
    est.modulo4.toString(),
    est.modulo5.toString(),
    est.total.toString()
  ]);

  // Agregar fila de promedios
  if (notasEstudiantes.length > 0) {
    tableBody.push([
      '',
      '',
      'PROMEDIO GENERAL',
      calcularPromedioModulo('modulo1').toString(),
      calcularPromedioModulo('modulo2').toString(),
      calcularPromedioModulo('modulo3').toString(),
      calcularPromedioModulo('modulo4').toString(),
      calcularPromedioModulo('modulo5').toString(),
      calcularPromedioModulo('total').toString()
    ]);

    autoTable(pdf, {
      head: [['No.', 'C.I', 'Nombres', 'Módulo 1', 'Módulo 2', 'Módulo 3', 'Módulo 4', 'Módulo 5', 'Prom.']],
      body: tableBody,
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      tableWidth: pageWidth - margins.left - margins.right,
      theme: 'plain',
      headStyles: {
        fillColor: colors.headerGray,
        textColor: colors.black,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 0.8,
        overflow: 'linebreak',
        valign: 'middle'
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 0.8,
        overflow: 'linebreak',
        valign: 'middle',
        textColor: colors.black,
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
        cellWidth: 'wrap'
      },
      bodyStyles: {
        fillColor: colors.white
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 66, halign: 'left' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 14, halign: 'center' },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 14, halign: 'center' }
      },
      didParseCell: (data: any) => {
        if (data.section === 'head' && data.row.index === 0 && data.column.index >= 3 && data.column.index <= 7) {
          data.cell.styles.minCellHeight = 20;
          data.cell.text = [''];
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'head' && data.row.index === 0 && data.column.index >= 3 && data.column.index <= 7) {
          const moduleLabel = `Módulo ${data.column.index - 2}`;
          const textWidth = pdf.getTextWidth(moduleLabel);
          const x = data.cell.x + data.cell.width / 2;
          const y = data.cell.y + data.cell.height / 2 + textWidth / 2;

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
          pdf.text(moduleLabel, x, y, { angle: 90 } as any);
        }
      }
    } as any);
  } else {
    autoTable(pdf, {
      body: [['No hay actividades programadas en este período']],
      startY,
      margin: { left: margins.left, right: margins.right },
      tableWidth: pageWidth - margins.left - margins.right,
      theme: 'plain',
      styles: {
        fillColor: colors.white,
        textColor: colors.black,
        fontStyle: 'italic',
        fontSize: 9,
        cellPadding: 0.8,
        halign: 'center',
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
        overflow: 'linebreak',
        valign: 'middle',
        cellWidth: 'wrap'
      }
    });
  }

  // ============ PIE DE PÁGINA ============
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  const footerText = notasEstudiantes.length > 0
    ? `Promedio General: ${calcularPromedioModulo('total')} | Aprobados: ${contarAprobados()}`
    : 'Sin registros en el período';
  pdf.text(footerText, pageWidth - margins.right, pageHeight - margins.bottom + 10, { align: 'right' });

  // Abrir en nueva pestaña en lugar de descargar
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

/**
 * Genera un reporte WORD de centralizador de notas del diplomado
 * sin cabecera, mostrando solo el título y la tabla.
 */
export const exportDiplomadoCentralizadorNotasWord = ({ diplomado, estudiantes }: ExportDiplomadoCentralizadorNotasParams): void => {
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const notasEstudiantes = estudiantes.map(estudiante => {
    const partes = estudiante.name.split(',').map(p => p.trim());
    const nombre = partes[0] || '';
    const apellidoPaterno = partes[1] || '';
    const apellidoMaterno = partes[2] || '';
    const nombreFormateado = `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim();

    const data = parseEstudianteData(estudiante.notes);
    const ci = data.documentoIdentidad || 'N/A';

    const modulo1 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
    const modulo2 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_2, 0);
    const modulo3 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_3, 0);
    const modulo4 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_4, 0);
    const modulo5 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_5, 0);
    const total = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;

    return {
      nombreFormateado,
      ci,
      modulos: [modulo1, modulo2, modulo3, modulo4, modulo5],
      total
    };
  });

  const calcularPromedioModulo = (index: number): string => {
    if (notasEstudiantes.length === 0) return '0.0';
    const suma = notasEstudiantes.reduce((acc, est) => acc + est.modulos[index], 0);
    return (suma / notasEstudiantes.length).toFixed(1);
  };

  const promedioGeneral = (): string => {
    if (notasEstudiantes.length === 0) return '0.0';
    const suma = notasEstudiantes.reduce((acc, est) => acc + est.total, 0);
    return (suma / notasEstudiantes.length).toFixed(1);
  };

  const modulosHeaders = Array.from({ length: 5 }, (_, i) => `
    <th>MODULO ${i + 1}</th>
  `).join('');

  const filas = notasEstudiantes.map((est, index) => {
    const notas = est.modulos.map(mod => `<td class="num-cell">${mod}</td>`).join('');
    return `
      <tr>
        <td class="num-cell">${index + 1}</td>
        <td>${escapeHtml(est.ci)}</td>
        <td class="name-cell">${escapeHtml(est.nombreFormateado)}</td>
        ${notas}
        <td class="num-cell">${est.total.toFixed(1)}</td>
      </tr>
    `;
  }).join('');

  const filaPromedio = notasEstudiantes.length > 0
    ? `
      <tr class="avg-row">
        <td></td>
        <td></td>
        <td class="name-cell">PROMEDIO GENERAL</td>
        <td class="num-cell">${calcularPromedioModulo(0)}</td>
        <td class="num-cell">${calcularPromedioModulo(1)}</td>
        <td class="num-cell">${calcularPromedioModulo(2)}</td>
        <td class="num-cell">${calcularPromedioModulo(3)}</td>
        <td class="num-cell">${calcularPromedioModulo(4)}</td>
        <td class="num-cell">${promedioGeneral()}</td>
      </tr>
    `
    : '';

  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page { size: letter portrait; margin: 10mm; }
          body { font-family: Arial, sans-serif; margin: 0; color: #000; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #000; padding: 2px 3px; font-size: 11px; }
          thead th { font-weight: 800; text-align: center; border-width: 1.4px; }
          .doc-header-cell { padding: 8px; border-width: 1.4px; }
          .header-grid {
            display: grid;
            grid-template-columns: 150px 1fr 150px;
            align-items: start;
            column-gap: 8px;
          }
          .logo-block { text-align: center; font-size: 10px; font-weight: 700; }
          .logo { width: 72px; height: 72px; object-fit: contain; display: block; margin: 0 auto 4px auto; }
          .title-wrap { text-align: center; }
          .title { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: 0.4px; }
          .subtitle { margin: 6px 0 0 0; font-size: 14px; font-weight: 700; text-transform: uppercase; }
          .meta { margin-top: 8px; font-size: 11px; font-weight: 700; line-height: 1.4; text-align: left; }
          .num-cell { text-align: center; }
          .name-cell { text-align: left; }
          .avg-row td { font-weight: 800; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th colspan="11" class="doc-header-cell">
                <div class="header-grid">
                  <div class="logo-block">
                    <img class="logo" src="${logoInicial}" alt="Logo Universidad" />
                    UNIVERSIDAD [Espacio para Editar]
                  </div>
                  <div class="title-wrap">
                    <h1 class="title">NOMINA OFICIAL DE APROBADAS/OS</h1>
                    <div class="subtitle">${escapeHtml(diplomado.name)}</div>
                  </div>
                  <div class="logo-block">
                    <img class="logo" src="${logoCdima}" alt="Logo CDIMA" />
                    CDIMA
                  </div>
                </div>
                <div class="meta">
                  <div>GESTION: [Espacio para editar]</div>
                  <div>PERIODO: [Espacio para editar]</div>
                </div>
              </th>
            </tr>
            <tr>
              <th style="width: 30px;">No.</th>
              <th style="width: 92px;">C.I.</th>
              <th style="width: 42%;">NOMBRES</th>
              ${modulosHeaders}
              <th>PROMEDIO APROBADOS</th>
            </tr>
          </thead>
          <tbody>
            ${filas || '<tr><td colspan="11" class="num-cell">No hay actividades programadas en este período</td></tr>'}
            ${filaPromedio}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nomina-oficial-diplomado-${diplomado.name.replace(/\s+/g, '-').toLowerCase()}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Genera un reporte PDF individual de un estudiante
 */
export const exportDiplomadoEstudiantePDF = ({ estudiante, diplomado }: ExportDiplomadoEstudianteParams): void => {
  // Colores del proyecto
  const colors = {
    navyBlue: [70, 100, 140],
    lightGray: [117, 117, 117],
    ultraLightGray: [249, 249, 249],
    white: [255, 255, 255],
    forestGreen: [46, 125, 50],
    errorRed: [231, 76, 60]
  };

  const margins = {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20
  };

  const pdf = new jsPDF({
    orientation: 'portrait',
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
  
  // Título Principal (lado derecho)
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
  pdf.text('REPORTE DE ESTUDIANTE', pageWidth - margins.right, margins.top + 8, { align: 'right' });
  
  // Metadatos
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(45, 45, 45);
  
  let metaY = margins.top + 14;
  if (diplomado) {
    pdf.text(`DIPLOMADO: ${diplomado.name}`, pageWidth - margins.right, metaY, { align: 'right' });
    metaY += 5;
  }
  
  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.text(`FECHA DE GENERACION: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  // Línea separadora
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

  let startY = metaY + 14;

  // ============ DATOS DEL ESTUDIANTE ============
  const nombreFormateado = formatearNombreCompleto(estudiante.name);
  const data = parseEstudianteData(estudiante.notes);
  const ci = data.documentoIdentidad || 'N/A';

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
  pdf.text('DATOS DEL ESTUDIANTE', margins.left, startY);
  
  startY += 8;

  // Tabla de información personal
  const datosPersonales = [
    ['Nombre Completo:', nombreFormateado],
    ['Carnet de Identidad:', ci],
    ['Género:', data.genero || 'N/A'],
    ['Especialidad:', data.especialidad || 'N/A'],
    ['Lugar de Nacimiento:', data.lugarNacimiento || 'N/A'],
    ['Fecha de Nacimiento:', data.fechaNacimiento || 'N/A'],
    ['Identidad Cultural:', data.identidadCultural || 'N/A'],
    ['Teléfono:', data.telefono || 'N/A'],
    ['Domicilio:', data.domicilio || 'N/A']
  ];

  autoTable(pdf, {
    body: datosPersonales,
    startY: startY,
    margin: { left: margins.left, right: margins.right },
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', textColor: [70, 100, 140] },
      1: { cellWidth: 120 }
    }
  });

  startY = (pdf as any).lastAutoTable.finalY + 12;

  // ============ NOTAS POR MÓDULO ============
  const modulo1 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
  const modulo2 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_2, 0);
  const modulo3 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_3, 0);
  const modulo4 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_4, 0);
  const modulo5 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_5, 0);
  const promedio = Math.round((modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
  pdf.text('CALIFICACIONES POR MÓDULO', margins.left, startY);
  
  startY += 8;

  const notasData = [
    ['Módulo 1', modulo1.toString(), modulo1 >= 51 ? 'Aprobado' : 'Reprobado'],
    ['Módulo 2', modulo2.toString(), modulo2 >= 51 ? 'Aprobado' : 'Reprobado'],
    ['Módulo 3', modulo3.toString(), modulo3 >= 51 ? 'Aprobado' : 'Reprobado'],
    ['Módulo 4', modulo4.toString(), modulo4 >= 51 ? 'Aprobado' : 'Reprobado'],
    ['Módulo 5', modulo5.toString(), modulo5 >= 51 ? 'Aprobado' : 'Reprobado']
  ];

  // @ts-ignore - didDrawCell es soportado por jspdf-autotable pero los tipos TypeScript no están completos
  autoTable(pdf, {
    head: [['Módulo', 'Nota', 'Estado']],
    body: notasData,
    startY: startY,
    margin: { left: margins.left, right: margins.right },
    theme: 'striped',
    headStyles: {
      fillColor: colors.navyBlue,
      textColor: colors.white,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      cellPadding: 5
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      halign: 'center',
      textColor: [45, 45, 45],
      lineColor: [230, 230, 230],
      lineWidth: 0.1
    },
    bodyStyles: {
      fillColor: colors.white
    },
    alternateRowStyles: {
      fillColor: colors.ultraLightGray
    },
    columnStyles: {
      0: { cellWidth: 60, halign: 'left' },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 60 }
    },
    // @ts-ignore - didDrawCell es válido pero no está en los tipos de jspdf-autotable
    didDrawCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 2) {
        const estado = data.cell.raw;
        if (estado === 'Aprobado') {
          pdf.setTextColor(colors.forestGreen[0], colors.forestGreen[1], colors.forestGreen[2]);
        } else {
          pdf.setTextColor(colors.errorRed[0], colors.errorRed[1], colors.errorRed[2]);
        }
      }
    }
  });

  startY = (pdf as any).lastAutoTable.finalY + 8;

  // Promedio final
  autoTable(pdf, {
    body: [['PROMEDIO FINAL', promedio.toString(), promedio >= 51 ? 'APROBADO' : 'REPROBADO']],
    startY: startY,
    margin: { left: margins.left, right: margins.right },
    theme: 'plain',
    styles: {
      fontSize: 11,
      cellPadding: 5,
      fontStyle: 'bold',
      halign: 'center',
      fillColor: colors.ultraLightGray,
      lineColor: colors.navyBlue,
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 60, halign: 'left', textColor: colors.navyBlue },
      1: { cellWidth: 40, fontSize: 13, textColor: promedio >= 51 ? colors.forestGreen : colors.errorRed },
      2: { cellWidth: 60, textColor: promedio >= 51 ? colors.forestGreen : colors.errorRed }
    }
  });

  startY = (pdf as any).lastAutoTable.finalY + 12;

  // ============ REGISTRO DE ASISTENCIA ============
  const registrosAsistencia = parseAsistenciaRecords(estudiante.notes || '')
    .sort((a, b) => {
      const [diaA, mesA, añoA] = a.fecha.split('/').map(Number);
      const [diaB, mesB, añoB] = b.fecha.split('/').map(Number);
      const fechaA = new Date(añoA, mesA - 1, diaA);
      const fechaB = new Date(añoB, mesB - 1, diaB);
      return fechaA.getTime() - fechaB.getTime();
    });

  if (registrosAsistencia.length > 0) {
    // Verificar si necesitamos una nueva página
    if (startY > pageHeight - 80) {
      pdf.addPage();
      startY = margins.top + 10;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
    pdf.text('REGISTRO DE ASISTENCIA', margins.left, startY);
    
    startY += 8;

    const asistenciaData = registrosAsistencia.map(registro => [
      registro.fecha,
      registro.asistio ? 'Sí' : 'No',
      registro.observaciones || 'Ninguna'
    ]);

    // @ts-ignore - didDrawCell es soportado por jspdf-autotable pero los tipos TypeScript no están completos
    autoTable(pdf, {
      head: [['Fecha', 'Asistió', 'Observaciones']],
      body: asistenciaData,
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      theme: 'striped',
      headStyles: {
        fillColor: colors.navyBlue,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
        cellPadding: 5
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [45, 45, 45],
        lineColor: [230, 230, 230],
        lineWidth: 0.1
      },
      bodyStyles: {
        fillColor: colors.white
      },
      alternateRowStyles: {
        fillColor: colors.ultraLightGray
      },
      columnStyles: {
        0: { cellWidth: 35, halign: 'center' },
        1: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 100, halign: 'left' }
      },
      // @ts-ignore - didDrawCell es válido pero no está en los tipos de jspdf-autotable
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 1) {
          const asistio = data.cell.raw;
          if (asistio === 'Sí') {
            pdf.setTextColor(colors.forestGreen[0], colors.forestGreen[1], colors.forestGreen[2]);
          } else {
            pdf.setTextColor(colors.errorRed[0], colors.errorRed[1], colors.errorRed[2]);
          }
        }
      }
    });

    // Estadísticas de asistencia
    const totalAsistencias = registrosAsistencia.filter(r => r.asistio).length;
    const porcentaje = ((totalAsistencias / registrosAsistencia.length) * 100).toFixed(1);
    
    startY = (pdf as any).lastAutoTable.finalY + 8;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    pdf.text(`Total registros: ${registrosAsistencia.length} | Asistencias: ${totalAsistencias} | Porcentaje: ${porcentaje}%`, margins.left, startY);
  } else {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    pdf.text('No hay registros de asistencia para este estudiante.', margins.left, startY);
  }

  // ============ PIE DE PÁGINA ============
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  const footerText = `Reporte generado el ${fechaGeneracion}`;
  pdf.text(footerText, pageWidth / 2, pageHeight - margins.bottom + 5, { align: 'center' });

  // Abrir en nueva pestaña en lugar de descargar
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};
