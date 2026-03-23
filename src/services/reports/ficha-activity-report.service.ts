// ============================================================
// Exportación de la Ficha de Actividad a PDF y Word
// ============================================================
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { AsanaTask } from '../../types/asana.types';
import logoInicial from '../../assets/logoinicial.png';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Public types ─────────────────────────────────────────────────────────────
export interface FichaFuente {
  nombre: string;
  link: string;
}

export interface FichaExportData {
  task: AsanaTask;
  subtasks: AsanaTask[];
  aggregatedValues: {
    mujeres: string;
    hombres: string;
    total: string;
    poblacionMeta: string;
  };
  generalStatistics: {
    total: number;
    completed: number;
    pending: number;
    completionPercentage: number;
  };
  projectName: string;
  fuentesEntradas?: FichaFuente[];
}

// ── Shared helpers ────────────────────────────────────────────────────────────
const getField = (task: AsanaTask, name: string): string => {
  if (!task.custom_fields) return '-';
  const f = task.custom_fields.find(f => f.name === name);
  if (!f) return '-';
  if (f.display_value) return f.display_value;
  if (f.type === 'multi_enum' && f.multi_enum_values?.length)
    return f.multi_enum_values.map(v => v.name).join(', ');
  if (f.type === 'enum' && f.enum_value) return f.enum_value.name;
  if (f.type === 'number' && f.number_value != null) return f.number_value.toString();
  if (f.type === 'text' && f.text_value) return f.text_value;
  return '-';
};

const extractJsonData = (notes?: string): Record<string, unknown> | null => {
  if (!notes) return null;
  const m = notes.match(/===DATOS_JSON===\s*([\s\S]+?)\s*===FIN_DATOS_JSON===/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
};

const statusLabel = (estado: string): string => {
  const up = estado.toUpperCase();
  if (up === 'EJECUTADO') return 'Ejecutado';
  if (up === 'EN PROCESO') return 'En Proceso';
  return 'Pendiente';
};

const EXCLUDED_PREFIXES = ['FUENTES DE VERIFICACION', 'SFON', 'SMAT', 'DMAT', 'CPER'];
const getDisplaySubtasks = (subtasks: AsanaTask[]) =>
  subtasks.filter(
    t =>
      !EXCLUDED_PREFIXES.some(p => t.name.startsWith(p)) &&
      getField(t, 'Tipo de Solicitud') === '-'
  );
const getSolicitudes = (subtasks: AsanaTask[]) =>
  subtasks.filter(t => {
    const tipo = getField(t, 'Tipo de Solicitud');
    return (
      tipo === 'Solicitud de Fondos' ||
      tipo === 'Solicitud de Material' ||
      tipo === 'Solicitud de Devolucion'
    );
  });
const getContrataciones = (subtasks: AsanaTask[]) =>
  subtasks.filter(t => t.name.startsWith('CPER - '));

const safeValue = (v: string) => (v === '-' ? '0' : v);

// ══════════════════════════════════════════════════════════════════════════════
// PDF EXPORT
// ══════════════════════════════════════════════════════════════════════════════
const PW = 215.9;
const PH = 279.4;
const M = { top: 20, bottom: 20, left: 20, right: 20 };

const C = {
  black:      [0, 0, 0]       as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  lightGray:  [245, 245, 245] as [number, number, number],
  headerGray: [220, 220, 220] as [number, number, number],
  borderGray: [180, 180, 180] as [number, number, number],
};

export const exportFichaActividadToPDF = ({
  task,
  subtasks,
  aggregatedValues,
  generalStatistics,
  projectName,
  fuentesEntradas = [],
}: FichaExportData): void => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const uw = PW - M.left - M.right;

  const paginate = (y: number, needed = 20): number => {
    if (y + needed > 263) { doc.addPage(); return M.top + 4; }
    return y;
  };

  // ── HEADER ─────────────────────────────────────────────────────────────────
  try {
    doc.addImage(logoInicial, 'PNG', M.left, M.top, 28, 0);
  } catch {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text('CDIMA', M.left, M.top + 8);
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.black);
  doc.text('FICHA DE ACTIVIDAD', PW - M.right, M.top + 5, { align: 'right' });

  const now = new Date();
  const dateStr = format(now, "d 'de' MMMM 'de' yyyy", { locale: es });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.black);
  doc.text(`Proyecto: ${projectName}`, PW - M.right, M.top + 12, { align: 'right' });
  doc.text(`Generado: ${dateStr}`, PW - M.right, M.top + 17, { align: 'right' });

  let y = M.top + 22;
  doc.setDrawColor(...C.headerGray);
  doc.setLineWidth(0.3);
  doc.line(M.left, y, PW - M.right, y);
  y += 7;

  // ── SEC 1: INFO GENERAL ─────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.black);
  doc.text('INFORMACIÓN GENERAL', M.left, y);
  y += 4;

  const estado = getField(task, 'Estado');
  const responsable = getField(task, 'Responsable de Actividad');
  const lugar = getField(task, 'Lugar');
  const notasClean = (task.notes ?? '')
    .replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '')
    .trim();

  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ['Nombre', task.name],
      ['Estado', statusLabel(estado)],
      ['Responsable', responsable],
      ['Lugar', lugar],
      ['Fecha', [task.start_on, task.due_on].filter(Boolean).join(' – ') || 'Sin fecha'],
    ],
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 }, lineColor: C.borderGray, lineWidth: 0.2 },
    bodyStyles: { fillColor: C.white, textColor: C.black },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42, textColor: C.black as [number, number, number] },
      1: { cellWidth: uw - 42, textColor: C.black as [number, number, number] },
    },
    margin: { left: M.left, right: M.right },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── SEC 2: INDICADORES ──────────────────────────────────────────────────────
  y = paginate(y, 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.black);
  doc.text('INDICADORES DE IMPACTO', M.left, y);
  y += 5;

  const boxW = (uw - 6) / 4;
  const boxH = 18;
  const metrics: { label: string; value: string }[] = [
    { label: 'Población Meta',      value: safeValue(aggregatedValues.poblacionMeta) },
    { label: 'Total Beneficiarios', value: safeValue(aggregatedValues.total)         },
    { label: 'Mujeres',             value: safeValue(aggregatedValues.mujeres)       },
    { label: 'Hombres',             value: safeValue(aggregatedValues.hombres)       },
  ];

  metrics.forEach(({ label, value }, i) => {
    const bx = M.left + i * (boxW + 2);
    doc.setFillColor(...C.lightGray);
    doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text(value, bx + boxW / 2, y + 9, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.black);
    const labelLines = doc.splitTextToSize(label, boxW - 6);
    doc.text(labelLines, bx + boxW / 2, y + 14, { align: 'center' });
  });

  y += boxH + 8;

  // ── SEC 3: PROGRESO ─────────────────────────────────────────────────────────
  y = paginate(y, 28);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.black);
  doc.text('PROGRESO GENERAL', M.left, y);
  y += 5;

  const pct = generalStatistics.completionPercentage;
  const barW = uw - 22;
  const barH = 5;
  const fillW = barW * (Math.min(pct, 100) / 100);

  doc.setFillColor(...C.lightGray);
  doc.roundedRect(M.left, y, barW, barH, barH / 2, barH / 2, 'F');
  if (fillW > 0) {
    doc.setFillColor(...C.black);
    doc.roundedRect(M.left, y, fillW, barH, barH / 2, barH / 2, 'F');
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.black);
  doc.text(`${pct.toFixed(1)}%${pct >= 100 ? ' Completado' : ''}`, M.left + barW + 4, y + 4);
  y += barH + 7;

  const statItems = [
    { label: 'Total Sub Actividades', value: generalStatistics.total.toString() },
    { label: 'Completadas',           value: generalStatistics.completed.toString() },
    { label: 'Pendientes',            value: generalStatistics.pending.toString() },
  ];
  const colW = uw / 3;
  statItems.forEach(({ label, value }, i) => {
    const sx = M.left + i * colW;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text(value, sx + 3, y + 5);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.black);
    doc.text(label, sx + 3, y + 10);
  });
  y += 18;

  // ── SEC 4: RESULTADOS ───────────────────────────────────────────────────────
  if (notasClean) {
    y = paginate(y, 20);
    doc.setDrawColor(...C.headerGray);
    doc.setLineWidth(0.3);
    doc.line(M.left, y, PW - M.right, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text('RESULTADOS OBTENIDOS', M.left, y);
    y += 5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.black);
    const lines = doc.splitTextToSize(notasClean, uw);
    const lineH = 4.5;
    (lines as string[]).forEach((line: string) => {
      y = paginate(y, lineH + 2);
      doc.text(line, M.left + 2, y);
      y += lineH;
    });
    y += 4;
  }

  // ── SEC 5: FUENTES DE VERIFICACIÓN ──────────────────────────────────────────
  if (fuentesEntradas.length > 0) {
    y = paginate(y, 20);
    doc.setDrawColor(...C.headerGray);
    doc.setLineWidth(0.3);
    doc.line(M.left, y, PW - M.right, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text('FUENTES DE VERIFICACIÓN', M.left, y);
    y += 5;

    fuentesEntradas.forEach(f => {
      y = paginate(y, 12);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.black);
      doc.text(`• ${f.nombre}`, M.left + 2, y);
      if (f.link) {
        y += 4.5;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.black);
        const maxLen = 100;
        const truncated = f.link.length > maxLen ? f.link.substring(0, maxLen) + '…' : f.link;
        const tw = doc.getTextWidth(truncated);
        doc.text(truncated, M.left + 6, y);
        doc.link(M.left + 6, y - 3, tw, 4, { url: f.link });
        y += 5;
      } else {
        y += 6;
      }
    });
    y += 2;
  }

  // ── SEC 6: SUB ACTIVIDADES ──────────────────────────────────────────────────
  const displaySubs = getDisplaySubtasks(subtasks);
  if (displaySubs.length > 0) {
    y = paginate(y, 20);
    doc.setDrawColor(...C.headerGray);
    doc.setLineWidth(0.3);
    doc.line(M.left, y, PW - M.right, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text(`SUB ACTIVIDADES (${displaySubs.length})`, M.left, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Nombre', 'Vencimiento', 'Lugar', 'Estado', 'Responsable']],
      body: displaySubs.map(t => [
        t.name,
        t.due_on || '-',
        getField(t, 'Lugar'),
        statusLabel(getField(t, 'Estado')),
        getField(t, 'Responsable de Actividad'),
      ]),
      theme: 'plain',
      headStyles: { fillColor: C.headerGray, textColor: C.black, fontSize: 9, fontStyle: 'bold', cellPadding: 5 },
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: C.borderGray, lineWidth: 0.2 },
      bodyStyles: { fillColor: C.white, textColor: C.black },
      columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 24 }, 2: { cellWidth: 40 }, 3: { cellWidth: 26 }, 4: { cellWidth: 36 } },
      margin: { left: M.left, right: M.right },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── SEC 7: SOLICITUDES ──────────────────────────────────────────────────────
  const solicitudes = getSolicitudes(subtasks);
  if (solicitudes.length > 0) {
    y = paginate(y, 20);
    doc.setDrawColor(...C.headerGray);
    doc.setLineWidth(0.3);
    doc.line(M.left, y, PW - M.right, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text(`SOLICITUDES (${solicitudes.length})`, M.left, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Nombre', 'Tipo', 'Fecha Solicitud', 'Estado']],
      body: solicitudes.map(t => {
        const d = extractJsonData(t.notes);
        const obs = (d?.observado as boolean) ? 'Observada' : undefined;
        return [
          t.name,
          getField(t, 'Tipo de Solicitud'),
          (d?.fechaSolicitud as string) || '-',
          obs ?? (t.completed ? 'Aprobada' : 'Pendiente'),
        ];
      }),
      theme: 'plain',
      headStyles: { fillColor: C.headerGray, textColor: C.black, fontSize: 9, fontStyle: 'bold', cellPadding: 5 },
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: C.borderGray, lineWidth: 0.2 },
      bodyStyles: { fillColor: C.white, textColor: C.black },
      margin: { left: M.left, right: M.right },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── SEC 8: CONTRATACIONES ───────────────────────────────────────────────────
  const contrataciones = getContrataciones(subtasks);
  if (contrataciones.length > 0) {
    y = paginate(y, 20);
    doc.setDrawColor(...C.headerGray);
    doc.setLineWidth(0.3);
    doc.line(M.left, y, PW - M.right, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text(`CONTRATACIONES (${contrataciones.length})`, M.left, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Nombre', 'Estado Actual', 'Descripción']],
      body: contrataciones.map(t => {
        const d = extractJsonData(t.notes) as Record<string, unknown> | null;
        return [
          t.name.replace('CPER - ', ''),
          (d?.estadoActual as string) || '-',
          (d?.descripcion as string) || '-',
        ];
      }),
      theme: 'plain',
      headStyles: { fillColor: C.headerGray, textColor: C.black, fontSize: 9, fontStyle: 'bold', cellPadding: 5 },
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: C.borderGray, lineWidth: 0.2 },
      bodyStyles: { fillColor: C.white, textColor: C.black },
      margin: { left: M.left, right: M.right },
    });
  }

  // ── FOOTER (all pages) ──────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const fy = PH - M.bottom + 2;
    doc.setDrawColor(...C.headerGray);
    doc.setLineWidth(0.3);
    doc.line(M.left, fy - 1, PW - M.right, fy - 1);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.black);
    doc.text('CDIMA — Ficha de Actividad', M.left, fy + 4);
    doc.text(`Página ${i} de ${pageCount}`, PW - M.right, fy + 4, { align: 'right' });
  }

  window.open(doc.output('bloburl'), '_blank');
};

// ══════════════════════════════════════════════════════════════════════════════
// WORD EXPORT
// ══════════════════════════════════════════════════════════════════════════════
const WC = {
  black:    '111827',
  navy:     '2E5090',
  gray:     '6B7280',
  lightGray:'E5E7EB',
  headerBg: 'EDF2FF',
  altRow:   'F9FAFB',
  green:    '16A34A',
  orange:   'EA580C',
  blue:     '0EA5E9',
  pink:     'DB2777',
  teal:     '10B981',
  white:    'FFFFFF',
};

const WB = {
  top:    { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
  left:   { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
  right:  { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
};

interface CellOpts { bold?: boolean; color?: string; bg?: string; center?: boolean; size?: number; }

const wCell = (text: string, widthPct: number, opts: CellOpts = {}): TableCell =>
  new TableCell({
    borders: WB,
    shading: { type: ShadingType.SOLID, color: opts.bg ?? WC.white, fill: opts.bg ?? WC.white },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts.bold ?? false, size: opts.size ?? 18, color: opts.color ?? WC.black, font: 'Arial' })],
      }),
    ],
  });

const wSection = (text: string): Paragraph =>
  new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: WC.navy } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: WC.navy, font: 'Arial' })],
  });

const wSep = (): Paragraph =>
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: WC.lightGray } },
    spacing: { after: 120 },
    children: [],
  });

export const exportFichaActividadToWord = ({
  task,
  subtasks,
  aggregatedValues,
  generalStatistics,
  projectName,
  fuentesEntradas = [],
}: FichaExportData): void => {
  const now = new Date();
  const dateStr = format(now, "d 'de' MMMM 'de' yyyy", { locale: es });

  const estado = getField(task, 'Estado');
  const responsable = getField(task, 'Responsable de Actividad');
  const lugar = getField(task, 'Lugar');
  const notasClean = (task.notes ?? '')
    .replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '')
    .trim();

  const children: (Paragraph | Table)[] = [];

  // ── ENCABEZADO ────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'FICHA DE ACTIVIDAD', bold: true, size: 30, color: WC.navy, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
      children: [new TextRun({ text: `Proyecto: ${projectName}`, size: 18, color: WC.gray, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 100 },
      children: [new TextRun({ text: `Generado: ${dateStr}`, size: 18, color: WC.gray, font: 'Arial' })],
    }),
    wSep()
  );

  // ── SEC 1: INFO GENERAL ───────────────────────────────────────────────────
  children.push(wSection('Información General'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [wCell('Nombre',      25, { bold: true, bg: WC.headerBg }), wCell(task.name,                   75)] }),
        new TableRow({ children: [wCell('Estado',      25, { bold: true, bg: WC.headerBg }), wCell(statusLabel(estado),         75, { bg: WC.altRow })] }),
        new TableRow({ children: [wCell('Responsable', 25, { bold: true, bg: WC.headerBg }), wCell(responsable,                  75)] }),
        new TableRow({ children: [wCell('Lugar',       25, { bold: true, bg: WC.headerBg }), wCell(lugar,                       75, { bg: WC.altRow })] }),
        new TableRow({ children: [wCell('Fecha',       25, { bold: true, bg: WC.headerBg }), wCell([task.start_on, task.due_on].filter(Boolean).join(' – ') || 'Sin fecha', 75)] }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // ── SEC 2: INDICADORES ────────────────────────────────────────────────────
  children.push(wSection('Indicadores de Impacto'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          wCell('Población Meta',       25, { bold: true, bg: WC.headerBg, center: true }),
          wCell('Total Beneficiarios',  25, { bold: true, bg: WC.headerBg, center: true }),
          wCell('Mujeres',              25, { bold: true, bg: WC.headerBg, center: true }),
          wCell('Hombres',              25, { bold: true, bg: WC.headerBg, center: true }),
        ]}),
        new TableRow({ children: [
          wCell(safeValue(aggregatedValues.poblacionMeta), 25, { center: true, bold: true, size: 26, color: '4F46E5' }),
          wCell(safeValue(aggregatedValues.total),         25, { center: true, bold: true, size: 26, color: WC.blue }),
          wCell(safeValue(aggregatedValues.mujeres),       25, { center: true, bold: true, size: 26, color: WC.pink }),
          wCell(safeValue(aggregatedValues.hombres),       25, { center: true, bold: true, size: 26, color: WC.teal }),
        ]}),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // ── SEC 3: PROGRESO ───────────────────────────────────────────────────────
  const pct = generalStatistics.completionPercentage;
  const progColor = pct >= 80 ? WC.green : pct >= 40 ? 'CA8A04' : WC.orange;
  children.push(wSection('Progreso General'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          wCell('Total Sub Actividades', 25, { bold: true, bg: WC.headerBg, center: true }),
          wCell('Completadas',           25, { bold: true, bg: WC.headerBg, center: true }),
          wCell('Pendientes',            25, { bold: true, bg: WC.headerBg, center: true }),
          wCell('Progreso',              25, { bold: true, bg: WC.headerBg, center: true }),
        ]}),
        new TableRow({ children: [
          wCell(generalStatistics.total.toString(),                 25, { center: true, bold: true, size: 26 }),
          wCell(generalStatistics.completed.toString(),             25, { center: true, bold: true, size: 26, color: WC.green }),
          wCell(generalStatistics.pending.toString(),               25, { center: true, bold: true, size: 26, color: WC.orange }),
          wCell(`${pct.toFixed(1)}%${pct >= 100 ? '(V)' : ''}`,     25, { center: true, bold: true, size: 26, color: progColor }),
        ]}),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // ── SEC 4: RESULTADOS ─────────────────────────────────────────────────────
  if (notasClean) {
    children.push(wSection('Resultados Obtenidos'));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: notasClean, size: 18, color: WC.black, font: 'Arial' })] }));
  }

  // ── SEC 5: FUENTES DE VERIFICACIÓN ───────────────────────────────────────
  if (fuentesEntradas.length > 0) {
    children.push(wSection('Fuentes de Verificación'));
    fuentesEntradas.forEach(f => {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          bullet: { level: 0 },
          children: [
            new TextRun({ text: f.nombre, bold: true, size: 18, color: WC.black, font: 'Arial' }),
            ...(f.link ? [new TextRun({ text: ` — ${f.link}`, size: 16, color: '4F46E5', font: 'Arial' })] : []),
          ],
        })
      );
    });
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  // ── SEC 6: SUB ACTIVIDADES ────────────────────────────────────────────────
  const displaySubs = getDisplaySubtasks(subtasks);
  if (displaySubs.length > 0) {
    children.push(wSection(`Sub Actividades (${displaySubs.length})`));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              wCell('Nombre',      36, { bold: true, bg: WC.headerBg }),
              wCell('Vencimiento', 14, { bold: true, bg: WC.headerBg, center: true }),
              wCell('Lugar',       20, { bold: true, bg: WC.headerBg }),
              wCell('Estado',      15, { bold: true, bg: WC.headerBg, center: true }),
              wCell('Responsable', 15, { bold: true, bg: WC.headerBg }),
            ],
          }),
          ...displaySubs.map((t, i) => {
            const bg = i % 2 ? WC.altRow : WC.white;
            const estLabel = statusLabel(getField(t, 'Estado'));
            const estColor = estLabel === 'Ejecutado' ? WC.green : estLabel === 'En Proceso' ? WC.blue : WC.orange;
            return new TableRow({ children: [
              wCell(t.name,                                   36, { bg }),
              wCell(t.due_on || '-',                          14, { bg, center: true }),
              wCell(getField(t, 'Lugar'),                     20, { bg }),
              wCell(estLabel,                                 15, { bg, center: true, bold: true, color: estColor }),
              wCell(getField(t, 'Responsable de Actividad'), 15, { bg }),
            ]});
          }),
        ],
      })
    );
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  // ── SEC 7: SOLICITUDES ────────────────────────────────────────────────────
  const solicitudes = getSolicitudes(subtasks);
  if (solicitudes.length > 0) {
    children.push(wSection(`Solicitudes (${solicitudes.length})`));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              wCell('Nombre',          40, { bold: true, bg: WC.headerBg }),
              wCell('Tipo',            25, { bold: true, bg: WC.headerBg }),
              wCell('Fecha Solicitud', 20, { bold: true, bg: WC.headerBg, center: true }),
              wCell('Estado',          15, { bold: true, bg: WC.headerBg, center: true }),
            ],
          }),
          ...solicitudes.map((t, i) => {
            const d = extractJsonData(t.notes);
            const obs = (d?.observado as boolean) ? 'Observada' : undefined;
            const estLabel = obs ?? (t.completed ? 'Aprobada' : 'Pendiente');
            const estColor = estLabel === 'Aprobada' ? WC.green : estLabel === 'Observada' ? WC.orange : WC.gray;
            const bg = i % 2 ? WC.altRow : WC.white;
            return new TableRow({ children: [
              wCell(t.name,                              40, { bg }),
              wCell(getField(t, 'Tipo de Solicitud'),   25, { bg }),
              wCell((d?.fechaSolicitud as string) || '-', 20, { bg, center: true }),
              wCell(estLabel,                            15, { bg, center: true, bold: true, color: estColor }),
            ]});
          }),
        ],
      })
    );
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  // ── SEC 8: CONTRATACIONES ─────────────────────────────────────────────────
  const contrataciones = getContrataciones(subtasks);
  if (contrataciones.length > 0) {
    children.push(wSection(`Contrataciones (${contrataciones.length})`));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              wCell('Nombre',        40, { bold: true, bg: WC.headerBg }),
              wCell('Estado Actual', 30, { bold: true, bg: WC.headerBg }),
              wCell('Descripción',   30, { bold: true, bg: WC.headerBg }),
            ],
          }),
          ...contrataciones.map((t, i) => {
            const d = extractJsonData(t.notes) as Record<string, unknown> | null;
            const bg = i % 2 ? WC.altRow : WC.white;
            return new TableRow({ children: [
              wCell(t.name.replace('CPER - ', ''),      40, { bg }),
              wCell((d?.estadoActual as string) || '-', 30, { bg }),
              wCell((d?.descripcion as string) || '-',  30, { bg }),
            ]});
          }),
        ],
      })
    );
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  // ── PIE ───────────────────────────────────────────────────────────────────
  children.push(
    wSep(),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'CDIMA — Ficha de Actividad', size: 16, color: WC.gray, font: 'Arial' })],
    })
  );

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1020, bottom: 1020, left: 1020, right: 1020 } } },
      children,
    }],
  });

  const safeName = task.name
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s0-9]/g, '')
    .trim()
    .substring(0, 50)
    .replace(/\s+/g, '_');

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ficha_Actividad_${safeName}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
};
