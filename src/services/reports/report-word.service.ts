import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  ShadingType,
  BorderStyle,
  PageOrientation,
} from 'docx';
import { AsanaTask } from '../../types/asana.types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ============ CONSTANTES DE ESTILO — IDÉNTICO AL PDF ============
const COLORS = {
  black: '000000',
  headerGray: 'DCDCDC',   // [220,220,220]
  lineGray: 'B4B4B4',     // [180,180,180]
  white: 'FFFFFF',
};

const CELL_BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 2, color: COLORS.lineGray },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.lineGray },
  left:   { style: BorderStyle.SINGLE, size: 2, color: COLORS.lineGray },
  right:  { style: BorderStyle.SINGLE, size: 2, color: COLORS.lineGray },
};

// ============ HELPERS ============
const getCustomFieldValue = (task: AsanaTask, fieldName: string): string => {
  if (!task.custom_fields) return '-';
  const field = task.custom_fields.find(f => f.name === fieldName);
  if (!field) return '-';
  if (field.display_value) return field.display_value;
  if (field.type === 'multi_enum' && field.multi_enum_values && field.multi_enum_values.length > 0)
    return field.multi_enum_values.map(v => v.name).join(', ');
  if (field.type === 'enum' && field.enum_value) return field.enum_value.name;
  if (field.type === 'number' && field.number_value !== null && field.number_value !== undefined)
    return field.number_value.toString();
  if (field.type === 'text' && field.text_value) return field.text_value;
  return '-';
};

const formatDate = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

const buildFecha = (task: AsanaTask): string => {
  const startDate = formatDate(task.start_on);
  const endDate = formatDate(task.due_on);
  if (startDate && endDate) return `${startDate} - ${endDate}`;
  if (startDate) return startDate;
  if (endDate) return endDate;
  return '-';
};

// Celda de encabezado (fondo gris, negrita, borde)
const headerCell = (text: string, widthPct: number): TableCell =>
  new TableCell({
    borders: CELL_BORDER,
    shading: { type: ShadingType.SOLID, color: COLORS.headerGray, fill: COLORS.headerGray },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, color: COLORS.black, font: 'Arial' })],
        alignment: AlignmentType.LEFT,
      }),
    ],
  });

// Celda de datos (fondo blanco, borde)
const dataCell = (text: string, widthPct: number, center = false): TableCell =>
  new TableCell({
    borders: CELL_BORDER,
    shading: { type: ShadingType.SOLID, color: COLORS.white, fill: COLORS.white },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 17, color: COLORS.black, font: 'Arial' })],
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      }),
    ],
  });

// Construye la tabla de actividades
const buildActivityTable = (tasks: AsanaTask[]): Table => {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell('ACTIVIDAD', 42),
      headerCell('RESPONSABLE', 23),
      headerCell('FECHA', 20),
      headerCell('ESTADO', 15),
    ],
  });

  const dataRows = tasks.map(task =>
    new TableRow({
      children: [
        dataCell(task.name, 42),
        dataCell(getCustomFieldValue(task, 'Responsable de Actividad'), 23),
        dataCell(buildFecha(task), 20),
        dataCell(getCustomFieldValue(task, 'Estado') || '-', 15, true),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
};

// Línea separadora (párrafo con borde inferior)
const separatorLine = (): Paragraph =>
  new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 3, color: COLORS.headerGray },
    },
    spacing: { after: 120 },
    children: [],
  });

// Título de sección (11pt bold uppercase)
const sectionTitle = (text: string): Paragraph =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: COLORS.black, font: 'Arial' }),
    ],
  });

// ============ FUNCIÓN PRINCIPAL DE EXPORTACIÓN ============
export const exportTaskReportToWord = (
  _mainTask: AsanaTask,
  subtasks: AsanaTask[],
  projectName: string
): void => {
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

  const inProcessTasks = subtasks.filter(task =>
    getCustomFieldValue(task, 'Estado') === 'EN PROCESO'
  );

  const completedTasks = subtasks.filter(task =>
    getCustomFieldValue(task, 'Estado') === 'EJECUTADO'
  );

  const now = new Date();
  const monthName = format(now, 'MMMM', { locale: es });
  const yearNumber = format(now, 'yyyy', { locale: es });
  const dayNumber = format(now, 'd', { locale: es });

  // ============ CONTENIDO DEL DOCUMENTO ============
  const children: (Paragraph | Table)[] = [];

  // ---- ENCABEZADO ----
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'REPORTE EJECUTIVO DE AVANCE', bold: true, size: 28, color: COLORS.black, font: 'Arial' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: `PROYECTO: ${projectName}`, size: 18, color: COLORS.black, font: 'Arial' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: `PERÍODO: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${yearNumber}`,
          size: 18,
          color: COLORS.black,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `FECHA DE GENERACIÓN: ${dayNumber} de ${monthName} de ${yearNumber}`,
          size: 18,
          color: COLORS.black,
          font: 'Arial',
        }),
      ],
    }),
    separatorLine()
  );

  // ---- SECCIÓN 1: CON RETRASO ----
  if (overdueTasks.length > 0) {
    children.push(sectionTitle(`ACTIVIDADES EJECUTADAS (CON RETRASO) (${overdueTasks.length})`));
    children.push(buildActivityTable(overdueTasks));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  // ---- SECCIÓN 2: EN PROCESO ----
  if (inProcessTasks.length > 0) {
    children.push(sectionTitle(`ACTIVIDADES EN PROCESO (${inProcessTasks.length})`));
    children.push(buildActivityTable(inProcessTasks));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  // ---- SECCIÓN 3: EJECUTADAS ----
  if (completedTasks.length > 0) {
    children.push(sectionTitle(`ACTIVIDADES EJECUTADAS (${completedTasks.length})`));
    children.push(buildActivityTable(completedTasks));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  // ---- PIE DE PÁGINA ----
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'CDIMA - Reporte Ejecutivo de Avance', size: 16, color: COLORS.black, font: 'Arial' }),
      ],
    })
  );

  // ============ CONSTRUIR Y DESCARGAR ============
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 15840,   // 11 in × 1440 twips (Letter landscape width)
              height: 12240,  // 8.5 in × 1440 twips (Letter landscape height)
            },
            margin: {
              top: 1134,    // 20mm
              bottom: 1134,
              left: 1134,
              right: 1134,
            },
          },
        },
        children,
      },
    ],
  });

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Ejecutivo_${projectName.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

// ============ EXPORTAR DISTRIBUCIÓN A WORD ============
export const exportDistributionReportToWord = (
  byAssignee: { [key: string]: { total: number; completed: number; pending: number } },
  title: string,
  columnName: string,
  projectName: string
): void => {
  const now = new Date();
  const monthName = format(now, 'MMMM', { locale: es });
  const yearNumber = format(now, 'yyyy', { locale: es });
  const dayNumber = format(now, 'd', { locale: es });

  const mkCell = (text: string, widthPct: number, bold = false, center = false): TableCell =>
    new TableCell({
      borders: CELL_BORDER,
      shading: bold
        ? { type: ShadingType.SOLID, color: COLORS.headerGray, fill: COLORS.headerGray }
        : { type: ShadingType.SOLID, color: COLORS.white, fill: COLORS.white },
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold, size: bold ? 18 : 17, color: COLORS.black, font: 'Arial' })],
          alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        }),
      ],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      mkCell(columnName, 40, true),
      mkCell('Total', 15, true, true),
      mkCell('Ejecutadas', 15, true, true),
      mkCell('En Proceso', 15, true, true),
      mkCell('Progreso', 15, true, true),
    ],
  });

  const dataRows = Object.entries(byAssignee)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([name, stats]) => {
      const progress = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0.0';
      return new TableRow({
        children: [
          mkCell(name, 40),
          mkCell(stats.total.toString(), 15, false, true),
          mkCell(stats.completed.toString(), 15, false, true),
          mkCell(stats.pending.toString(), 15, false, true),
          mkCell(`${progress}%`, 15, false, true),
        ],
      });
    });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 28, color: COLORS.black, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      children: [new TextRun({ text: `PROYECTO: ${projectName}`, size: 18, color: COLORS.black, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [new TextRun({ text: `FECHA DE GENERACIÓN: ${dayNumber} de ${monthName} de ${yearNumber}`, size: 18, color: COLORS.black, font: 'Arial' })],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLORS.headerGray } },
      spacing: { after: 120 },
      children: [],
    }),
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: COLORS.black, font: 'Arial' })],
    }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `CDIMA - ${title}`, size: 16, color: COLORS.black, font: 'Arial' })],
    }),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      children,
    }],
  });

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${projectName.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

// ============ EXPORTAR BENEFICIARIOS A WORD ============
export const exportBeneficiariesToWord = (
  tasksWithoutReplicantes: AsanaTask[],
  tasksWithReplicantes: AsanaTask[],
  totalsWithoutReplicantes: { mujeres: number; hombres: number; poblacionMeta: number },
  totalsWithReplicantes: { mujeres: number; hombres: number },
  totalWithoutReplicantes: number,
  totalWithReplicantes: number,
  _poblacionMeta: number,
  projectName: string
): void => {
  const now = new Date();
  const monthName = format(now, 'MMMM', { locale: es });
  const yearNumber = format(now, 'yyyy', { locale: es });
  const dayNumber = format(now, 'd', { locale: es });

  const mkCell = (text: string, widthPct: number, bold = false, center = false): TableCell =>
    new TableCell({
      borders: CELL_BORDER,
      shading: bold
        ? { type: ShadingType.SOLID, color: COLORS.headerGray, fill: COLORS.headerGray }
        : { type: ShadingType.SOLID, color: COLORS.white, fill: COLORS.white },
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold, size: bold ? 18 : 17, color: COLORS.black, font: 'Arial' })],
          alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        }),
      ],
    });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'RESUMEN DE BENEFICIARIOS', bold: true, size: 28, color: COLORS.black, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      children: [new TextRun({ text: `PROYECTO: ${projectName}`, size: 18, color: COLORS.black, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [new TextRun({ text: `FECHA DE GENERACIÓN: ${dayNumber} de ${monthName} de ${yearNumber}`, size: 18, color: COLORS.black, font: 'Arial' })],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLORS.headerGray } },
      spacing: { after: 120 },
      children: [],
    }),
  ];

  // ---- Beneficiarios Directos ----
  if (tasksWithoutReplicantes.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: 'BENEFICIARIOS DIRECTOS', bold: true, size: 22, color: COLORS.black, font: 'Arial' })],
      })
    );

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        mkCell('Nombre', 30, true),
        mkCell('Lugar', 19, true),
        mkCell('Pobl. Meta', 12, true, true),
        mkCell('Mujeres', 13, true, true),
        mkCell('Hombres', 13, true, true),
        mkCell('Total', 13, true, true),
      ],
    });

    const dataRows = tasksWithoutReplicantes.map(task => {
      const mujeres = getCustomFieldValue(task, 'Mujeres ');
      const hombres = getCustomFieldValue(task, 'Hombres');
      const mujeresNum = mujeres !== '-' ? parseInt(mujeres) : 0;
      const hombresNum = hombres !== '-' ? parseInt(hombres) : 0;
      const total = mujeresNum + hombresNum;
      return new TableRow({
        children: [
          mkCell(task.name, 30),
          mkCell(getCustomFieldValue(task, 'Lugar'), 19),
          mkCell(getCustomFieldValue(task, 'Población Meta'), 12, false, true),
          mkCell(mujeres, 13, false, true),
          mkCell(hombres, 13, false, true),
          mkCell(total > 0 ? total.toString() : '-', 13, false, true),
        ],
      });
    });

    const totalsRow = new TableRow({
      children: [
        new TableCell({
          borders: CELL_BORDER,
          shading: { type: ShadingType.SOLID, color: COLORS.headerGray, fill: COLORS.headerGray },
          columnSpan: 2,
          children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL', bold: true, size: 18, color: COLORS.black, font: 'Arial' })] })],
        }),
        mkCell(totalsWithoutReplicantes.poblacionMeta.toString(), 12, true, true),
        mkCell(totalsWithoutReplicantes.mujeres.toString(), 13, true, true),
        mkCell(totalsWithoutReplicantes.hombres.toString(), 13, true, true),
        mkCell(totalWithoutReplicantes.toString(), 13, true, true),
      ],
    });

    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows, totalsRow] }),
      new Paragraph({ spacing: { after: 240 }, children: [] })
    );
  }

  // ---- Beneficiarios Indirectos ----
  if (tasksWithReplicantes.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: 'BENEFICIARIOS INDIRECTOS (CON REPLICANTES)', bold: true, size: 22, color: COLORS.black, font: 'Arial' })],
      })
    );

    const headerRow2 = new TableRow({
      tableHeader: true,
      children: [
        mkCell('Nombre', 30, true),
        mkCell('Lugar', 19, true),
        mkCell('Replicantes', 12, true, true),
        mkCell('Mujeres', 13, true, true),
        mkCell('Hombres', 13, true, true),
        mkCell('Total', 13, true, true),
      ],
    });

    const dataRows2 = tasksWithReplicantes.map(task => {
      const mujeres = getCustomFieldValue(task, 'Mujeres ');
      const hombres = getCustomFieldValue(task, 'Hombres');
      const replicantes = getCustomFieldValue(task, 'Replicantes');
      const mujeresNum = mujeres !== '-' ? parseInt(mujeres) : 0;
      const hombresNum = hombres !== '-' ? parseInt(hombres) : 0;
      const replicantesNum = replicantes !== '-' ? parseInt(replicantes) || 0 : 0;
      const total = mujeresNum + hombresNum + replicantesNum;
      return new TableRow({
        children: [
          mkCell(task.name, 30),
          mkCell(getCustomFieldValue(task, 'Lugar'), 19),
          mkCell(getCustomFieldValue(task, 'Replicantes'), 12, false, true),
          mkCell(mujeres, 13, false, true),
          mkCell(hombres, 13, false, true),
          mkCell(total > 0 ? total.toString() : '-', 13, false, true),
        ],
      });
    });

    const totalReplicantes2 = tasksWithReplicantes.reduce((sum, task) => {
      const r = getCustomFieldValue(task, 'Replicantes');
      return sum + (r !== '-' ? parseInt(r) || 0 : 0);
    }, 0);

    const totalsRow2 = new TableRow({
      children: [
        new TableCell({
          borders: CELL_BORDER,
          shading: { type: ShadingType.SOLID, color: COLORS.headerGray, fill: COLORS.headerGray },
          columnSpan: 2,
          children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL', bold: true, size: 18, color: COLORS.black, font: 'Arial' })] })],
        }),
        mkCell(totalReplicantes2.toString(), 12, true, true),
        mkCell(totalsWithReplicantes.mujeres.toString(), 13, true, true),
        mkCell(totalsWithReplicantes.hombres.toString(), 13, true, true),
        mkCell(totalWithReplicantes.toString(), 13, true, true),
      ],
    });

    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow2, ...dataRows2, totalsRow2] }),
      new Paragraph({ spacing: { after: 240 }, children: [] })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'CDIMA - Resumen de Beneficiarios', size: 16, color: COLORS.black, font: 'Arial' })],
    })
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      children,
    }],
  });

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Beneficiarios_${projectName.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
};
