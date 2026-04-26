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
const MARGIN    = 1440;  // 1 inch margins
const CONTENT_W = PAGE_W - MARGIN * 2; // 12960 DXA

const N = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
const t = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const T = { style: BorderStyle.SINGLE, size: 12, color: "000000" };

const BLUE_FILL = { fill: "0F204B", type: ShadingType.CLEAR };

function txt(text: string, opts?: { bold?: boolean; size?: number; font?: string; color?: string; underline?: boolean; italic?: boolean }) {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    italics: opts?.italic ?? false,
    size: opts?.size ?? 18, // 9pt
    font: opts?.font ?? "Century Gothic", // Very close to the original sans-serif
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
  children: (Paragraph | Table)[],
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
    borders: opts?.borders ?? { top: t, bottom: t, left: t, right: t },
    shading: opts?.shading,
    verticalAlign: opts?.verticalAlign ?? VerticalAlign.CENTER,
    columnSpan: units,
    margins: opts?.margins ?? { top: 40, bottom: 40, left: 60, right: 60 },
  });
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
        transformation: { width: 25, height: 25 },
        type: "png"
      });
    }
  } catch (err) {
    console.error("Failed to load logo", err);
  }

  // Row 1: Title
  rows.push(new TableRow({ children: [
    cell([p(logoRun, { align: AlignmentType.LEFT })], 5, { shading: BLUE_FILL, borders: { top: T, bottom: T, left: T, right: N } }),
    cell([p("AMTEC SAL SAMPLE ACCEPTANCE FORM", { bold: true, size: 22, color: "FFFFFF", align: AlignmentType.CENTER })], 50, { shading: BLUE_FILL, borders: { top: T, bottom: T, left: N, right: N } }),
    cell([p("")], 5, { shading: BLUE_FILL, borders: { top: T, bottom: T, left: N, right: T } })
  ]}));

  // Row 2: General Info
  rows.push(new TableRow({ children: [
    cell([p("A. General Information", { bold: true, size: 20, color: "FFFFFF", before: 20, after: 20 })], 60, { shading: BLUE_FILL, borders: { top: T, bottom: T, left: T, right: T } })
  ]}));

  // Row 3: Dispatch No, Test Engineers, Control Number
  rows.push(new TableRow({ children: [
    cell([
      new Paragraph({
        children: [txt("Dispatch No:     ", { bold: true }), txt(\` \${dispatchNo} \`, { underline: true })],
        spacing: { before: 60, after: 60 }
      })
    ], 20, { borders: { top: T, bottom: T, left: T, right: N } }),
    cell([
      new Paragraph({
        children: [txt("Test Engineer/s:     ", { bold: true }), txt(\` \${initials} \`, { underline: true })],
        spacing: { before: 60, after: 60 }
      })
    ], 20, { borders: { top: T, bottom: T, left: N, right: N } }),
    cell([
      new Paragraph({
        children: [txt("Control Number:     ", { bold: true }), txt(" SA-2026-                  ", { underline: true })],
        spacing: { before: 60, after: 60 }
      })
    ], 20, { borders: { top: T, bottom: T, left: N, right: T } })
  ]}));

  // Row 4: Table Header
  rows.push(new TableRow({ children: [
    cell([p("SAL No.\\n(to be filled up by SAL staff)", { bold: true, align: AlignmentType.CENTER })], 8, { borders: { top: T, bottom: T, left: T, right: t } }),
    cell([p("TAM No./ Machine Brand and Model\\n(to be filled up by TE)", { bold: true, align: AlignmentType.CENTER })], 11, { borders: { top: T, bottom: T, left: t, right: t } }),
    cell([p("Machine\\n(to be filled up by TE)", { bold: true, align: AlignmentType.CENTER })], 11, { borders: { top: T, bottom: T, left: t, right: t } }),
    cell([p("List of Samples\\n(to be filled up by SAL staff)", { bold: true, align: AlignmentType.CENTER })], 30, { borders: { top: T, bottom: T, left: t, right: T } })
  ]}));

  const MIN_M = 5;
  const machineData = [...machines];
  while (machineData.length < MIN_M) machineData.push({} as any);

  machineData.slice(0, MIN_M).forEach((m) => {
    const brandModel = [m.tam_no, m.brand, m.model].filter(Boolean).join(" ");
    const machine = m.machine ?? "";

    const b = () => new TextRun({ text: "? ", font: "Arial" }); // Must be new instance each time!

    // Sub-row A
    rows.push(new TableRow({ children: [
      cell([p("")], 8, { borders: { top: T, bottom: N, left: T, right: t } }),
      cell([p(brandModel, { align: AlignmentType.CENTER })], 11, { borders: { top: T, bottom: N, left: t, right: t } }),
      cell([p(machine, { align: AlignmentType.CENTER })], 11, { borders: { top: T, bottom: N, left: t, right: t } }),
      cell([p([b(), txt("No. of Trials")])], 10, { borders: { top: T, bottom: t, left: t, right: t } }),
      cell([p([b()])], 10, { borders: { top: T, bottom: t, left: t, right: t } }),
      cell([p([b()])], 10, { borders: { top: T, bottom: t, left: t, right: T } })
    ]}));

    // Sub-row B
    rows.push(new TableRow({ children: [
      cell([p("")], 8, { borders: { top: N, bottom: N, left: T, right: t } }),
      cell([p("")], 11, { borders: { top: N, bottom: N, left: t, right: t } }),
      cell([p("")], 11, { borders: { top: N, bottom: N, left: t, right: t } }),
      cell([p([b(), txt("MC")])], 10, { borders: { top: t, bottom: t, left: t, right: t } }),
      cell([p([b()])], 10, { borders: { top: t, bottom: t, left: t, right: t } }),
      cell([p([b()])], 10, { borders: { top: t, bottom: t, left: t, right: T } })
    ]}));

    // Sub-row C
    rows.push(new TableRow({ children: [
      cell([p("")], 8, { borders: { top: N, bottom: T, left: T, right: t } }),
      cell([p("")], 11, { borders: { top: N, bottom: T, left: t, right: t } }),
      cell([p("")], 11, { borders: { top: N, bottom: T, left: t, right: t } }),
      cell([p([b()])], 10, { borders: { top: t, bottom: T, left: t, right: t } }),
      cell([p([b()])], 10, { borders: { top: t, bottom: T, left: t, right: t } }),
      cell([p([b()])], 10, { borders: { top: t, bottom: T, left: t, right: T } })
    ]}));
  });

  // Remarks Header
  rows.push(new TableRow({ children: [
    cell([
      new Paragraph({ children: [txt("B. Remarks/Deficiency ", { bold: true, size: 20, color: "FFFFFF" }), txt("(to be filled up by SAL staff)", { size: 16, color: "FFFFFF", italic: true })], spacing: { before: 20, after: 20 } })
    ], 60, { shading: BLUE_FILL, borders: { top: T, bottom: T, left: T, right: T } })
  ]}));

  // Remarks Box (reduced height)
  rows.push(new TableRow({ children: [
    cell([p("", { before: 300 })], 60, { borders: { top: T, bottom: T, left: T, right: T } }) 
  ]}));

  // Signatures
  const NO_BS = { top: N, bottom: N, left: N, right: N };
  const sigTableLeft = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BS,
    columnWidths: [60, 40],
    rows: [
      new TableRow({ children: [
        cell([p("________________________________________", { align: AlignmentType.CENTER })], 60, { borders: NO_BS }),
        cell([p("__________________", { align: AlignmentType.CENTER })], 40, { borders: NO_BS })
      ]}),
      new TableRow({ children: [
        cell([p("Signature over Printed Name", { align: AlignmentType.CENTER, italic: true, size: 16 })], 60, { borders: NO_BS }),
        cell([p("Date", { align: AlignmentType.CENTER, italic: true, size: 16 })], 40, { borders: NO_BS })
      ]}),
      new TableRow({ children: [
        cell([p("SAL Staff", { align: AlignmentType.CENTER, italic: true, bold: true, size: 18, before: 20 })], 60, { borders: NO_BS }),
        cell([p("")], 40, { borders: NO_BS })
      ]})
    ]
  });

  const sigTableRight = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BS,
    columnWidths: [60, 40],
    rows: [
      new TableRow({ children: [
        cell([p("________________________________________", { align: AlignmentType.CENTER })], 60, { borders: NO_BS }),
        cell([p("__________________", { align: AlignmentType.CENTER })], 40, { borders: NO_BS })
      ]}),
      new TableRow({ children: [
        cell([p("Signature over Printed Name", { align: AlignmentType.CENTER, italic: true, size: 16 })], 60, { borders: NO_BS }),
        cell([p("Date", { align: AlignmentType.CENTER, italic: true, size: 16 })], 40, { borders: NO_BS })
      ]}),
      new TableRow({ children: [
        cell([p("Test Engineer / Representative", { align: AlignmentType.CENTER, italic: true, bold: true, size: 18, before: 20 })], 60, { borders: NO_BS }),
        cell([p("")], 40, { borders: NO_BS })
      ]})
    ]
  });

  rows.push(new TableRow({ children: [
    cell([
      p("Issued by:", { bold: true, before: 40, after: 400 }),
      sigTableLeft,
      p("") // Required trailing paragraph after table
    ], 30, { verticalAlign: VerticalAlign.TOP, borders: { top: T, bottom: T, left: T, right: T } }),
    cell([
      p("Duly signed by:", { bold: true, before: 40, after: 400 }),
      sigTableRight,
      p("") // Required trailing paragraph after table
    ], 30, { verticalAlign: VerticalAlign.TOP, borders: { top: T, bottom: T, left: T, right: T } })
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
console.log("Done SAL update 3");
