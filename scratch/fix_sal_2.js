const fs = require("fs");

const newCode = `// -----------------------------------------------------------------------------
// lib/documents/generators/acceptance-form.ts
// Generates the AMTEC SAL Sample Acceptance Form as DOCX
// -----------------------------------------------------------------------------

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, WidthType, AlignmentType, VerticalAlign, ShadingType, TableLayoutType,
  ImageRun,
} from "docx";

import { DocumentDispatchData, extractPersonnel } from "../types";
import * as fs from "fs";
import * as path from "path";

// -- DXA constants -------------------------------------------------------------
const PAGE_W    = 15840; // 11 in (Letter Landscape)
const PAGE_H    = 12240; // 8.5 in 
const MARGIN    = 1440;  // 1 inch margins (matches photo 5)
const CONTENT_W = PAGE_W - MARGIN * 2; // 12960 DXA

const NO_BORDER   = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const THICK_BORDER = { style: BorderStyle.SINGLE, size: 12, color: "000000" }; // Thicker borders as requested

// We will use thick borders for most lines to match the reference
const ALL_BORDERS = { top: THICK_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER };

const B_B_NONE = { ...ALL_BORDERS, bottom: NO_BORDER };
const B_T_NONE = { ...ALL_BORDERS, top: NO_BORDER };
const B_Y_NONE = { ...ALL_BORDERS, top: NO_BORDER, bottom: NO_BORDER };

const BLUE_FILL = { fill: "0F204B", type: ShadingType.CLEAR };

function txt(text: string, opts?: { bold?: boolean; size?: number; font?: string; color?: string; underline?: boolean; italic?: boolean }) {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    italics: opts?.italic ?? false,
    size: opts?.size ?? 18, // 9pt
    font: opts?.font ?? "Arial",
    color: opts?.color ?? "000000",
    underline: opts?.underline ? {} : undefined,
  });
}

function p(text: string | TextRun | TextRun[], opts?: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; color?: string; size?: number; before?: number; after?: number; italic?: boolean }) {
  let runs: TextRun[];
  if (typeof text === "string") {
    runs = text.split("\\n").flatMap((line, i, arr) => 
      i === arr.length - 1 ? [txt(line, opts)] : [txt(line, opts), new TextRun({ break: 1 })]
    );
  } else if (Array.isArray(text)) {
    runs = text as TextRun[];
  } else {
    runs = [text];
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

  // Prepare Logo Image
  let logoRun: TextRun | ImageRun = txt(" ");
  try {
    const logoPath = path.join(process.cwd(), "public", "amtec_logo.png");
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoRun = new ImageRun({
        data: logoBuffer,
        transformation: {
          width: 50, // resize appropriately
          height: 50,
        },
      });
    }
  } catch (err) {
    console.error("Failed to load logo", err);
  }

  // Row 1: Title
  // Place the logo in a layout that doesn't mess up the grid.
  // We can put the logo directly in the single cell and align the text carefully.
  rows.push(new TableRow({ children: [
    new TableCell({
      children: [
        new Paragraph({
          children: [
            logoRun,
            txt("        AMTEC SAL SAMPLE ACCEPTANCE FORM", { bold: true, size: 22, color: "FFFFFF" })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 20 }
        })
      ],
      borders: ALL_BORDERS,
      shading: BLUE_FILL,
      verticalAlign: VerticalAlign.CENTER,
      columnSpan: 60,
    })
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
    ], 20, { borders: { top: THICK_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: NO_BORDER } }),
    cell([
      new Paragraph({
        children: [txt("Test Engineer/s:     ", { bold: true }), txt(initials)],
        spacing: { before: 40, after: 40 }
      })
    ], 20, { borders: { top: THICK_BORDER, bottom: THICK_BORDER, left: NO_BORDER, right: NO_BORDER } }),
    cell([
      new Paragraph({
        children: [txt("Control Number:     ", { bold: true }), txt("SA-2026-", { underline: true })],
        spacing: { before: 40, after: 40 }
      })
    ], 20, { borders: { top: THICK_BORDER, bottom: THICK_BORDER, left: NO_BORDER, right: THICK_BORDER } })
  ]}));

  // Row 4: Table Header
  // Make all 6 columns exactly equal in size (10 units each)
  rows.push(new TableRow({ children: [
    headerCell("SAL No.\\n(to be filled up by SAL staff)", 10),
    headerCell("TAM No./ Machine Brand and Model\\n(to be filled up by TE)", 10),
    headerCell("Machine\\n(to be filled up by TE)", 10),
    headerCell("List of Samples\\n(to be filled up by SAL staff)", 30) // Spans the 3 sample columns
  ]}));

  // Min 5 machine rows.
  const MIN_M = 5;
  const machineData = [...machines];
  while (machineData.length < MIN_M) machineData.push({} as any);

  machineData.slice(0, MIN_M).forEach((m) => {
    const brandModel = [m.tam_no, m.brand, m.model].filter(Boolean).join(" ");
    const machine = m.machine ?? "";

    // Bullet characters: U+25CF Black Circle is the standard bullet shape.
    // If Arial fails, using Symbol font is safest. Let's explicitly format it.
    const bRun = new TextRun({ text: "? ", font: "Symbol" });

    // Sub-row A (No. of Trials)
    rows.push(new TableRow({ children: [
      valueCell("", 10, { borders: B_B_NONE }),
      cell([p(brandModel, { align: AlignmentType.CENTER })], 10, { borders: B_B_NONE }),
      cell([p(machine, { align: AlignmentType.CENTER })], 10, { borders: B_B_NONE }),
      cell([p([bRun, txt("No. of Trials")])], 10, { borders: ALL_BORDERS }),
      cell([p([bRun])], 10, { borders: ALL_BORDERS }),
      cell([p([bRun])], 10, { borders: ALL_BORDERS })
    ]}));

    // Sub-row B (MC)
    rows.push(new TableRow({ children: [
      valueCell("", 10, { borders: B_Y_NONE }),
      valueCell("", 10, { borders: B_Y_NONE }),
      valueCell("", 10, { borders: B_Y_NONE }),
      cell([p([bRun, txt("MC")])], 10, { borders: ALL_BORDERS }),
      cell([p([bRun])], 10, { borders: ALL_BORDERS }),
      cell([p([bRun])], 10, { borders: ALL_BORDERS })
    ]}));

    // Sub-row C (Empty)
    rows.push(new TableRow({ children: [
      valueCell("", 10, { borders: B_T_NONE }),
      valueCell("", 10, { borders: B_T_NONE }),
      valueCell("", 10, { borders: B_T_NONE }),
      cell([p([bRun])], 10, { borders: ALL_BORDERS }),
      cell([p([bRun])], 10, { borders: ALL_BORDERS }),
      cell([p([bRun])], 10, { borders: ALL_BORDERS })
    ]}));
  });

  // Remarks Header - matched exactly to photo 2
  rows.push(new TableRow({ children: [
    cell([
      p("B. Remarks/Deficiency (to be filled up by SAL staff)", { bold: true, size: 20, color: "FFFFFF", before: 20, after: 20 })
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
    columnWidths: Array(60).fill(CONTENT_W / 60),
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
console.log("Done SAL update 2");
