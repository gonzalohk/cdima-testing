import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoInicial from '../../assets/logoinicial.png';
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
  // Colores del proyecto (mismo esquema que PlanningPage)
  const colors = {
    navyBlue: [70, 100, 140],
    lightGray: [117, 117, 117],
    ultraLightGray: [249, 249, 249],
    white: [255, 255, 255]
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
  pdf.text('REPORTE DE DIPLOMADO', pageWidth - margins.right, margins.top + 8, { align: 'right' });
  
  // Metadatos
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(45, 45, 45);
  
  let metaY = margins.top + 14;
  pdf.text(`DIPLOMADO: ${diplomado.name}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  metaY += 5;
  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.text(`FECHA DE GENERACION: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  // Línea separadora
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

  let startY = metaY + 14;

  // ============ TABLA DE DOCENTES ============
  if (docentes.length > 0) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
    pdf.text('DOCENTES', margins.left, startY);
    
    startY += 8;

    const docentesData = docentes.map(docente => {
      const info = parseInfoPrimariaLegacy(docente, 'Docente');
      
      // Parsear nombre en formato "Nombre, Apellido Paterno, Apellido Materno"
      const partes = docente.name.split(',').map(p => p.trim());
      const nombre = partes[0] || '';
      const apellidoPaterno = partes[1] || '';
      const apellidoMaterno = partes[2] || '';
      const nombreFormateado = `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim();
      
      return [
        nombreFormateado,
        info.genero || 'N/A',
        info.telefono || 'N/A',
        info.lugarNacimiento || 'N/A',
        info.documentoIdentidad || 'N/A',
        info.identidadCultural || 'N/A'
      ];
    });

    autoTable(pdf, {
      head: [['Nombre', 'Genero', 'Telefono', 'Lugar de Nacimiento', 'Doc. Identidad', 'Identidad Cultural']],
      body: docentesData,
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      theme: 'striped',
      headStyles: {
        fillColor: colors.navyBlue,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 5
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'middle',
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
        0: { cellWidth: 35 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 35 },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 30 }
      }
    });

    startY = (pdf as any).lastAutoTable.finalY + 12;
  }

  // ============ TABLA DE ESTUDIANTES ============
  if (estudiantes.length > 0) {
    // Verificar si necesitamos una nueva página
    if (startY > pageHeight - 80) {
      pdf.addPage();
      startY = margins.top + 10;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
    pdf.text('ESTUDIANTES', margins.left, startY);
    
    startY += 8;

    const estudiantesData = estudiantes.map(estudiante => {
      const info = parseInfoPrimariaLegacy(estudiante, 'Estudiante');
      
      // Parsear nombre en formato "Nombre, Apellido Paterno, Apellido Materno"
      const partes = estudiante.name.split(',').map(p => p.trim());
      const nombre = partes[0] || '';
      const apellidoPaterno = partes[1] || '';
      const apellidoMaterno = partes[2] || '';
      const nombreFormateado = `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim();
      
      return [
        nombreFormateado,
        info.genero || 'N/A',
        info.telefono || 'N/A',
        info.lugarNacimiento || 'N/A',
        info.documentoIdentidad || 'N/A',
        info.identidadCultural || 'N/A'
      ];
    });

    autoTable(pdf, {
      head: [['Nombre', 'Genero', 'Telefono', 'Lugar de Nacimiento', 'Doc. Identidad', 'Identidad Cultural']],
      body: estudiantesData,
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      theme: 'striped',
      headStyles: {
        fillColor: colors.navyBlue,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 5
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'middle',
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
        0: { cellWidth: 35 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 35 },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 30 }
      }
    });
  }

  // ============ PIE DE PÁGINA ============
  const finalY = (pdf as any).lastAutoTable?.finalY || startY;
  if (finalY < pageHeight - 30) {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    const footerText = `Total Docentes: ${docentes.length} | Total Estudiantes: ${estudiantes.length}`;
    pdf.text(footerText, pageWidth / 2, pageHeight - margins.bottom + 5, { align: 'center' });
  }

  // Abrir en nueva pestaña en lugar de descargar
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

/**
 * Genera un reporte PDF de centralizador de notas del diplomado
 */
export const exportDiplomadoCentralizadorNotasPDF = ({ diplomado, estudiantes }: ExportDiplomadoCentralizadorNotasParams): void => {
  if (estudiantes.length === 0) return;

  // Colores del proyecto (mismo esquema que PlanningPage)
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
  pdf.text('CENTRALIZADOR DE NOTAS', pageWidth - margins.right, margins.top + 8, { align: 'right' });
  
  // Metadatos
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(45, 45, 45);
  
  let metaY = margins.top + 14;
  pdf.text(`DIPLOMADO: ${diplomado.name}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  metaY += 5;
  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.text(`FECHA DE GENERACION: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });
  
  // Línea separadora
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

  let startY = metaY + 14;

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
    head: [['No.', 'C.I', 'Nombres', 'M1', 'M2', 'M3', 'M4', 'M5', 'PROM']],
    body: tableBody,
    startY: startY,
    margin: { left: margins.left, right: margins.right },
    theme: 'striped',
    headStyles: {
      fillColor: colors.navyBlue,
      textColor: colors.white,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: { top: 18, right: 2, bottom: 2, left: 2 } // Más espacio arriba para texto vertical
    },
    styles: {
      fontSize: 7,
      cellPadding: 3,
      overflow: 'linebreak',
      valign: 'middle',
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
      0: { cellWidth: 10, halign: 'center' }, // No.
      1: { cellWidth: 20, halign: 'center' }, // C.I
      2: { cellWidth: 50, halign: 'left' },   // Nombres
      3: { cellWidth: 15, halign: 'center' }, // MODULO 1
      4: { cellWidth: 15, halign: 'center' }, // MODULO 2
      5: { cellWidth: 15, halign: 'center' }, // MODULO 3
      6: { cellWidth: 15, halign: 'center' }, // MODULO 4
      7: { cellWidth: 15, halign: 'center' }, // MODULO 5
      8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' } // PROMEDIO
    },
    // @ts-ignore - didDrawCell es soportado por jspdf-autotable pero los tipos TypeScript no están completos
    didDrawCell: (data: any) => {
      // Dibujar texto vertical para las cabeceras de módulos y promedio
      if (data.section === 'head' && data.column.index >= 3 && data.column.index <= 8) {
        const cellX = data.cell.x;
        const cellY = data.cell.y;
        const cellWidth = data.cell.width;
        const cellHeight = data.cell.height;
        
        // Definir el texto completo para cada columna
        const textos: { [key: number]: string } = {
          3: 'MODULO 1',
          4: 'MODULO 2',
          5: 'MODULO 3',
          6: 'MODULO 4',
          7: 'MODULO 5',
          8: 'PROMEDIO'
        };
        
        const texto = textos[data.column.index];
        
        if (texto) {
          // Limpiar el texto por defecto (ya dibujado)
          pdf.setFillColor(colors.navyBlue[0], colors.navyBlue[1], colors.navyBlue[2]);
          pdf.rect(cellX, cellY, cellWidth, cellHeight, 'F');
          
          // Configurar estilo del texto
          pdf.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          
          // Calcular posición para centrar el texto vertical
          const textX = cellX + cellWidth / 2 + 2; // Ajuste para centrar
          const textY = cellY + cellHeight / 2 + (pdf.getStringUnitWidth(texto) * 8 / pdf.internal.scaleFactor / 2);
          
          // Dibujar texto rotado 90 grados (vertical)
          pdf.text(texto, textX, textY, {
            angle: 90,
            align: 'center'
          });
        }
      }
    }
  });

  // ============ NOTA INFORMATIVA ============
  const finalY = (pdf as any).lastAutoTable.finalY + 8;
  if (finalY < pageHeight - 35) {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    pdf.text('Nota: Las calificaciones >= 51 se consideran aprobadas y < 51 reprobadas.', margins.left, finalY);
    pdf.text(`Total de estudiantes: ${estudiantes.length}`, margins.left, finalY + 4);
    pdf.text(`Aprobados: ${contarAprobados()} | Reprobados: ${estudiantes.length - contarAprobados()}`, margins.left, finalY + 8);
  }

  // ============ PIE DE PÁGINA ============
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  const footerText = `Promedio General: ${calcularPromedioModulo('total')} | Aprobados: ${contarAprobados()}`;
  pdf.text(footerText, pageWidth / 2, pageHeight - margins.bottom + 5, { align: 'center' });

  // Abrir en nueva pestaña en lugar de descargar
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
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
    ['Teléfono:', data.telefono || 'N/A']
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
