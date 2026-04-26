const fs = require("fs");

const newCode = `// -----------------------------------------------------------------------------
// lib/documents/generators/acceptance-form.ts
// Generates the AMTEC SAL Sample Acceptance Form as DOCX
// -----------------------------------------------------------------------------

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, WidthType, AlignmentType, VerticalAlign, ShadingType, TableLayoutType,
} from "docx";

import { DocumentDispatchData, extractPersonnel } from "../types";

// -- DXA constants -------------------------------------------------------------
const PAGE_W    = 15840; // 11 in (Letter Landscape)
const PAGE_H    = 12240; // 8.5 in 
const MARGIN    = 720;
const CONTENT_W = PAGE_W - MARGIN * 2; // 14400 DXA

const NO_BORDER   = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

const B_B_NONE = { ...ALL_BORDERS, bottom: NO_BORDER };
const B_T_NONE = { ...ALL_BORDERS, top: NO_BORDER };

const BLUE_FILL = { fill: "1B2A6B", type: ShadingType.CLEAR };

function txt(text: string, opts?: { bold?: boolean; size?: number; font?: string; color?: string; underline?: boolean }) {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    size: opts?.size ?? 18, // 9pt
    font: opts?.font ?? "Arial",
    color: opts?.color ?? "000000",
    underline: opts?.underline ? {} : undefined,
  });
}

function p(text: string | TextRun[], opts?: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; color?: string; size?: number; before?: number; after?: number }) {
  let runs: TextRun[];
  if (typeof text === "string") {
    runs = text.split("\\n").flatMap((line, i, arr) => 
      i === arr.length - 1 ? [txt(line, opts)] : [txt(line, opts), new TextRun({ break: 1 })]
    );
  } else {
    runs = text;
  }
  return new Paragraph({
    children: runs,
    alignment: opts?.align ?? AlignmentType.LEFT,
    spacing: { before: opts?.before ?? 0, after: opts?.after ?? 0 },
  });
}

function cell(
  children: Paragraph[],
  units: number, // 1 to 60
  opts?: {
    borders?: any;
    shading?: any;
    verticalAlign?: any;
    margins?: any;
  }
) {
  return new TableCell({
    children,
    borders: opts?.borders ?? ALL_BORDERS,
    shading: opts?.shading,
    verticalAlign: opts?.verticalAlign ?? VerticalAlign.CENTER,
    columnSpan: units,
    margins: opts?.margins ?? { top: 30, bottom: 30, left: 60, right: 60 },
  });
}

function headerCell(text: string, units: number, opts?: { borders?: any }) {
  return cell([p(text, { bold: true, align: AlignmentType.CENTER })], units, { borders: opts?.borders });
}

function valueCell(text: string, units: number, opts?: { borders?: any }) {
  return cell([p(text)], units, { borders: opts?.borders });
}

export async function generateAcceptanceForm(dispatch: DocumentDispatchData): Promise<Buffer> {
  const personnel  = extractPersonnel(dispatch);
  const engineers  = personnel.filter(p => ["lead_engineer", "assistant_engineer"].includes(p.assignment_type));
  const initials   = engineers.map(e => e.initials).join(", ") || "—";
  const machines   = dispatch.dispatch_machines ?? [];
  const dispatchNo = dispatch.dispatch_number ?? "—";

  const rows: TableRow[] = [];

  // Row 1: Title
  rows.push(new TableRow({ children: [
    cell([p("AMTEC SAL SAMPLE ACCEPTANCE FORM", { bold: true, size: 24, color: "FFFFFF", align: AlignmentType.CENTER, before: 60, after: 60 })], 60, { shading: BLUE_FILL })
  ]}));

  // Row 2: General Info
  rows.push(new TableRow({ children: [
    cell([p("A. General Information", { bold: true, size: 20, color: "FFFFFF", before: 20, after: 20 })], 60, { shading: BLUE_FILL })
  ]}));

  // Row 3: Dispatch No, Test Engineers, Control Number
  rows.push(new TableRow({ children: [
    cell([
      new Paragraph({
        children: [txt("Dispatch No:     ", { bold: true }), txt(dispatchNo)],
        spacing: { before: 20, after: 20 }
      })
    ], 20),
    cell([
      new Paragraph({
        children: [txt("Test Engineer/s:     ", { bold: true }), txt(initials, { underline: true })],
        spacing: { before: 20, after: 20 }
      })
    ], 20),
    cell([
      new Paragraph({
        children: [txt("Control Number:     ", { bold: true }), txt("SA-2026-", { underline: true })],
        spacing: { before: 20, after: 20 }
      })
    ], 20)
  ]}));

  // Row 4: Table Header
  rows.push(new TableRow({ children: [
    headerCell("SAL No.\\n(to be filled up by SAL staff)", 8),
    headerCell("TAM No./ Machine Brand and Model\\n(to be filled up by TE)", 14),
    headerCell("Machine\\n(to be filled up by TE)", 14),
    headerCell("List of Samples\\n(to be filled up by SAL staff)", 24)
  ]}));

  // Min 6 machine rows (using faked row spans)
  const MIN_ROWS = 6;
  const machineData = [...machines];
  while (machineData.length < MIN_ROWS) machineData.push({} as any);

  machineData.forEach((m) => {
    const brandModel = [m.tam_no, m.brand, m.model].filter(Boolean).join(" ");
    const machine = m.machine ?? "";

    // Sub-row A (No. of Trials)
    rows.push(new TableRow({ children: [
      valueCell("", 8, { borders: B_B_NONE }),
      cell([p(brandModel, { align: AlignmentType.CENTER })], 14, { borders: B_B_NONE }),
      cell([p(machine, { align: AlignmentType.CENTER })], 14, { borders: B_B_NONE }),
      valueCell("? No. of Trials", 8),
      valueCell("?", 8),
      valueCell("?", 8)
    ]}));

    // Sub-row B (MC)
    rows.push(new TableRow({ children: [
      valueCell("", 8, { borders: B_T_NONE }),
      valueCell("", 14, { borders: B_T_NONE }),
      valueCell("", 14, { borders: B_T_NONE }),
      valueCell("? MC", 8),
      valueCell("?", 8),
      valueCell("?", 8)
    ]}));
  });

  // Remarks Header
  rows.push(new TableRow({ children: [
    cell([
      new Paragraph({ children: [txt("B. Remarks/Deficiency ", { bold: true, size: 20, color: "FFFFFF" }), txt("(to be filled up by SAL staff)", { size: 16, color: "FFFFFF", font: "Arial", italic: true })], spacing: { before: 20, after: 20 } })
    ], 60, { shading: BLUE_FILL })
  ]}));

  // Remarks Box
  rows.push(new TableRow({ children: [
    cell([p("", { before: 800 })], 60)
  ]}));

  // Signatures
  rows.push(new TableRow({ children: [
    cell([
      p("Issued by:", { bold: true, before: 20 }),
      p("_________________________________                ____________________", { align: AlignmentType.CENTER, before: 600 }),
      p("       Signature over Printed Name                                      Date             ", { size: 14, align: AlignmentType.CENTER }),
      p("SAL Staff", { bold: true, align: AlignmentType.CENTER, before: 60, after: 20 })
    ], 30, { verticalAlign: VerticalAlign.TOP }),
    cell([
      p("Duly signed by:", { bold: true, before: 20 }),
      p("_________________________________                ____________________", { align: AlignmentType.CENTER, before: 600 }),
      p("       Signature over Printed Name                                      Date             ", { size: 14, align: AlignmentType.CENTER }),
      p("Test Engineer / Representative", { bold: true, align: AlignmentType.CENTER, before: 60, after: 20 })
    ], 30, { verticalAlign: VerticalAlign.TOP })
  ]}));

  const table = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: Array(60).fill(14400 / 60),
    rows,
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
`;

fs.writeFileSync("lib/documents/generators/acceptance-form.ts", newCode);
console.log("Done SAL");
