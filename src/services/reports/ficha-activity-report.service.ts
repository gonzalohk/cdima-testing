// ============================================================
// Exportación de la Ficha de Actividad a PDF y Word
// ============================================================
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
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
  seccion?: string;
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
  return 'En Proceso';
};

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
  seccion,
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
  if (seccion) {
    doc.text(`Sección: ${seccion}`, PW - M.right, M.top + 17, { align: 'right' });
    doc.text(`Generado: ${dateStr}`, PW - M.right, M.top + 22, { align: 'right' });
  } else {
    doc.text(`Generado: ${dateStr}`, PW - M.right, M.top + 17, { align: 'right' });
  }

  let y = seccion ? M.top + 27 : M.top + 22;
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

  y = (doc as any).lastAutoTable.finalY + 14;

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

  y += boxH + 14;

  // ── SEC 3: PROGRESO ─────────────────────────────────────────────────────────
  y = paginate(y, 28);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.black);
  doc.text('PROGRESO GENERAL', M.left, y);
  y += 5;

  const pct = generalStatistics.completionPercentage;
  const progBoxW = (uw - 6) / 4;
  const progBoxH = 18;
  const progItems = [
    { label: 'Total Sub Actividades', value: generalStatistics.total.toString() },
    { label: 'Ejecutadas',           value: generalStatistics.completed.toString() },
    { label: 'En Proceso',            value: generalStatistics.pending.toString() },
    { label: 'Progreso',              value: `${pct.toFixed(1)}%` },
  ];

  progItems.forEach(({ label, value }, i) => {
    const bx = M.left + i * (progBoxW + 2);
    doc.setFillColor(...C.lightGray);
    doc.roundedRect(bx, y, progBoxW, progBoxH, 2, 2, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text(value, bx + progBoxW / 2, y + 9, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.black);
    const labelLines = doc.splitTextToSize(label, progBoxW - 6);
    doc.text(labelLines, bx + progBoxW / 2, y + 14, { align: 'center' });
  });

  y += progBoxH + 14;

  // ── SEC 4: RESULTADOS ───────────────────────────────────────────────────────
  if (notasClean) {
    y = paginate(y, 20);

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

  // ── SEC 7: SOLICITUDES ──────────────────────────────────────────────────────
  const solicitudes = getSolicitudes(subtasks);
  if (solicitudes.length > 0) {
    y = paginate(y, 20);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text(`SOLICITUDES`, M.left, y);
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
          obs ?? (t.completed ? 'Aprobada' : 'En Proceso'),
        ];
      }),
      theme: 'plain',
      headStyles: { fillColor: C.headerGray, textColor: C.black, fontSize: 9, fontStyle: 'bold', cellPadding: 5 },
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: C.borderGray, lineWidth: 0.2 },
      bodyStyles: { fillColor: C.white, textColor: C.black },
      columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 46 }, 2: { cellWidth: 30 }, 3: { cellWidth: 25 } },
      margin: { left: M.left, right: M.right },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── SEC 8: CONTRATACIONES ───────────────────────────────────────────────────
  const contrataciones = getContrataciones(subtasks);
  if (contrataciones.length > 0) {
    y = paginate(y, 20);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.black);
    doc.text(`CONTRATACIONES`, M.left, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Nombre', 'Estado Actual', 'Fecha Estado', 'Descripción']],
      body: contrataciones.map(t => {
        const d = extractJsonData(t.notes) as Record<string, unknown> | null;
        const historial = (d?.historialEstados as { fecha: string; estado: string }[] | undefined) ?? [];
        const fechaEstado = historial.length > 0 ? historial[historial.length - 1].fecha : '-';
        return [
          t.name.replace('CPER - ', ''),
          (d?.estadoActual as string) || '-',
          fechaEstado,
          (d?.descripcion as string) || '-',
        ];
      }),
      theme: 'plain',
      headStyles: { fillColor: C.headerGray, textColor: C.black, fontSize: 9, fontStyle: 'bold', cellPadding: 5 },
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: C.borderGray, lineWidth: 0.2 },
      bodyStyles: { fillColor: C.white, textColor: C.black },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 46 }, 2: { cellWidth: 30 }, 3: { cellWidth: 45 } },
      margin: { left: M.left, right: M.right },
    });
  }

  

  window.open(doc.output('bloburl'), '_blank');
};

// ══════════════════════════════════════════════════════════════════════════════
// WORD EXPORT
// ══════════════════════════════════════════════════════════════════════════════
const WC = {
  black:      '000000',
  white:      'FFFFFF',
  lightGray:  'F5F5F5',
  headerGray: 'DCDCDC',
  borderGray: 'B4B4B4',
  textGray:   '555555',
};

const WB = {
  top:    { style: BorderStyle.SINGLE, size: 2, color: 'B4B4B4' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'B4B4B4' },
  left:   { style: BorderStyle.SINGLE, size: 2, color: 'B4B4B4' },
  right:  { style: BorderStyle.SINGLE, size: 2, color: 'B4B4B4' },
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
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: WC.headerGray } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: WC.black, font: 'Arial' })],
  });

const wSep = (): Paragraph =>
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: WC.headerGray } },
    spacing: { after: 120 },
    children: [],
  });

export const exportFichaActividadToWord = async ({
  task,
  subtasks,
  aggregatedValues,
  generalStatistics,
  projectName,
  seccion,
  fuentesEntradas = [],
}: FichaExportData): Promise<void> => {
  const now = new Date();
  const dateStr = format(now, "d 'de' MMMM 'de' yyyy", { locale: es });
  const pct = generalStatistics.completionPercentage;
  const estado = getField(task, 'Estado');
  const responsable = getField(task, 'Responsable de Actividad');
  const lugar = getField(task, 'Lugar');
  const notasClean = (task.notes ?? '')
    .replace(/\n*===DATOS_JSON===\s*[\s\S]*?===FIN_DATOS_JSON===/g, '')
    .trim();

  // ── Logo ──────────────────────────────────────────────────────────────────
  let logoRun: ImageRun | null = null;
  try {
    const resp = await fetch(logoInicial);
    const buf = await resp.arrayBuffer();
    const tmpBlob = new Blob([buf], { type: 'image/png' });
    const objUrl = URL.createObjectURL(tmpBlob);
    const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
      const img = new Image();
      img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(objUrl); };
      img.onerror = rej;
      img.src = objUrl;
    });
    const targetW = 106;
    const targetH = Math.round(targetW * dims.h / dims.w);
    logoRun = new ImageRun({ data: buf, transformation: { width: targetW, height: targetH }, type: 'png' });
  } catch { /* no logo */ }

  const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const children: (Paragraph | Table)[] = [];

  // ── ENCABEZADO ────────────────────────────────────────────────────────────
  const metaLines: string[] = [
    `Proyecto: ${projectName}`,
    ...(seccion ? [`Sección: ${seccion}`] : []),
    `Generado: ${dateStr}`,
  ];
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: NB, bottom: NB, left: NB, right: NB },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: { top: NB, bottom: NB, left: NB, right: NB },
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: logoRun
                ? [new Paragraph({ children: [logoRun] })]
                : [new Paragraph({ children: [new TextRun({ text: 'CDIMA', bold: true, size: 24, color: WC.black, font: 'Arial' })] })],
            }),
            new TableCell({
              borders: { top: NB, bottom: NB, left: NB, right: NB },
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 60 },
                  children: [new TextRun({ text: 'FICHA DE ACTIVIDAD', bold: true, size: 28, color: WC.black, font: 'Arial' })],
                }),
                ...metaLines.map(line => new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 40 },
                  children: [new TextRun({ text: line, size: 18, color: WC.textGray, font: 'Arial' })],
                })),
              ],
            }),
          ],
        }),
      ],
    }),
    wSep()
  );

  // ── SEC 1: INFO GENERAL ───────────────────────────────────────────────────
  children.push(wSection('Información General'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [wCell('Nombre',      25, { bold: true, bg: WC.headerGray }), wCell(task.name, 75)] }),
        new TableRow({ children: [wCell('Estado',      25, { bold: true, bg: WC.headerGray }), wCell(statusLabel(estado), 75, { bg: WC.lightGray })] }),
        new TableRow({ children: [wCell('Responsable', 25, { bold: true, bg: WC.headerGray }), wCell(responsable, 75)] }),
        new TableRow({ children: [wCell('Lugar',       25, { bold: true, bg: WC.headerGray }), wCell(lugar, 75, { bg: WC.lightGray })] }),
        new TableRow({ children: [wCell('Fecha',       25, { bold: true, bg: WC.headerGray }), wCell([task.start_on, task.due_on].filter(Boolean).join(' – ') || 'Sin fecha', 75)] }),
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
          wCell('Población Meta',       25, { bold: true, bg: WC.headerGray, center: true }),
          wCell('Total Beneficiarios',  25, { bold: true, bg: WC.headerGray, center: true }),
          wCell('Mujeres',              25, { bold: true, bg: WC.headerGray, center: true }),
          wCell('Hombres',              25, { bold: true, bg: WC.headerGray, center: true }),
        ]}),
        new TableRow({ children: [
          wCell(safeValue(aggregatedValues.poblacionMeta), 25, { center: true, bold: true, size: 26 }),
          wCell(safeValue(aggregatedValues.total),         25, { center: true, bold: true, size: 26 }),
          wCell(safeValue(aggregatedValues.mujeres),       25, { center: true, bold: true, size: 26 }),
          wCell(safeValue(aggregatedValues.hombres),       25, { center: true, bold: true, size: 26 }),
        ]}),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // ── SEC 3: PROGRESO ───────────────────────────────────────────────────────
  children.push(wSection('Progreso General'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          wCell('Total Sub Actividades', 25, { bold: true, bg: WC.headerGray, center: true }),
          wCell('Ejecutadas',           25, { bold: true, bg: WC.headerGray, center: true }),
          wCell('En Proceso',            25, { bold: true, bg: WC.headerGray, center: true }),
          wCell('Progreso',              25, { bold: true, bg: WC.headerGray, center: true }),
        ]}),
        new TableRow({ children: [
          wCell(generalStatistics.total.toString(),     25, { center: true, bold: true, size: 26 }),
          wCell(generalStatistics.completed.toString(), 25, { center: true, bold: true, size: 26 }),
          wCell(generalStatistics.pending.toString(),   25, { center: true, bold: true, size: 26 }),
          wCell(`${pct.toFixed(1)}%`,                   25, { center: true, bold: true, size: 26 }),
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
            ...(f.link ? [new TextRun({ text: ` — ${f.link}`, size: 16, color: WC.textGray, font: 'Arial' })] : []),
          ],
        })
      );
    });
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  // ── SEC 7: SOLICITUDES ────────────────────────────────────────────────────
  const solicitudes = getSolicitudes(subtasks);
  if (solicitudes.length > 0) {
    children.push(wSection(`Solicitudes`));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              wCell('Nombre',          40, { bold: true, bg: WC.headerGray }),
              wCell('Tipo',            25, { bold: true, bg: WC.headerGray }),
              wCell('Fecha Solicitud', 20, { bold: true, bg: WC.headerGray, center: true }),
              wCell('Estado',          15, { bold: true, bg: WC.headerGray, center: true }),
            ],
          }),
          ...solicitudes.map((t, i) => {
            const d = extractJsonData(t.notes);
            const obs = (d?.observado as boolean) ? 'Observada' : undefined;
            const estLabel = obs ?? (t.completed ? 'Aprobada' : 'En Proceso');
            const bg = i % 2 ? WC.lightGray : WC.white;
            return new TableRow({ children: [
              wCell(t.name,                               40, { bg }),
              wCell(getField(t, 'Tipo de Solicitud'),    25, { bg }),
              wCell((d?.fechaSolicitud as string) || '-', 20, { bg, center: true }),
              wCell(estLabel,                             15, { bg, center: true, bold: true }),
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
    children.push(wSection(`Contrataciones`));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              wCell('Nombre',        35, { bold: true, bg: WC.headerGray }),
              wCell('Estado Actual', 25, { bold: true, bg: WC.headerGray }),
              wCell('Fecha Estado',  20, { bold: true, bg: WC.headerGray, center: true }),
              wCell('Descripción',   20, { bold: true, bg: WC.headerGray }),
            ],
          }),
          ...contrataciones.map((t, i) => {
            const d = extractJsonData(t.notes) as Record<string, unknown> | null;
            const historial = (d?.historialEstados as { fecha: string; estado: string }[] | undefined) ?? [];
            const fechaEstado = historial.length > 0 ? historial[historial.length - 1].fecha : '-';
            const bg = i % 2 ? WC.lightGray : WC.white;
            return new TableRow({ children: [
              wCell(t.name.replace('CPER - ', ''),      35, { bg }),
              wCell((d?.estadoActual as string) || '-', 25, { bg }),
              wCell(fechaEstado,                        20, { bg, center: true }),
              wCell((d?.descripcion as string) || '-',  20, { bg }),
            ]});
          }),
        ],
      })
    );
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  // ── PIE ───────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: WC.headerGray } },
      spacing: { before: 120 },
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'CDIMA — Ficha de Actividad', size: 16, color: WC.textGray, font: 'Arial' })],
    })
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      children,
    }],
  });

  const safeName = task.name
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s0-9]/g, '')
    .trim()
    .substring(0, 50)
    .replace(/\s+/g, '_');

  const docBlob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(docBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ficha_Actividad_${safeName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
};
