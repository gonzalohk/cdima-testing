/**
 * Genera MANUAL_USUARIO_ADMINISTRADOR.docx
 * Ejecutar: node generate-manual.mjs
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  UnderlineType, PageBreak,
} from 'docx';
import { readFileSync, writeFileSync } from 'fs';

// ─────────────────────────── ESTILOS ────────────────────────────

const C = {
  accent:    '1F4E79',   // azul oscuro — títulos principales
  accent2:   '2E74B5',   // azul medio — subtítulos h2
  accent3:   '5B9BD5',   // azul claro  — subtítulos h3
  headerBg:  'D6E4F7',   // azul muy claro — encabezados de tabla
  altRow:    'F2F7FC',   // fila alterna
  noteBg:    'FFF9E6',   // fondo nota/blockquote
  noteBorder:'F0C040',   // borde nota
  codeBg:    'F5F5F5',   // fondo código
  black:     '000000',
  gray:      '595959',
  lightGray: 'BFBFBF',
  white:     'FFFFFF',
};

const BORDER = (color = C.lightGray, size = 4) => ({
  top:    { style: BorderStyle.SINGLE, size, color },
  bottom: { style: BorderStyle.SINGLE, size, color },
  left:   { style: BorderStyle.SINGLE, size, color },
  right:  { style: BorderStyle.SINGLE, size, color },
});

const NO_BORDER = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

// ─────────────────────────── HELPERS ────────────────────────────

/** Convierte texto con **bold** e `inline-code` a TextRun[] */
function parseInline(text) {
  const runs = [];
  const re = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index) }));
    if (m[2]) runs.push(new TextRun({ text: m[2], bold: true }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], font: 'Courier New', size: 18, shading: { fill: C.codeBg } }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last) }));
  if (runs.length === 0) runs.push(new TextRun({ text }));
  return runs;
}

function p(text, opts = {}) {
  return new Paragraph({
    children: parseInline(text),
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
    ...opts,
  });
}

function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, color: C.accent, size: 52, bold: true })],
    spacing: { after: 240, before: 480 },
    alignment: AlignmentType.CENTER,
  });
}

function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, color: C.accent, size: 34, bold: true })],
    heading: HeadingLevel.HEADING_2,
    spacing: { after: 160, before: 400 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent },
    },
  });
}

function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, color: C.accent2, size: 26, bold: true })],
    heading: HeadingLevel.HEADING_3,
    spacing: { after: 120, before: 280 },
  });
}

function h4(text) {
  return new Paragraph({
    children: [new TextRun({ text, color: C.accent3, size: 22, bold: true, underline: { type: UnderlineType.SINGLE } })],
    spacing: { after: 100, before: 200 },
  });
}

function hr() {
  return new Paragraph({
    children: [new TextRun({ text: '' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.lightGray } },
    spacing: { after: 200, before: 200 },
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: parseInline(text),
    bullet: { level },
    spacing: { after: 80 },
  });
}

function numbered(text, num) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${num}. `, bold: true }),
      ...parseInline(text),
    ],
    spacing: { after: 80 },
    indent: { left: 360 },
  });
}

function note(text) {
  // Elimina el prefijo "> " o ">" del blockquote
  const clean = text.replace(/^>\s*(\*\*\[.*?\]\*\*\s*)?/, '').replace(/^\*\*\[.*?\]\*\*\s*/, '');
  return new Paragraph({
    children: [
      new TextRun({ text: '📌 ', size: 20 }),
      ...parseInline(clean),
    ],
    shading: { type: ShadingType.CLEAR, fill: C.noteBg },
    border: {
      left: { style: BorderStyle.THICK, size: 12, color: C.noteBorder },
    },
    indent: { left: 240, right: 240 },
    spacing: { after: 120, before: 80 },
  });
}

function imageSlot(text) {
  // Extrae el texto entre [INSERTAR CAPTURA: ...] 
  const m = text.match(/\[INSERTAR CAPTURA:\s*(.*?)\]/);
  const caption = m ? m[1] : text;
  return new Paragraph({
    children: [new TextRun({ text: `📷  [INSERTAR CAPTURA: ${caption}]`, italics: true, color: C.gray, size: 18 })],
    shading: { type: ShadingType.CLEAR, fill: C.codeBg },
    border: {
      top:    { style: BorderStyle.DASHED, size: 4, color: C.lightGray },
      bottom: { style: BorderStyle.DASHED, size: 4, color: C.lightGray },
      left:   { style: BorderStyle.DASHED, size: 4, color: C.lightGray },
      right:  { style: BorderStyle.DASHED, size: 4, color: C.lightGray },
    },
    indent: { left: 240, right: 240 },
    spacing: { after: 120, before: 80 },
    alignment: AlignmentType.CENTER,
  });
}

function codeBlock(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Courier New', size: 18 })],
    shading: { type: ShadingType.CLEAR, fill: C.codeBg },
    indent: { left: 360, right: 360 },
    spacing: { after: 120, before: 80 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 8, color: C.lightGray },
    },
  });
}

function buildTable(headerCells, rows) {
  const colCount = headerCells.length;
  const pct = Math.floor(10000 / colCount);

  const makeCell = (text, isHeader = false) => new TableCell({
    children: [new Paragraph({
      children: parseInline(text.trim()),
      spacing: { after: 60, before: 60 },
      alignment: AlignmentType.LEFT,
    })],
    shading: isHeader ? { type: ShadingType.CLEAR, fill: C.headerBg } : undefined,
    width: { size: pct, type: WidthType.PERCENTAGE },
    borders: BORDER(),
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });

  const headerRow = new TableRow({
    children: headerCells.map(c => makeCell(c, true)),
    tableHeader: true,
  });

  const dataRows = rows.map((row, i) => new TableRow({
    children: row.map(c => {
      const cell = makeCell(c, false);
      if (i % 2 === 1) {
        // alt row tinting  
      }
      return cell;
    }),
  }));

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ─────────────────────────── PARSER ──────────────────────────────

function parseMarkdown(md) {
  const elements = [];
  const lines = md.split('\n');
  let i = 0;

  const peek = (offset = 1) => lines[i + offset] ?? '';

  while (i < lines.length) {
    const line = lines[i];

    // ── Línea vacía
    if (line.trim() === '') { i++; continue; }

    // ── Separador horizontal
    if (/^---+$/.test(line.trim())) {
      elements.push(hr());
      i++;
      continue;
    }

    // ── H1
    if (/^# /.test(line)) {
      elements.push(h1(line.replace(/^# /, '')));
      i++;
      continue;
    }

    // ── H2
    if (/^## /.test(line)) {
      elements.push(h2(line.replace(/^## /, '')));
      i++;
      continue;
    }

    // ── H3
    if (/^### /.test(line)) {
      elements.push(h3(line.replace(/^### /, '')));
      i++;
      continue;
    }

    // ── H4
    if (/^#### /.test(line)) {
      elements.push(h4(line.replace(/^#### /, '')));
      i++;
      continue;
    }

    // ── Blockquote (nota o INSERTAR CAPTURA)
    if (/^> /.test(line) || line.trim() === '>') {
      const raw = line.replace(/^> ?/, '');
      if (raw.includes('[INSERTAR CAPTURA')) {
        elements.push(imageSlot(raw));
      } else if (raw.trim() === '') {
        // blockquote vacío — ignorar
      } else {
        elements.push(note(raw));
      }
      i++;
      continue;
    }

    // ── Bloque de código (triple backtick)
    if (/^```/.test(line)) {
      i++;
      const codeLines = [];
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // cerrar ```
      elements.push(codeBlock(codeLines.join('\n')));
      continue;
    }

    // ── Tabla markdown
    if (/^\|/.test(line)) {
      const tableLines = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      // headerRow = tableLines[0], separador = tableLines[1], data desde [2]
      const parseRow = (r) => r.split('|').slice(1, -1).map(c => c.trim());
      const headers = parseRow(tableLines[0]);
      const dataRows = tableLines.slice(2).map(parseRow);
      elements.push(buildTable(headers, dataRows));
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 120 } }));
      continue;
    }

    // ── Lista numerada
    if (/^\d+\. /.test(line)) {
      const m = line.match(/^(\d+)\. (.*)/);
      if (m) elements.push(numbered(m[2], m[1]));
      i++;
      continue;
    }

    // ── Lista con guion / asterisco
    if (/^[-*] /.test(line)) {
      elements.push(bullet(line.replace(/^[-*] /, ''), 0));
      i++;
      continue;
    }

    // ── Lista con guion doble espacio (sub-bullet)
    if (/^  [-*] /.test(line)) {
      elements.push(bullet(line.replace(/^  [-*] /, ''), 1));
      i++;
      continue;
    }

    // ── Itálica de cierre de doc
    if (/^\*[^*]/.test(line) && line.trim().endsWith('*')) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^\*|\*$/g, ''), italics: true, color: C.gray })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }));
      i++;
      continue;
    }

    // ── Párrafo normal
    elements.push(p(line));
    i++;
  }

  return elements;
}

// ─────────────────────────── PORTADA ─────────────────────────────

function buildCoverPage() {
  return [
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 1600 } }),
    new Paragraph({
      children: [new TextRun({ text: 'MANUAL DE USUARIO', color: C.accent, size: 72, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Rol Administrador', color: C.accent2, size: 48, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Sistema CDIMA Amuyt\'a', color: C.gray, size: 36, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
    }),
    buildTable(
      ['Campo', 'Valor'],
      [
        ['Versión', '1.0'],
        ['Fecha', 'Abril 2026'],
        ['Rol', 'Administrador'],
        ['Sistema', 'CDIMA Amuyt\'a'],
      ]
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─────────────────────────── MAIN ────────────────────────────────

const md = readFileSync('./MANUAL_USUARIO_ADMINISTRADOR.md', 'utf8');

// Quitar la primera línea del título y la de sistema (ya van en portada)
// y el bloque de metadatos
const mdBody = md.replace(/^# Manual.*\n## Sistema.*\n\n\*\*Versión.*\n\*\*Fecha.*\n\*\*Dirigido.*\n\n---\n/, '');

const bodyElements = parseMarkdown(mdBody);

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22, color: C.black },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: [
        ...buildCoverPage(),
        ...bodyElements,
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync('./MANUAL_USUARIO_ADMINISTRADOR.docx', buffer);
console.log('✅ MANUAL_USUARIO_ADMINISTRADOR.docx generado correctamente');
