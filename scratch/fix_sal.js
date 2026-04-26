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
const B_Y_NONE = { ...ALL_BORDERS, top: NO_BORDER, bottom: NO_BORDER };

const BLUE_FILL = { fill: "0F204B", type: ShadingType.CLEAR }; // slightly darker blue based on original

function txt(text: string, opts?: { bold?: boolean; size?: number; font?: string; color?: string; underline?: boolean; italic?: boolean }) {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    italics: opts?.italic ?? false,
    size: opts?.size ?? 18, // 9pt
    font: opts?.font ?? "Century Gothic", // The original looks a bit like a sans-serif like Century Gothic or Arial. Let's use Arial.
    color: opts?.color ?? "000000",
    underline: opts?.underline ? {} : undefined,
  });
}

function p(text: string | TextRun[], opts?: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; color?: string; size?: number; before?: number; after?: number; italic?: boolean }) {
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
    margins: opts?.margins ?? { top: 40, bottom: 40, left: 60, right: 60 },
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
    cell([p("AMTEC SAL SAMPLE ACCEPTANCE FORM", { bold: true, size: 22, color: "FFFFFF", align: AlignmentType.CENTER, before: 40, after: 40 })], 60, { shading: BLUE_FILL })
  ]}));

  // Row 2: General Info
  rows.push(new TableRow({ children: [
    cell([p("A. General Information", { bold: true, size: 20, color: "FFFFFF", before: 20, after: 20 })], 60, { shading: BLUE_FILL })
  ]}));

  // Row 3: Dispatch No, Test Engineers, Control Number
  // No vertical borders between them!
  rows.push(new TableRow({ children: [
    cell([
      new Paragraph({
        children: [txt("Dispatch No:     ", { bold: true }), txt(dispatchNo)],
        spacing: { before: 40, after: 40 }
      })
    ], 20, { borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: NO_BORDER } }),
    cell([
      new Paragraph({
        children: [txt("Test Engineer/s:     ", { bold: true }), txt(initials)],
        spacing: { before: 40, after: 40 }
      })
    ], 20, { borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: NO_BORDER, right: NO_BORDER } }),
    cell([
      new Paragraph({
        children: [txt("Control Number:     ", { bold: true }), txt("SA-2026-", { underline: true })],
        spacing: { before: 40, after: 40 }
      })
    ], 20, { borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: NO_BORDER, right: THIN_BORDER } })
  ]}));

  // Row 4: Table Header
  rows.push(new TableRow({ children: [
    headerCell("SAL No.\\n(to be filled up by SAL staff)", 8),
    headerCell("TAM No./ Machine Brand and Model\\n(to be filled up by TE)", 14),
    headerCell("Machine\\n(to be filled up by TE)", 14),
    headerCell("List of Samples\\n(to be filled up by SAL staff)", 24)
  ]}));

  // Min 6 machine rows. But each machine has 3 sub-rows.
  // 6 machines = 18 rows total to match the density.
  // Wait, looking at image 1, there are exactly 5 machines listed (5 sets of 3 rows).
  // Let's do 5 sets.
  const MIN_M = 5;
  const machineData = [...machines];
  while (machineData.length < MIN_M) machineData.push({} as any);

  machineData.slice(0, MIN_M).forEach((m) => {
    const brandModel = [m.tam_no, m.brand, m.model].filter(Boolean).join(" ");
    const machine = m.machine ?? "";

    // The character • (U+2022) is extremely safe for docx.
    // Sub-row A (No. of Trials)
    rows.push(new TableRow({ children: [
      valueCell("", 8, { borders: B_B_NONE }),
      cell([p(brandModel, { align: AlignmentType.CENTER })], 14, { borders: B_B_NONE }),
      cell([p(machine, { align: AlignmentType.CENTER })], 14, { borders: B_B_NONE }),
      valueCell("• No. of Trials", 8),
      valueCell("•", 8),
      valueCell("•", 8)
    ]}));

    // Sub-row B (MC)
    rows.push(new TableRow({ children: [
      valueCell("", 8, { borders: B_Y_NONE }),
      valueCell("", 14, { borders: B_Y_NONE }),
      valueCell("", 14, { borders: B_Y_NONE }),
      valueCell("• MC", 8),
      valueCell("•", 8),
      valueCell("•", 8)
    ]}));

    // Sub-row C (Empty)
    rows.push(new TableRow({ children: [
      valueCell("", 8, { borders: B_T_NONE }),
      valueCell("", 14, { borders: B_T_NONE }),
      valueCell("", 14, { borders: B_T_NONE }),
      valueCell("•", 8),
      valueCell("•", 8),
      valueCell("•", 8)
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
    cell([p("", { before: 500 })], 60) // Reduced from 800 to 500 to match the smaller box in image 1
  ]}));

  // Signatures
  // To get the spacing right, let's use a nested structure or just carefully padded paragraphs
  // "Issued by:" on the left, "Duly signed by:" on the right
  // "______________________________          ____________"
  // "  Signature over Printed Name                Date   "
  rows.push(new TableRow({ children: [
    cell([
      p("Issued by:", { bold: true, before: 20 }),
      p("______________________________          ____________", { align: AlignmentType.CENTER, before: 400 }),
      new Paragraph({
        children: [
          txt("        Signature over Printed Name                                    Date         ", { size: 16, italic: true })
        ],
        alignment: AlignmentType.CENTER,
      }),
      p("SAL Staff", { bold: true, italic: true, align: AlignmentType.CENTER, before: 40, after: 20 })
    ], 30, { verticalAlign: VerticalAlign.TOP }),
    cell([
      p("Duly signed by:", { bold: true, before: 20 }),
      p("______________________________          ____________", { align: AlignmentType.CENTER, before: 400 }),
      new Paragraph({
        children: [
          txt("        Signature over Printed Name                                    Date         ", { size: 16, italic: true })
        ],
        alignment: AlignmentType.CENTER,
      }),
      p("Test Engineer / Representative", { bold: true, italic: true, align: AlignmentType.CENTER, before: 40, after: 20 })
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
console.log("Done SAL update");
