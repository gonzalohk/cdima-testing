declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';
  
  export interface RowInput {
    [key: string]: string | number;
  }

  export interface CellDef {
    content?: string;
    colSpan?: number;
    rowSpan?: number;
    styles?: Partial<Styles>;
  }

  export interface Styles {
    font?: string;
    fontStyle?: string;
    overflow?: 'linebreak' | 'ellipsize' | 'visible' | 'hidden';
    fillColor?: number | number[] | string;
    textColor?: number | number[] | string;
    halign?: 'left' | 'center' | 'right' | 'justify';
    valign?: 'top' | 'middle' | 'bottom';
    fontSize?: number;
    cellPadding?: number | { top?: number; right?: number; bottom?: number; left?: number };
    lineColor?: number | number[] | string;
    lineWidth?: number | { top?: number; right?: number; bottom?: number; left?: number };
    cellWidth?: number | 'auto' | 'wrap';
  }

  export interface Config {
    head?: (string | CellDef)[][];
    body?: (string | CellDef)[][];
    foot?: (string | CellDef)[][];
    startY?: number;
    margin?: number | { top?: number; right?: number; bottom?: number; left?: number; horizontal?: number; vertical?: number };
    pageBreak?: 'auto' | 'avoid' | 'always';
    tableWidth?: 'auto' | 'wrap' | number;
    showHead?: 'everyPage' | 'firstPage' | 'never';
    showFoot?: 'everyPage' | 'lastPage' | 'never';
    theme?: 'striped' | 'grid' | 'plain';
    styles?: Partial<Styles>;
    headStyles?: Partial<Styles>;
    bodyStyles?: Partial<Styles>;
    footStyles?: Partial<Styles>;
    alternateRowStyles?: Partial<Styles>;
    columnStyles?: { [key: string]: Partial<Styles> };
  }

  export default function autoTable(doc: jsPDF, config: Config): void;
}
