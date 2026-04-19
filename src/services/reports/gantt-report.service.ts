// ============================================================
// Exportación del Cronograma de Actividades a PDF / Word
// ============================================================
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, WidthType, ShadingType, BorderStyle, PageOrientation,
} from 'docx';
import { AsanaTask } from '../../types/asana.types';
import logoInicial from '../../assets/logoinicial.png';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ── helpers ───────────────────────────────────────────────────────────────────

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

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; }
};

const statusLabel = (task: AsanaTask): string => {
  const s = getField(task, 'Estado').toUpperCase();
  if (s === 'EJECUTADO') return 'Ejecutado';
  if (s === 'EN PROCESO') return 'En Proceso';
  return 'Pendiente';
};

// Colour triplets — monochromatic scheme (like Reporte Ejecutivo)
const C = {
  navy:          [60,  60,  60]  as [number, number, number],
  gray:          [120, 120, 120] as [number, number, number],
  lightGray:     [210, 210, 210] as [number, number, number],
  ultraLight:    [250, 250, 250] as [number, number, number],
  white:         [255, 255, 255] as [number, number, number],
  black:         [0,   0,   0]   as [number, number, number],
  green:         [60,  60,  60]  as [number, number, number],
  blue:          [60,  60,  60]  as [number, number, number],
  amber:         [90,  90,  90]  as [number, number, number],
  greenLight:    [175, 175, 175] as [number, number, number],
  blueLight:     [205, 205, 205] as [number, number, number],
  amberLight:    [225, 225, 225] as [number, number, number],
  mainRowBg:     [235, 235, 235] as [number, number, number],
  headerBg:      [150, 150, 150] as [number, number, number],
};

// ── Page setup (landscape letter) ────────────────────────────────────────────

const PW = 279.4; // landscape letter width
const PH = 215.9; // landscape letter height
const M  = { top: 18, bottom: 14, left: 18, right: 18 };
const UW = PW - M.left - M.right;

// ── drawHeader ────────────────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, taskName: string, projectName: string): number {
  // Logo
  try {
    doc.addImage(logoInicial, 'PNG', M.left, M.top, 26, 0);
  } catch {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text('CDIMA', M.left, M.top + 7);
  }

  // Title block (right side)
  const rx = PW - M.right;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.navy);
  doc.text('CRONOGRAMA DE ACTIVIDADES', rx, M.top + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.gray);

  const now = new Date();
  const dayFmt  = format(now, "d 'de' MMMM 'de' yyyy", { locale: es });
  doc.text(`PROYECTO: ${projectName}`, rx, M.top + 11, { align: 'right' });
  doc.text(`ACTIVIDAD: ${taskName}`, rx, M.top + 15, { align: 'right' });
  doc.text(`GENERADO: ${dayFmt}`, rx, M.top + 19, { align: 'right' });

  // Separator line
  const lineY = M.top + 23;
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.4);
  doc.line(M.left, lineY, PW - M.right, lineY);

  return lineY + 5; // cursor Y after header
}

// ── drawStatusBadge ───────────────────────────────────────────────────────────

type StatusTuple = { fill: [number,number,number]; text: [number,number,number]; label: string };
const statusStyle = (label: string): StatusTuple => {
  if (label === 'Ejecutado')  return { fill: C.greenLight, text: C.green, label };
  if (label === 'En Proceso') return { fill: C.blueLight,  text: C.blue,  label };
  return                             { fill: C.amberLight, text: C.amber, label };
};

// ── buildTableRows ────────────────────────────────────────────────────────────

interface GanttRow {
  name: string;
  estado: string;
  inicio: string;
  fin: string;
  duracion: string;
  lugar: string;
  responsable: string;
  isMain: boolean;
}

function buildRows(task: AsanaTask, ganttSubtasks: AsanaTask[]): GanttRow[] {
  const rows: GanttRow[] = [];

  const makeRow = (t: AsanaTask, isMain: boolean): GanttRow => {
    const inicio  = fmtDate(t.start_on ?? t.due_on);
    const fin     = fmtDate(t.due_on ?? t.start_on);
    let duracion  = '—';
    if (t.start_on && t.due_on) {
      try {
        const s = parseISO(t.start_on);
        const e = parseISO(t.due_on);
        const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
        duracion = `${diff} día${diff !== 1 ? 's' : ''}`;
      } catch { /* keep '—' */ }
    }
    return {
      name: t.name,
      estado: statusLabel(t),
      inicio,
      fin,
      duracion,
      lugar: getField(t, 'Lugar'),
      responsable: t.assignee?.name ?? '—',
      isMain,
    };
  };

  rows.push(makeRow(task, true));
  ganttSubtasks.forEach(t => rows.push(makeRow(t, false)));
  return rows;
}

// ── computeMonths ─────────────────────────────────────────────────────────────
// Always returns exactly 12 months starting from the task's start date.
function computeMonths(taskStart: string | null | undefined) {
  let from: Date;
  try { from = taskStart ? parseISO(taskStart) : new Date(); } catch { from = new Date(); }

  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const cur  = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const abbr = format(cur, 'MMM', { locale: es });
    const cap  = abbr.charAt(0).toUpperCase() + abbr.slice(1, 3);
    months.push({
      year:  cur.getFullYear(),
      month: cur.getMonth(),
      label: `${cap}\n${format(cur, 'yy')}`,
    });
  }
  return months;
}

// ── main export function ──────────────────────────────────────────────────────

export interface GanttExportData {
  task: AsanaTask;
  ganttSubtasks: AsanaTask[];
  projectName: string;
}

export const exportGanttToPDF = ({ task, ganttSubtasks, projectName }: GanttExportData): void => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  const cursorY  = drawHeader(doc, task.name, projectName);
  const rows     = buildRows(task, ganttSubtasks);
  const allTasks = [task, ...ganttSubtasks];
  const months   = computeMonths(task.start_on);
  const nMonths  = months.length;

  const COL_NAME   = 75;
  const COL_STATUS = 22;
  const COL_MONTH  = (UW - COL_NAME - COL_STATUS) / nMonths;

  // Raw dates per row for month-overlap check
  const rowDates = allTasks.map(t => {
    let s: Date | null = null;
    let e: Date | null = null;
    try { if (t.start_on) s = parseISO(t.start_on); } catch { /* */ }
    try { if (t.due_on)   e = parseISO(t.due_on);   } catch { /* */ }
    if (s && !e) e = s;
    if (!s && e) s = e;
    return { start: s, end: e };
  });

  // Two-row header: "Cronograma" spans all month sub-columns
  const head: any[] = [
    [
      { content: 'Actividad',   rowSpan: 2 },
      { content: 'Estado',      rowSpan: 2 },
      { content: 'Cronograma',  colSpan: nMonths },
    ],
    months.map(m => ({ content: m.label })),
  ];

  const body = rows.map(r => [r.name, r.estado, ...months.map(() => '')]);

  // Build columnStyles dynamically
  const columnStyles: Record<number, any> = {
    0: { cellWidth: COL_NAME },
    1: { cellWidth: COL_STATUS, halign: 'center' },
  };
  for (let i = 0; i < nMonths; i++) {
    columnStyles[i + 2] = { cellWidth: COL_MONTH, halign: 'center', fontSize: 6 };
  }

  autoTable(doc, {
    head,
    body,
    startY: cursorY,
    margin: { left: M.left, right: M.right },
    tableWidth: UW,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      valign: 'middle',
      textColor: C.black,
      lineColor: C.lightGray,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.headerBg,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      halign: 'center',
    },
    columnStyles,
    alternateRowStyles: { fillColor: C.ultraLight },
    didParseCell(data: any) {
      const ri = data.row.index;
      const ci = data.column.index;

      // Alternate shading on odd month header sub-columns
      if (data.section === 'head' && ci >= 2 && (ci - 2) % 2 === 1) {
        data.cell.styles.fillColor = [100, 100, 100] as [number, number, number];
      }

      // Main task row base style
      if (data.section === 'body' && rows[ri]?.isMain) {
        data.cell.styles.fillColor = C.mainRowBg;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize  = 8;
      }

      // Estado badge text color
      if (data.section === 'body' && ci === 1) {
        const st = statusStyle(rows[ri]?.estado ?? '');
        data.cell.styles.textColor = st.text;
        data.cell.styles.fontStyle = 'bold';
      }

      // Month cell: fill with status color when activity is active during that month
      if (data.section === 'body' && ci >= 2) {
        const mIdx = ci - 2;
        const m    = months[mIdx];
        const rd   = rowDates[ri];
        if (m && rd?.start && rd?.end) {
          const mStart = new Date(m.year, m.month, 1);
          const mEnd   = new Date(m.year, m.month + 1, 0); // last day of month
          if (rd.start <= mEnd && rd.end >= mStart) {
            data.cell.styles.fillColor = [173, 216, 230] as [number, number, number]; // celeste claro
          }
        }
      }
    },
    didDrawPage(data: any) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.gray);
      doc.text(`Pág. ${data.pageNumber}`, PW - M.right, PH - M.bottom + 6, { align: 'right' });
      doc.text('CDIMA — Cronograma de Actividades', M.left, PH - M.bottom + 6);
    },
  });

  // ── Open in new browser tab (no download) ─────────────────────────────────
  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

// ── exportGanttToWord ─────────────────────────────────────────────────────────

const W_COLORS = {
  black:      '000000',
  headerGray: 'C8C8C8',
  altHeader:  'B0B0B0',
  lightBlue:  'ADD8E6',  // same as PDF active cell
  white:      'FFFFFF',
  lineGray:   'C0C0C0',
};

const W_BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 2, color: W_COLORS.lineGray },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: W_COLORS.lineGray },
  left:   { style: BorderStyle.SINGLE, size: 2, color: W_COLORS.lineGray },
  right:  { style: BorderStyle.SINGLE, size: 2, color: W_COLORS.lineGray },
};

const wCell = (
  text: string,
  widthPct: number,
  opts: { bold?: boolean; center?: boolean; shade?: string; fontSize?: number } = {}
): TableCell =>
  new TableCell({
    borders: W_BORDER,
    shading: {
      type: ShadingType.SOLID,
      color: opts.shade ?? W_COLORS.white,
      fill:  opts.shade ?? W_COLORS.white,
    },
    width: { size: widthPct * 100, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.bold ?? false,
            size: opts.fontSize ?? 16,
            color: W_COLORS.black,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });

export const exportGanttToWord = ({ task, ganttSubtasks, projectName }: GanttExportData): void => {
  const months   = computeMonths(task.start_on ?? task.due_on ?? task.due_on);
  const rows     = buildRows(task, ganttSubtasks);
  const allTasks = [task, ...ganttSubtasks];

  // Row date ranges
  const rowDates = allTasks.map(t => {
    let s: Date | null = null;
    let e: Date | null = null;
    try { if (t.start_on) s = parseISO(t.start_on); } catch { /* */ }
    try { if (t.due_on)   e = parseISO(t.due_on);   } catch { /* */ }
    if (s && !e) e = s;
    if (!s && e) s = e;
    return { start: s, end: e };
  });

  // Column widths: Actividad 30%, Estado 8%, 12 months = 62% total = 5.167% each
  const COL_ACT    = 30;
  const COL_STATUS = 8;
  const COL_MONTH  = 62 / 12;

  // ── Header row 1: Actividad | Estado | Cronograma (colspan 12) ──
  const headerRow1 = new TableRow({
    tableHeader: true,
    children: [
      wCell('ACTIVIDAD',   COL_ACT,    { bold: true, shade: W_COLORS.headerGray, center: true }),
      wCell('ESTADO',      COL_STATUS, { bold: true, shade: W_COLORS.headerGray, center: true }),
      ...months.map((m, i) =>
        wCell(
          format(new Date(m.year, m.month, 1), 'MMM yy', { locale: es })
            .replace(/^(.)/, c => c.toUpperCase()),
          COL_MONTH,
          { bold: true, shade: i % 2 === 0 ? W_COLORS.headerGray : W_COLORS.altHeader, center: true, fontSize: 14 },
        )
      ),
    ],
  });

  // ── Body rows ──
  const bodyRows = rows.map((row, ri) => {
    const rd      = rowDates[ri];
    const isMain  = row.isMain;
    const rowBg   = isMain ? 'E8E8E8' : W_COLORS.white;

    const monthCells = months.map(m => {
      const mStart = new Date(m.year, m.month, 1);
      const mEnd   = new Date(m.year, m.month + 1, 0);
      const active = rd?.start && rd?.end && rd.start <= mEnd && rd.end >= mStart;
      return wCell('', COL_MONTH, { shade: active ? W_COLORS.lightBlue : rowBg, center: true });
    });

    return new TableRow({
      children: [
        wCell(row.name,   COL_ACT,    { bold: isMain, shade: rowBg }),
        wCell(row.estado, COL_STATUS, { shade: rowBg, center: true }),
        ...monthCells,
      ],
    });
  });

  // ── Document ──
  const now      = new Date();
  const dayFmt   = format(now, "d 'de' MMMM 'de' yyyy", { locale: es });

  const mkPara = (text: string, opts: { bold?: boolean; size?: number; right?: boolean } = {}) =>
    new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({ text, bold: opts.bold ?? false, size: opts.size ?? 18, color: W_COLORS.black, font: 'Arial' }),
      ],
    });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE, width: 15840, height: 12240 },
          margin: { top: 1020, bottom: 1020, left: 1020, right: 1020 },
        },
      },
      children: [
        mkPara('CRONOGRAMA DE ACTIVIDADES', { bold: true, size: 28, right: true }),
        mkPara(`PROYECTO: ${projectName}`,  { size: 18, right: true }),
        mkPara(`ACTIVIDAD: ${task.name}`,   { size: 18, right: true }),
        mkPara(`GENERADO: ${dayFmt}`,       { size: 18, right: true }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow1, ...bodyRows],
        }),
        new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'CDIMA — Cronograma de Actividades', size: 14, color: W_COLORS.black, font: 'Arial' })] }),
      ],
    }],
  });

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url;
    a.download = `Cronograma_${task.name.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
};
