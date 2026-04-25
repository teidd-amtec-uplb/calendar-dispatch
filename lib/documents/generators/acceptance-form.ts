// ─────────────────────────────────────────────────────────────────────────────
// lib/documents/generators/acceptance-form.ts
// Generates the AMTEC SAL Sample Acceptance Form as DOCX
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, WidthType, AlignmentType, VerticalAlign, ShadingType,
} from "docx";

import { DocumentDispatchData, extractPersonnel } from "../types";

// ── DXA constants ─────────────────────────────────────────────────────────────
const PAGE_W    = 12240;
const PAGE_H    = 15840;
const MARGIN    = 1080;
const CONTENT_W = PAGE_W - MARGIN * 2;

const NO_BORDER   = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const NO_BORDERS  = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

function txt(text: string, opts?: { bold?: boolean; size?: number; font?: string }) {
  return new TextRun({ text, bold: opts?.bold ?? false, size: opts?.size ?? 20, font: opts?.font ?? "Arial" });
}

function cell(children: Paragraph[], width: number, opts?: {
  borders?: any; shading?: any; verticalAlign?: any; columnSpan?: number; rowSpan?: number; margins?: any;
}) {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    borders: opts?.borders ?? ALL_BORDERS,
    shading: opts?.shading,
    verticalAlign: opts?.verticalAlign ?? VerticalAlign.TOP,
    columnSpan: opts?.columnSpan,
    rowSpan: opts?.rowSpan,
    margins: opts?.margins ?? { top: 40, bottom: 40, left: 80, right: 80 },
  });
}

function hCell(text: string, width: number, opts?: { columnSpan?: number }) {
  return cell(
    [new Paragraph({ children: [txt(text, { bold: true, size: 18 })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 } })],
    width,
    { shading: { fill: "D9D9D9", type: ShadingType.CLEAR }, borders: ALL_BORDERS, columnSpan: opts?.columnSpan, verticalAlign: VerticalAlign.CENTER }
  );
}

function vCell(text: string, width: number, opts?: { columnSpan?: number; bold?: boolean }) {
  return cell(
    [new Paragraph({ children: [txt(text, { bold: opts?.bold, size: 18 })], spacing: { before: 0, after: 0 } })],
    width,
    { borders: ALL_BORDERS, columnSpan: opts?.columnSpan }
  );
}

function emptyCell(width: number, opts?: { columnSpan?: number; rowSpan?: number }) {
  return cell(
    [new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } })],
    width,
    { borders: ALL_BORDERS, columnSpan: opts?.columnSpan, rowSpan: opts?.rowSpan }
  );
}

export async function generateAcceptanceForm(dispatch: DocumentDispatchData): Promise<Buffer> {
  const personnel  = extractPersonnel(dispatch);
  const engineers  = personnel.filter(p => ["lead_engineer", "assistant_engineer"].includes(p.assignment_type));
  const initials   = engineers.map(e => e.initials).join(", ") || "—";
  const machines   = dispatch.dispatch_machines ?? [];
  const dispatchNo = dispatch.dispatch_number ?? "—";

  // Min 4 machine rows
  const MIN_ROWS = 4;
  const machineData = [...machines];
  while (machineData.length < MIN_ROWS) machineData.push({});

  // Column widths: 9 columns total
  // SAL No | TAM No + Machine | Machine name | Samples (5 sub-cols) = 9
  const C_SAL  = 1000;
  const C_TAM  = 1600;
  const C_MACH = 1800;
  // Samples section: No.Trials, MC, (blank) × 2 machines = 6 cols, but keep it simpler
  const C_S1   = 900;
  const C_S2   = 900;
  const C_S3   = 900;
  const C_S4   = 900;
  const C_S5   = CONTENT_W - C_SAL - C_TAM - C_MACH - C_S1 - C_S2 - C_S3 - C_S4;

  const machineRows: TableRow[] = [];
  machineData.forEach((m, idx) => {
    // Each machine takes 3 rows: No.Trials, MC, blank
    const rowLabel = m.machine ? `${m.tam_no ?? ""} ${m.machine ?? ""}`.trim() : "";
    machineRows.push(
      new TableRow({ children: [
        cell([new Paragraph({ children: [txt(rowLabel)], spacing: { before: 0, after: 0 } })], C_SAL, { borders: ALL_BORDERS, rowSpan: 3 }),
        cell([new Paragraph({ children: [txt(m.tam_no ?? "")], spacing: { before: 0, after: 0 } })], C_TAM, { borders: ALL_BORDERS, rowSpan: 3 }),
        cell([new Paragraph({ children: [txt(m.machine ?? "")], spacing: { before: 0, after: 0 } })], C_MACH, { borders: ALL_BORDERS, rowSpan: 3 }),
        vCell("No. of Trials", C_S1),
        emptyCell(C_S2),
        emptyCell(C_S3),
        emptyCell(C_S4),
        emptyCell(C_S5),
      ]}),
      new TableRow({ children: [
        vCell("MC", C_S1),
        emptyCell(C_S2),
        emptyCell(C_S3),
        emptyCell(C_S4),
        emptyCell(C_S5),
      ]}),
      new TableRow({ children: [
        emptyCell(C_S1),
        emptyCell(C_S2),
        emptyCell(C_S3),
        emptyCell(C_S4),
        emptyCell(C_S5),
      ]})
    );
  });

  const table = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [C_SAL, C_TAM, C_MACH, C_S1, C_S2, C_S3, C_S4, C_S5],
    rows: [
      // ── Title ──────────────────────────────────────────────────────────────
      new TableRow({ children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: "AMTEC SAL SAMPLE ACCEPTANCE FORM", bold: true, size: 28, font: "Arial", color: "FFFFFF" })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 },
          })],
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnSpan: 8,
          borders: ALL_BORDERS,
          shading: { fill: "1B2A6B", type: ShadingType.CLEAR },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
        }),
      ]}),

      // ── Section A header ─────────────────────────────────────────────────
      new TableRow({ children: [
        cell([new Paragraph({
          children: [txt("A. General Information", { bold: true, size: 20 })],
          spacing: { before: 0, after: 0 },
        })], CONTENT_W, {
          columnSpan: 8,
          shading: { fill: "E8ECF7", type: ShadingType.CLEAR },
          borders: ALL_BORDERS,
        }),
      ]}),

      // ── Dispatch No + Engineer + Control Number ───────────────────────────
      new TableRow({ children: [
        cell([
          new Paragraph({ children: [txt("Dispatch No:", { bold: true })], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt(dispatchNo)], spacing: { before: 0, after: 0 } }),
        ], C_SAL + C_TAM, { columnSpan: 2, borders: ALL_BORDERS }),
        cell([
          new Paragraph({ children: [txt("Test Engineer/s:", { bold: true })], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt(initials)], spacing: { before: 0, after: 0 } }),
        ], C_MACH + C_S1 + C_S2, { columnSpan: 3, borders: ALL_BORDERS }),
        cell([
          new Paragraph({ children: [txt("Control Number:", { bold: true })], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("SA-2026-")], spacing: { before: 0, after: 0 } }),
        ], C_S3 + C_S4 + C_S5, { columnSpan: 3, borders: ALL_BORDERS }),
      ]}),

      // ── Table header ──────────────────────────────────────────────────────
      new TableRow({ children: [
        hCell("SAL No.\n(to be filled up by SAL staff)", C_SAL),
        hCell("TAM No. / Machine Brand and Model\n(to be filled up by TE)", C_TAM),
        hCell("Machine\n(to be filled up by TE)", C_MACH),
        hCell("List of Samples\n(to be filled up by SAL staff)", C_S1 + C_S2 + C_S3 + C_S4 + C_S5, { columnSpan: 5 }),
      ]}),

      // ── Machine rows ──────────────────────────────────────────────────────
      ...machineRows,

      // ── Section B ─────────────────────────────────────────────────────────
      new TableRow({ children: [
        cell([new Paragraph({
          children: [txt("B. Remarks / Deficiency", { bold: true, size: 20 }), txt("  (to be filled up by SAL staff)", { size: 16 })],
          spacing: { before: 0, after: 0 },
        })], CONTENT_W, {
          columnSpan: 8,
          shading: { fill: "E8ECF7", type: ShadingType.CLEAR },
          borders: ALL_BORDERS,
        }),
      ]}),
      new TableRow({ children: [
        emptyCell(CONTENT_W, { columnSpan: 8 }),
      ]}),
      new TableRow({ children: [
        emptyCell(CONTENT_W, { columnSpan: 8 }),
      ]}),

      // ── Signature block ────────────────────────────────────────────────────
      new TableRow({ children: [
        cell([
          new Paragraph({ children: [txt("Issued by:", { bold: true })], spacing: { before: 0, after: 60 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("________________________________________")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Signature over Printed Name                    Date")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("SAL Staff")], spacing: { before: 0, after: 0 } }),
        ], CONTENT_W / 2, { borders: ALL_BORDERS }),
        cell([
          new Paragraph({ children: [txt("Duly signed by:", { bold: true })], spacing: { before: 0, after: 60 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("________________________________________")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Signature over Printed Name                    Date")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Test Engineer / Representative")], spacing: { before: 0, after: 0 } }),
        ], CONTENT_W / 2, { borders: ALL_BORDERS }),
      ]}),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: [table as unknown as Paragraph],
    }],
  });

  return Packer.toBuffer(doc);
}
