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
  parseAsistenciaRecords,
  parseNotasObservaciones
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

interface ExportDiplomadoGeneralWordParams {
  diplomado: AsanaSection;
  estudiantes: AsanaTask[];
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
      
      const nombreCompleto = [apellidoPaterno, apellidoMaterno, nombre].filter(Boolean).join(' ').trim() || 'N/A';
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
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 21, halign: 'center' },
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
      
      const nombreCompleto = [apellidoPaterno, apellidoMaterno, nombre].filter(Boolean).join(' ').trim() || 'N/A';
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

export const exportDiplomadoGeneralWord = ({ diplomado, estudiantes }: ExportDiplomadoGeneralWordParams): void => {
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const calcularEdad = (fechaNacimiento?: string): string => {
    if (!fechaNacimiento) return '';

    const match = fechaNacimiento.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!match) return '';

    const dia = Number(match[1]);
    const mes = Number(match[2]) - 1;
    let anio = Number(match[3]);
    if (anio < 100) anio += 1900;

    const nacimiento = new Date(anio, mes, dia);
    if (Number.isNaN(nacimiento.getTime())) return '';

    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mesDiff = hoy.getMonth() - nacimiento.getMonth();
    const diaDiff = hoy.getDate() - nacimiento.getDate();
    if (mesDiff < 0 || (mesDiff === 0 && diaDiff < 0)) edad -= 1;

    return edad >= 0 ? String(edad) : '';
  };

  const filasParticipantes = estudiantes.map((estudiante, index) => {
    const partes = estudiante.name.split(',').map(p => p.trim());
    const nombres = partes[0] || '';
    const apellidoPaterno = partes[1] || '';
    const apellidoMaterno = partes[2] || '';
    const nombreCompleto = `${apellidoPaterno} ${apellidoMaterno} ${nombres}`.trim();
    const data = parseEstudianteData(estudiante.notes);

    return {
      numero: index + 1,
      nombreCompleto,
      ci: data.documentoIdentidad || '',
      edad: calcularEdad(data.fechaNacimiento),
      comunidad: data.domicilio || data.lugarNacimiento || '',
      cargo: data.especialidad || '',
      celular: data.telefono || '',
      genero: (data.genero || '').toLowerCase()
    };
  });

  const mujeres = filasParticipantes.filter(item => item.genero.includes('femen') || item.genero.includes('muj')).length;
  const varones = filasParticipantes.filter(item => item.genero.includes('mascul') || item.genero.includes('varon') || item.genero.includes('hom')).length;
  const total = filasParticipantes.length;
  const filasTabla = Array.from({ length: Math.max(20, filasParticipantes.length) }, (_, index) => {
    const item = filasParticipantes[index];
    if (!item) {
      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }

    return `
      <tr>
        <td class="center">${item.numero}</td>
        <td>${escapeHtml(item.nombreCompleto)}</td>
        <td class="center">${escapeHtml(item.ci)}</td>
        <td class="center">${item.edad}</td>
        <td>${escapeHtml(item.comunidad)}</td>
        <td>${escapeHtml(item.cargo)}</td>
        <td class="center">${escapeHtml(item.celular)}</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page Section1 {
            size: 11in 8.5in;
            mso-page-orientation: landscape;
            margin: 10mm 10mm 10mm 10mm;
          }
          div.Section1 { page: Section1; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #000; }
          table { border-collapse: collapse; }
          td, th { border: 1px solid #000; font-size: 11px; padding: 4px 5px; vertical-align: middle; }
          .main-table { width: 100%; table-layout: fixed; }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .header-logo { text-align: center; vertical-align: middle; border: none; }
          .header-logo img { max-width: 88px; max-height: 88px; object-fit: contain; display: block; margin: 0 auto 4px auto; }
          .header-text { text-align: center; vertical-align: middle; border: none; }
          .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
          .project { font-size: 11px; font-weight: 700; }
          .saih { font-size: 11px; line-height: 1.35; margin-top: 6px; }
          .field-cell { height: 28px; vertical-align: top; }
          .summary-cell { vertical-align: top; padding: 4px; }
          .summary-counts { width: 100%; }
          .summary-title { font-size: 11px; font-weight: 700; text-align: center; }
          tr.participant-head th { text-align: center; font-weight: 700; }
          .participant-body td { height: 24px; }
          .no-col { width: 4.5%; }
          .name-col { width: 24%; }
          .ci-col { width: 14%; }
          .edad-col { width: 6%; }
          .comunidad-col { width: 16%; }
          .cargo-col { width: 10%; }
          .cel-col { width: 10%; }
          .firma-col { width: 10%; }
          .material-col { width: 2.75%; }
        </style>
      </head>
      <body>
        <div class="Section1">
        <table class="main-table">
          <colgroup>
            <col class="no-col" />
            <col class="name-col" />
            <col class="ci-col" />
            <col class="edad-col" />
            <col class="comunidad-col" />
            <col class="cargo-col" />
            <col class="cel-col" />
            <col class="firma-col" />
            <col class="material-col" />
            <col class="material-col" />
          </colgroup>
          <tr>
            <td class="header-logo" colspan="2">
              <img src="${logoInicial}" alt="Logo institucional" />
              <div class="bold">ESPACIO PARA LOGOTIPO</div>
            </td>
            <td class="header-text" colspan="8">
              <div class="title">LISTA DE PARTICIPANTES</div>
              <div class="project">PROYECTO: "Educación Superior Inclusiva para Mujeres y Jóvenes Indígenas y Afrodescendientes"</div>
              <div class="saih">
                <div class="bold">SAIH</div>
                <div>El Fondo de Asistencia Internacional</div>
                <div>de los Estudiantes y Académicos Noruegos</div>
              </div>
            </td>
          </tr>
          <tr>
            <td class="field-cell" colspan="6"><span class="bold">ACTIVIDAD:</span> </td>
            <td class="summary-cell" colspan="4" rowspan="4">
              <table class="summary-counts">
                <tr><td colspan="2" class="summary-title">NRO. DE ASISTENCIA DE PARTICIPANTES</td></tr>
                <tr><td colspan="2" class="bold center">POBLACION</td></tr>
                <tr><td>Mujeres</td><td class="center">${mujeres}</td></tr>
                <tr><td>Varones</td><td class="center">${varones}</td></tr>
                <tr><td class="bold">TOTAL</td><td class="center">${total}</td></tr>
                <tr><td class="bold">19 D/B</td><td></td></tr>
                <tr><td class="bold">TOTAL</td><td class="center">${total}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="field-cell" colspan="6"><span class="bold">TEMA:</span> </td>
          </tr>
          <tr>
            <td class="field-cell" colspan="6"><span class="bold">LUGAR Y FECHA:</span> </td>
          </tr>
          <tr>
            <td class="field-cell" colspan="6"><span class="bold">RESPONSABLE:</span> </td>
          </tr>
          <tr class="participant-head">
            <th rowspan="2">N°</th>
            <th rowspan="2">NOMBRES Y APELLIDOS</th>
            <th rowspan="2">N° CEDULA IDENTIDAD</th>
            <th rowspan="2">EDAD</th>
            <th rowspan="2">COMUNIDAD / MUNICIPIO</th>
            <th rowspan="2">CARGO</th>
            <th rowspan="2">N° DE CELULAR</th>
            <th rowspan="2">FIRMAS</th>
            <th colspan="2">MATERIAL</th>
          </tr>
          <tr class="participant-head">
            <th>SI</th>
            <th>NO</th>
          </tr>
          <tbody class="participant-body">
            ${filasTabla}
          </tbody>
        </table>
        </div>
      </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lista-participantes-diplomado-${diplomado.name.replace(/\s+/g, '-').toLowerCase()}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  pdf.text('Nómina Oficial de Aprobados/as', pageWidth - margins.right, margins.top + 5, { align: 'right' });
  
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
      total: parseFloat(total.toFixed(2))
    };
  });

  const calcularPromedioModulo = (moduloKey: string): number => {
    if (notasEstudiantes.length === 0) return 0;
    const suma = notasEstudiantes.reduce((acc: number, est: any) => acc + est[moduloKey], 0);
    return parseFloat((suma / notasEstudiantes.length).toFixed(2));
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
        if (data.section === 'body' && data.row.index === notasEstudiantes.length) {
          data.cell.styles.fillColor = colors.headerGray;
          data.cell.styles.fontStyle = 'bold';
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
    const total = parseFloat(((modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5).toFixed(2));

    return {
      nombreFormateado,
      ci,
      modulos: [modulo1, modulo2, modulo3, modulo4, modulo5],
      total
    };
  });

  const calcularPromedioModulo = (index: number): string => {
    if (notasEstudiantes.length === 0) return '0.00';
    const suma = notasEstudiantes.reduce((acc, est) => acc + est.modulos[index], 0);
    return (suma / notasEstudiantes.length).toFixed(2);
  };

  const promedioGeneral = (): string => {
    if (notasEstudiantes.length === 0) return '0.00';
    const suma = notasEstudiantes.reduce((acc, est) => acc + est.total, 0);
    return (suma / notasEstudiantes.length).toFixed(2);
  };

  const modulosHeaders = Array.from({ length: 5 }, (_, i) => `
    <td>MODULO ${i + 1}</td>
  `).join('');

  const filas = notasEstudiantes.map((est, index) => {
    const notas = est.modulos.map(mod => `<td class="num-cell">${mod}</td>`).join('');
    return `
      <tr>
        <td class="num-cell">${index + 1}</td>
        <td>${escapeHtml(est.ci)}</td>
        <td class="name-cell">${escapeHtml(est.nombreFormateado)}</td>
        ${notas}
        <td class="num-cell">${est.total.toFixed(2)}</td>
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
          @page { size: letter portrait; margin: 12.7mm; }
          body { font-family: Arial, sans-serif; margin: 0; color: #000; }
          .meta { margin-top: 8px; font-size: 11px; font-weight: 700; line-height: 1.4; margin-bottom: 10px; }
          .data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .data-table td { border: 1px solid #000; padding: 2px 3px; font-size: 11px; }
          .data-table tr.header-row td { font-weight: 800; text-align: center; border-width: 1.4px; }
          .num-cell { text-align: center; }
          .name-cell { text-align: left; }
          .avg-row td { font-weight: 800; }
        </style>
      </head>
      <body>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
          <tr>
            <td style="border: none; text-align: center; width: 100px; vertical-align: top; padding: 0;">
              <img style="width: 72px; height: 72px; object-fit: contain; display: block; margin: 0 auto;" src="${logoInicial}" alt="Logo Universidad" />
            </td>
            <td style="border: none; text-align: center; vertical-align: middle; padding: 0;">
              <h1 style="margin: 0; font-size: 16px; font-weight: 800; letter-spacing: 0.4px;">NOMINA OFICIAL DE APROBADAS/OS</h1>
              <div style="margin: 6px 0 0 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">${escapeHtml(diplomado.name)}</div>
            </td>
            <td style="border: none; text-align: center; width: 100px; vertical-align: top; padding: 0;">
              <img style="width: 72px; height: 72px; object-fit: contain; display: block; margin: 0 auto;" src="${logoCdima}" alt="Logo CDIMA" />
            </td>
          </tr>
        </table>
        <div class="meta">
          <div>GESTION: [Espacio para editar]</div>
          <div>PERIODO: [Espacio para editar]</div>
        </div>
        <table class="data-table">
          <tbody>
            <tr class="header-row">
              <td style="width: 30px;">No.</td>
              <td style="width: 92px;">C.I.</td>
              <td style="width: 42%;">NOMBRES</td>
              ${modulosHeaders}
              <td>PROMEDIO APROBADOS</td>
            </tr>
            ${filas || '<tr><td colspan="9" class="num-cell">No hay actividades programadas en este período</td></tr>'}
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

  // Logo (lado izquierdo)
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
  pdf.text('REPORTE DE ESTUDIANTE', pageWidth - margins.right, margins.top + 5, { align: 'right' });

  // Metadatos
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);

  let metaY = margins.top + 12;
  if (diplomado) {
    pdf.text(`DIPLOMADO: ${diplomado.name}`, pageWidth - margins.right, metaY, { align: 'right' });
    metaY += 5;
  }

  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.text(`FECHA DE GENERACION: ${fechaGeneracion}`, pageWidth - margins.right, metaY, { align: 'right' });

  // Línea separadora
  pdf.setDrawColor(colors.headerGray[0], colors.headerGray[1], colors.headerGray[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, metaY + 6, pageWidth - margins.right, metaY + 6);

  let startY = metaY + 22;

  // ============ DATOS DEL ESTUDIANTE ============
  const nombreFormateado = formatearNombreCompleto(estudiante.name);
  const data = parseEstudianteData(estudiante.notes);
  const ci = data.documentoIdentidad || 'N/A';

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  pdf.text('DATOS DEL ESTUDIANTE', margins.left, startY);

  startY += 8;

  const camposDatos: [string, string][] = [
    ['Nombre Completo:', nombreFormateado],
    ['Carnet de Identidad:', ci]
  ];

  pdf.setFontSize(10);
  const labelX = margins.left;
  const valueX = margins.left + 52;
  const fieldSpacing = 7;
  let textY = startY;

  for (const [label, value] of camposDatos) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text(label, labelX, textY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, valueX, textY);
    textY += fieldSpacing;
  }

  startY = textY + 6;

  // ============ NOTAS POR MÓDULO ============
  const modulo1 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
  const modulo2 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_2, 0);
  const modulo3 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_3, 0);
  const modulo4 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_4, 0);
  const modulo5 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_5, 0);
  const promedio = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
  pdf.text('CALIFICACIONES POR MÓDULO', margins.left, startY);

  startY += 8;

  const obsModulos = parseNotasObservaciones(estudiante.notes);
  const notasData = [
    ['Módulo 1', modulo1.toString(), modulo1 >= 51 ? 'Aprobado' : 'Reprobado', obsModulos['Módulo 1'] || ''],
    ['Módulo 2', modulo2.toString(), modulo2 >= 51 ? 'Aprobado' : 'Reprobado', obsModulos['Módulo 2'] || ''],
    ['Módulo 3', modulo3.toString(), modulo3 >= 51 ? 'Aprobado' : 'Reprobado', obsModulos['Módulo 3'] || ''],
    ['Módulo 4', modulo4.toString(), modulo4 >= 51 ? 'Aprobado' : 'Reprobado', obsModulos['Módulo 4'] || ''],
    ['Módulo 5', modulo5.toString(), modulo5 >= 51 ? 'Aprobado' : 'Reprobado', obsModulos['Módulo 5'] || '']
  ];

  const notasTotalWidth = pageWidth - margins.left - margins.right;
  const notasMarginLeft = margins.left;

  autoTable(pdf, {
    head: [['Módulo', 'Nota', 'Estado', 'Observaciones']],
    body: notasData,
    startY: startY,
    margin: { left: notasMarginLeft, right: margins.right },
    tableWidth: notasTotalWidth,
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
      cellPadding: 2,
      halign: 'center',
      textColor: colors.black,
      fillColor: colors.white,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'left' },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { halign: 'left' }
    }
  });

  startY = (pdf as any).lastAutoTable.finalY + 8;

  // Promedio final
  autoTable(pdf, {
    body: [['PROMEDIO FINAL', promedio.toFixed(2), promedio >= 51 ? 'APROBADO' : 'REPROBADO', '']],
    startY: startY,
    margin: { left: notasMarginLeft, right: margins.right },
    tableWidth: notasTotalWidth,
    theme: 'plain',
    styles: {
      fontSize: 11,
      cellPadding: 5,
      fontStyle: 'bold',
      halign: 'center',
      fillColor: colors.lightGray,
      lineColor: [180, 180, 180],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'left', textColor: colors.black },
      1: { cellWidth: 28, fontSize: 13, textColor: colors.black },
      2: { cellWidth: 40, textColor: colors.black },
      3: { textColor: colors.black }
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
    if (startY > pageHeight - 60) {
      pdf.addPage();
      startY = margins.top + 10;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    pdf.text('REGISTRO DE ASISTENCIA', margins.left, startY);

    startY += 8;

    const totalAsistencias = registrosAsistencia.filter(r => r.asistio).length;
    const totalFaltas = registrosAsistencia.length - totalAsistencias;
    const porcentaje = ((totalAsistencias / registrosAsistencia.length) * 100).toFixed(1);
    const fechasAsistio = registrosAsistencia.filter(r => r.asistio).map(r => r.fecha).join('   ');
    const fechasFalto = registrosAsistencia.filter(r => !r.asistio).map(r => r.fecha).join('   ');
    const todasObservaciones = registrosAsistencia
      .filter(r => r.observaciones && r.observaciones.trim() && r.observaciones.trim().toLowerCase() !== 'ninguna')
      .map(r => `${r.fecha}: ${r.observaciones.trim()}`)
      .join('\n');

    const bodyAsistencia: string[][] = [
      ['Porcentaje de Asistencia', `${porcentaje}%`],
      ['Total Sesiones', `${registrosAsistencia.length} Registros  (${totalAsistencias} Asistencias, ${totalFaltas} Faltas)`],
      ['Asistió', fechasAsistio || '—'],
      ['Faltó', fechasFalto || '—'],
    ];
    if (todasObservaciones) bodyAsistencia.push(['Observación', todasObservaciones]);

    autoTable(pdf, {
      body: bodyAsistencia,
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      tableWidth: pageWidth - margins.left - margins.right,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: colors.black,
        fillColor: [248, 250, 252],
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
        valign: 'middle',
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold', halign: 'left' },
        1: { halign: 'left' }
      },
      didParseCell: (data) => {
        if (data.row.index === 2) {
          data.cell.styles.fillColor = [223, 240, 224];
          data.cell.styles.textColor = [64, 112, 64];
        }
        if (data.row.index === 3) {
          data.cell.styles.fillColor = [252, 224, 226];
          data.cell.styles.textColor = [148, 68, 72];
        }
      }
    });
  } else {
    autoTable(pdf, {
      body: [['No hay registros de asistencia para este estudiante.']],
      startY: startY,
      margin: { left: margins.left, right: margins.right },
      tableWidth: pageWidth - margins.left - margins.right,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 10,
        fontStyle: 'italic',
        halign: 'center',
        fillColor: colors.white,
        textColor: colors.black,
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
        overflow: 'linebreak',
        valign: 'middle'
      }
    });
  }

  // Abrir en nueva pestaña en lugar de descargar
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

/**
 * Genera un reporte WORD individual de un estudiante con sus notas y asistencia.
 * Contenido idéntico al PDF.
 */
export const exportDiplomadoEstudianteWord = ({ estudiante, diplomado }: ExportDiplomadoEstudianteParams): void => {
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const nombreFormateado = formatearNombreCompleto(estudiante.name);
  const data = parseEstudianteData(estudiante.notes);
  const ci = data.documentoIdentidad || 'N/A';

  // ── NOTAS (5 módulos fijos) ──
  const modulo1 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_1, 0);
  const modulo2 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_2, 0);
  const modulo3 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_3, 0);
  const modulo4 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_4, 0);
  const modulo5 = getCustomFieldValueSafe(estudiante, ASANA_CUSTOM_FIELDS.MODULO_5, 0);
  const modulosConNotas = [
    { nombre: 'Módulo 1', nota: modulo1 },
    { nombre: 'Módulo 2', nota: modulo2 },
    { nombre: 'Módulo 3', nota: modulo3 },
    { nombre: 'Módulo 4', nota: modulo4 },
    { nombre: 'Módulo 5', nota: modulo5 },
  ];
  const promedio = (modulo1 + modulo2 + modulo3 + modulo4 + modulo5) / 5;
  const obsModulos = parseNotasObservaciones(estudiante.notes);

  const notasFilas = modulosConNotas.map(m => `
    <tr>
      <td class="mod-col">${escapeHtml(m.nombre)}</td>
      <td class="num-col" style="font-weight:700">${m.nota}</td>
      <td class="estado-col">${m.nota >= 51 ? 'Aprobado' : 'Reprobado'}</td>
      <td class="obs-col">${escapeHtml(obsModulos[m.nombre] || '')}</td>
    </tr>`).join('');

  // ── ASISTENCIA ──
  const registrosAsistencia = parseAsistenciaRecords(estudiante.notes || '')
    .sort((a, b) => {
      const [dA, mA, yA] = a.fecha.split('/').map(Number);
      const [dB, mB, yB] = b.fecha.split('/').map(Number);
      return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
    });

  let asistenciaSection = '';
  if (registrosAsistencia.length > 0) {
    const totalAsistencias = registrosAsistencia.filter(r => r.asistio).length;
    const totalFaltas = registrosAsistencia.length - totalAsistencias;
    const porcentaje = ((totalAsistencias / registrosAsistencia.length) * 100).toFixed(1);
    const fechasAsistio = registrosAsistencia.filter(r => r.asistio).map(r => r.fecha).join('   ');
    const fechasFalto = registrosAsistencia.filter(r => !r.asistio).map(r => r.fecha).join('   ');
    const todasObservaciones = registrosAsistencia
      .filter(r => r.observaciones && r.observaciones.trim() && r.observaciones.trim().toLowerCase() !== 'ninguna')
      .map(r => `${r.fecha}: ${r.observaciones.trim()}`)
      .join('\n');
    const obsRow = todasObservaciones
      ? `<tr><td class="asist-label">Observación</td><td style="white-space:pre-wrap">${escapeHtml(todasObservaciones)}</td></tr>`
      : '';
    asistenciaSection = `
      <h3 class="section-title">REGISTRO DE ASISTENCIA</h3>
      <table class="asist-table">
        <tr><td class="asist-label">Porcentaje de Asistencia</td><td>${porcentaje}%</td></tr>
        <tr><td class="asist-label">Total Sesiones</td><td>${registrosAsistencia.length} Registros (${totalAsistencias} Asistencias, ${totalFaltas} Faltas)</td></tr>
        <tr class="asistio-row"><td class="asist-label">Asistió</td><td>${escapeHtml(fechasAsistio || '—')}</td></tr>
        <tr class="falto-row"><td class="asist-label">Faltó</td><td>${escapeHtml(fechasFalto || '—')}</td></tr>
        ${obsRow}
      </table>`;
  } else {
    asistenciaSection = `
      <h3 class="section-title">REGISTRO DE ASISTENCIA</h3>
      <p class="no-data">No hay registros de asistencia para este estudiante.</p>`;
  }

  const contextoLabel = diplomado ? `<div>DIPLOMADO: ${escapeHtml(diplomado.name)}</div>` : '';
  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page { size: letter portrait; margin: 20mm; }
          body { font-family: Arial, sans-serif; margin: 0; color: #000; font-size: 11px; }
          .header { display: table; width: 100%; margin-bottom: 8px; }
          .header-logo { display: table-cell; width: 80px; vertical-align: middle; }
          .header-logo img { width: 64px; height: 64px; object-fit: contain; }
          .header-info { display: table-cell; text-align: right; vertical-align: middle; padding-left: 8px; }
          .header-title { font-size: 16px; font-weight: 800; }
          .header-meta { font-size: 10px; margin-top: 2px; line-height: 1.5; }
          hr.separator { border: none; border-top: 1px solid #dcdcdc; margin: 8px 0 12px 0; }
          h3.section-title { font-size: 12px; font-weight: 800; margin: 14px 0 5px 0; text-transform: uppercase; }
          table { border-collapse: collapse; width: 100%; }
          .datos-table td { border: 1px solid #b4b4b4; padding: 4px 6px; vertical-align: middle; }
          .datos-label { font-weight: 700; width: 35%; background: #dcdcdc; }
          .notas-table th { border: 1px solid #b4b4b4; padding: 4px 6px; font-weight: 700; background: #dcdcdc; text-align: center; }
          .notas-table td { border: 1px solid #b4b4b4; padding: 3px 5px; vertical-align: middle; }
          .mod-col { width: 30%; }
          .num-col { width: 12%; text-align: center; }
          .estado-col { width: 18%; text-align: center; }
          .obs-col { width: 40%; }
          .promedio-row td { font-weight: 700; font-size: 12px; background: #f5f5f5; }
          .asist-table td { border: 1px solid #b4b4b4; padding: 4px 6px; vertical-align: top; }
          .asist-label { font-weight: 700; width: 30%; background: #f8fafc; }
          .asistio-row td { background: #dff0e0; color: #407040; }
          .falto-row td { background: #fce0e2; color: #944448; }
          .no-data { font-style: italic; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-logo"><img src="${logoInicial}" alt="Logo" /></div>
          <div class="header-info">
            <div class="header-title">REPORTE DE ESTUDIANTE</div>
            <div class="header-meta">
              ${contextoLabel}
              <div>FECHA DE GENERACION: ${fechaGeneracion}</div>
            </div>
          </div>
        </div>
        <hr class="separator" />
        <h3 class="section-title">DATOS DEL ESTUDIANTE</h3>
        <table class="datos-table">
          <tr><td class="datos-label">Nombre Completo:</td><td>${escapeHtml(nombreFormateado)}</td></tr>
          <tr><td class="datos-label">Carnet de Identidad:</td><td>${escapeHtml(ci)}</td></tr>
        </table>
        <h3 class="section-title">CALIFICACIONES POR MÓDULO</h3>
        <table class="notas-table">
          <thead>
            <tr><th class="mod-col">Módulo</th><th class="num-col">Nota</th><th class="estado-col">Estado</th><th class="obs-col">Observaciones</th></tr>
          </thead>
          <tbody>
            ${notasFilas}
            <tr class="promedio-row">
              <td class="mod-col">PROMEDIO FINAL</td>
              <td class="num-col">${promedio.toFixed(2)}</td>
              <td class="estado-col">${promedio >= 51 ? 'APROBADO' : 'REPROBADO'}</td>
              <td class="obs-col"></td>
            </tr>
          </tbody>
        </table>
        ${asistenciaSection}
      </body>
    </html>`;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-estudiante-${nombreFormateado.replace(/\s+/g, '-').toLowerCase()}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Genera un PDF de Nómina de Participantes con listado alfabético de estudiantes.
 */
export const exportDiplomadoNominaPDF = ({ diplomado, estudiantes }: { diplomado: AsanaSection; estudiantes: AsanaTask[] }): void => {
  const colors = {
    black: [0, 0, 0] as [number, number, number],
    headerGray: [220, 220, 220] as [number, number, number]
  };
  const margins = { top: 20, bottom: 20, left: 20, right: 20 };
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  try {
    pdf.addImage(logoInicial, 'PNG', margins.left, margins.top, 28, 0);
  } catch (_) { /* sin logo */ }

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...colors.black);
  pdf.text('NÓMINA DE PARTICIPANTES', pageWidth - margins.right, margins.top + 5, { align: 'right' });

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`PROGRAMA: ${diplomado.name}`, pageWidth - margins.right, margins.top + 12, { align: 'right' });

  pdf.setFontSize(9);
  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.text(`FECHA: ${fechaGeneracion}`, pageWidth - margins.right, margins.top + 18, { align: 'right' });

  pdf.setDrawColor(...colors.headerGray);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, margins.top + 24, pageWidth - margins.right, margins.top + 24);

  const participantes = estudiantes.map(est => {
    const partes = est.name.split(',').map(p => p.trim());
    const nombre = partes[0] || '';
    const apellidoPaterno = partes[1] || '';
    const apellidoMaterno = partes[2] || '';
    const nombreFormateado = `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim();
    const data = parseEstudianteData(est.notes);
    return { nombreFormateado, apellidoPaterno, ci: data.documentoIdentidad || '' };
  }).sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno, 'es', { sensitivity: 'base' }));

  const tableBody = participantes.map((p, i) => [(i + 1).toString(), p.nombreFormateado, p.ci]);

  autoTable(pdf, {
    head: [['No.', 'APELLIDOS Y NOMBRES', 'C.I.']],
    body: tableBody,
    startY: margins.top + 28,
    showHead: 'firstPage',
    margin: { left: margins.left, right: margins.right },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: colors.black, lineColor: [180, 180, 180], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: colors.headerGray, textColor: colors.black, fontStyle: 'bold', fontSize: 9, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left' },
      2: { halign: 'center', cellWidth: 35 }
    }
  });

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...colors.black);
  pdf.text(`Total: ${participantes.length} participante${participantes.length !== 1 ? 's' : ''}`, pageWidth - margins.right, pageHeight - margins.bottom + 10, { align: 'right' });

  window.open(URL.createObjectURL(pdf.output('blob')), '_blank');
};

export const exportDiplomadoNominaWord = ({ diplomado, estudiantes }: { diplomado: AsanaSection; estudiantes: AsanaTask[] }): void => {
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const participantes = estudiantes.map(est => {
    const partes = est.name.split(',').map(p => p.trim());
    const nombre = partes[0] || '';
    const apellidoPaterno = partes[1] || '';
    const apellidoMaterno = partes[2] || '';
    const nombreFormateado = `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim();
    const data = parseEstudianteData(est.notes);
    return { nombreFormateado, apellidoPaterno, ci: data.documentoIdentidad || '' };
  }).sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno, 'es', { sensitivity: 'base' }));

  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

  const filas = participantes.map((p, i) => `
    <tr>
      <td class="num-cell">${i + 1}</td>
      <td class="name-cell">${escapeHtml(p.nombreFormateado)}</td>
      <td class="num-cell">${escapeHtml(p.ci)}</td>
    </tr>`).join('');

  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page { size: letter portrait; margin: 12.7mm; }
          body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; color: #000; }
          .header-grid { display: table; width: 100%; margin-bottom: 8px; }
          .header-left { display: table-cell; vertical-align: middle; width: 80px; }
          .header-right { display: table-cell; vertical-align: middle; text-align: right; }
          .logo { width: 60px; height: auto; }
          .title { font-size: 15px; font-weight: bold; margin: 0; }
          .subtitle { font-size: 12px; font-weight: bold; margin: 3px 0 0 0; text-transform: uppercase; }
          .fecha { font-size: 10px; margin: 2px 0 0 0; }
          hr { border: none; border-top: 1px solid #aaa; margin: 6px 0 8px 0; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          td { border: 1px solid #000; padding: 3px 4px; font-size: 10px; }
          tr.header-row td { font-weight: bold; text-align: center; background-color: #dcdcdc; border-width: 1.4px; }
          .num-cell { text-align: center; }
          .name-cell { text-align: left; }
          .footer { font-size: 9px; text-align: right; margin-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header-grid">
          <div class="header-left">
            <img class="logo" src="${logoInicial}" alt="Logo" />
          </div>
          <div class="header-right">
            <p class="title">NÓMINA DE PARTICIPANTES</p>
            <p class="subtitle">PROGRAMA: ${escapeHtml(diplomado.name)}</p>
            <p class="fecha">FECHA: ${fechaGeneracion}</p>
          </div>
        </div>
        <hr />
        <table>
          <tbody>
            <tr class="header-row">
              <td style="width:30px;">No.</td>
              <td>APELLIDOS Y NOMBRES</td>
              <td style="width:80px;">C.I.</td>
            </tr>
            ${filas}
          </tbody>
        </table>
        <div class="footer">Total: ${participantes.length} participante${participantes.length !== 1 ? 's' : ''}</div>
      </body>
    </html>`;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Nomina_${diplomado.name.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportDiplomadoAsistenciaPDF = ({ diplomado, estudiantes }: { diplomado: AsanaSection; estudiantes: AsanaTask[] }): void => {
  const MIN_COLS = 15;
  const colors = {
    black: [0, 0, 0] as [number, number, number],
    headerGray: [220, 220, 220] as [number, number, number],
  };
  const margins = { top: 20, bottom: 15, left: 12.7, right: 12.7 };
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  try { pdf.addImage(logoInicial, 'PNG', margins.left, margins.top, 28, 0); } catch (_) { /* sin logo */ }

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...colors.black);
  pdf.text('REGISTRO DE ASISTENCIA', pageWidth - margins.right, margins.top + 5, { align: 'right' });

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`PROGRAMA: ${diplomado.name}`, pageWidth - margins.right, margins.top + 12, { align: 'right' });

  pdf.setFontSize(9);
  pdf.text(`FECHA: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}`, pageWidth - margins.right, margins.top + 18, { align: 'right' });

  pdf.setDrawColor(...colors.headerGray);
  pdf.setLineWidth(0.3);
  pdf.line(margins.left, margins.top + 24, pageWidth - margins.right, margins.top + 24);

  const todasLasFechas = new Set<string>();
  estudiantes.forEach(est => {
    parseAsistenciaRecords(est.notes).forEach(r => { if (r.fecha) todasLasFechas.add(r.fecha); });
  });
  const fechasOrdenadas = Array.from(todasLasFechas).sort((a, b) => {
    const [dA, mA, yA] = a.split('/').map(Number);
    const [dB, mB, yB] = b.split('/').map(Number);
    return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
  });
  const numCols = Math.max(MIN_COLS, fechasOrdenadas.length);
  const fechasCols = [...fechasOrdenadas, ...Array(numCols - fechasOrdenadas.length).fill('')];

  const participantes = estudiantes.map(est => {
    const partes = est.name.split(',').map(p => p.trim());
    const nombre = partes[0] || '';
    const apellidoPaterno = partes[1] || '';
    const apellidoMaterno = partes[2] || '';
    return { gid: est.gid, nombreFormateado: `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim(), apellidoPaterno };
  }).sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno, 'es', { sensitivity: 'base' }));

  const asistenciaMap = new Map<string, Map<string, string>>();
  estudiantes.forEach(est => {
    const m = new Map<string, string>();
    parseAsistenciaRecords(est.notes).forEach(r => { if (r.fecha) m.set(r.fecha, r.asistio ? 'A' : 'F'); });
    asistenciaMap.set(est.gid, m);
  });

  const head = [['#', 'APELLIDOS Y NOMBRES', ...fechasCols.map(f => f ? f.slice(0, 5) : '')]];
  const body = participantes.map((p, i) => {
    const m = asistenciaMap.get(p.gid) || new Map();
    return [(i + 1).toString(), p.nombreFormateado, ...fechasCols.map(f => f ? (m.get(f) ?? '') : '')];
  });

  const availableWidth = pageWidth - margins.left - margins.right;
  const numWidth = 10;
  const nombreWidth = 65;
  const dateColWidth = Math.max(9, (availableWidth - numWidth - nombreWidth) / numCols);
  const colStyles: Record<number, object> = { 0: { halign: 'center', cellWidth: numWidth }, 1: { halign: 'left', cellWidth: nombreWidth } };
  for (let i = 0; i < numCols; i++) colStyles[i + 2] = { halign: 'center', cellWidth: dateColWidth };

  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(...colors.black);
  pdf.text('Leyenda:  A = Asistió  |  F = Faltó', margins.left, margins.top + 27.5);

  autoTable(pdf, {
    head, body,
    startY: margins.top + 33,
    showHead: 'firstPage',
    margin: { left: margins.left, right: margins.right },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: colors.black, lineColor: [180, 180, 180] as [number, number, number], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle', halign: 'center' },
    headStyles: { fillColor: colors.headerGray, textColor: colors.black, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    columnStyles: colStyles,
    didParseCell: (data: any) => {
      if (data.row.section === 'body' && data.column.index >= 2) {
        const val = data.cell.raw;
        if (val === 'A') data.cell.styles.fillColor = [209, 250, 229];
        else if (val === 'F') data.cell.styles.fillColor = [254, 226, 226];
      }
    },
  });

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...colors.black);
  pdf.text(`Total: ${participantes.length} participante${participantes.length !== 1 ? 's' : ''}  |  A = Asistió  |  F = Faltó`, pageWidth - margins.right, pageHeight - 5, { align: 'right' });

  window.open(URL.createObjectURL(pdf.output('blob')), '_blank');
};

export const exportDiplomadoAsistenciaWord = ({ diplomado, estudiantes }: { diplomado: AsanaSection; estudiantes: AsanaTask[] }): void => {
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const MIN_COLS = 15;
  const fechaGeneracion = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

  const todasLasFechas = new Set<string>();
  estudiantes.forEach(est => {
    parseAsistenciaRecords(est.notes).forEach(r => { if (r.fecha) todasLasFechas.add(r.fecha); });
  });
  const fechasOrdenadas = Array.from(todasLasFechas).sort((a, b) => {
    const [dA, mA, yA] = a.split('/').map(Number);
    const [dB, mB, yB] = b.split('/').map(Number);
    return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
  });
  const numCols = Math.max(MIN_COLS, fechasOrdenadas.length);
  const fechasCols = [...fechasOrdenadas, ...Array(numCols - fechasOrdenadas.length).fill('')];

  const participantes = estudiantes.map(est => {
    const partes = est.name.split(',').map(p => p.trim());
    const nombre = partes[0] || '';
    const apellidoPaterno = partes[1] || '';
    const apellidoMaterno = partes[2] || '';
    return { gid: est.gid, nombreFormateado: `${apellidoPaterno} ${apellidoMaterno} ${nombre}`.trim(), apellidoPaterno };
  }).sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno, 'es', { sensitivity: 'base' }));

  const asistenciaMap = new Map<string, Map<string, string>>();
  estudiantes.forEach(est => {
    const mapaFechas = new Map<string, string>();
    parseAsistenciaRecords(est.notes).forEach(r => { if (r.fecha) mapaFechas.set(r.fecha, r.asistio ? 'A' : 'F'); });
    asistenciaMap.set(est.gid, mapaFechas);
  });

  const headerCols = ['#', 'APELLIDOS Y NOMBRES', ...fechasCols.map(f => f ? f.slice(0, 5) : '')];
  const headerHtml = headerCols.map(h => `<td>${escapeHtml(h)}</td>`).join('');

  const filas = participantes.map((p, i) => {
    const mapaEst = asistenciaMap.get(p.gid) || new Map();
    const celdas = fechasCols.map(f => {
      const val = f ? (mapaEst.get(f) ?? '') : '';
      const bg = val === 'A' ? ' style="background-color:#d1fae5;"' : val === 'F' ? ' style="background-color:#fee2e2;"' : '';
      return `<td class="att-cell"${bg}>${escapeHtml(val)}</td>`;
    }).join('');
    return `<tr><td class="num-cell">${i + 1}</td><td class="name-cell">${escapeHtml(p.nombreFormateado)}</td>${celdas}</tr>`;
  }).join('');

  const htmlContent = `<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      @page { size: letter landscape; margin: 12.7mm; }
      body { font-family: Arial, sans-serif; font-size: 9px; margin: 0; color: #000; }
      .header-grid { display: table; width: 100%; margin-bottom: 8px; }
      .header-left { display: table-cell; vertical-align: middle; width: 80px; }
      .header-right { display: table-cell; vertical-align: middle; text-align: right; }
      .logo { width: 60px; height: auto; }
      .title { font-size: 14px; font-weight: bold; margin: 0; }
      .subtitle { font-size: 11px; font-weight: bold; margin: 3px 0 0 0; text-transform: uppercase; }
      .fecha { font-size: 9px; margin: 2px 0 0 0; }
      hr { border: none; border-top: 1px solid #aaa; margin: 6px 0 8px 0; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      td { border: 1px solid #000; padding: 2px 3px; font-size: 8px; word-wrap: break-word; overflow-wrap: break-word; }
      tr.header-row td { font-weight: bold; text-align: center; background-color: #dcdcdc; border-width: 1.4px; }
      .num-cell { text-align: center; width: 22px; }
      .name-cell { text-align: left; width: 170px; }
      .att-cell { text-align: center; }
      .legend { font-size: 8px; margin: 0 0 5px 0; }
      .footer { font-size: 8px; text-align: right; margin-top: 6px; }
    </style>
  </head>
  <body>
    <div class="header-grid">
      <div class="header-left">
        <img class="logo" src="${logoInicial}" alt="Logo" />
      </div>
      <div class="header-right">
        <p class="title">REGISTRO DE ASISTENCIA</p>
        <p class="subtitle">PROGRAMA: ${escapeHtml(diplomado.name)}</p>
        <p class="fecha">FECHA: ${fechaGeneracion}</p>
      </div>
    </div>
    <hr />
    <p class="legend">Leyenda:&nbsp; <span style="background:#d1fae5;padding:1px 5px;border:1px solid #6ee7b7;">A</span> = Asistió&nbsp; |&nbsp; <span style="background:#fee2e2;padding:1px 5px;border:1px solid #fca5a5;">F</span> = Faltó</p>
    <table>
      <tbody>
        <tr class="header-row">${headerHtml}</tr>
        ${filas}
      </tbody>
    </table>
    <div class="footer">Total: ${participantes.length} participante${participantes.length !== 1 ? 's' : ''}  |  A = Asistió  |  F = Faltó</div>
  </body>
</html>`;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Asistencia_${diplomado.name.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};
