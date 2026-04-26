const fs = require("fs");
const path = require("path");

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
const MARGIN    = 1080;  // 0.75 inch margins for a tight but safe fit
const CONTENT_W = PAGE_W - MARGIN * 2; // 13680 DXA

const NO_BORDER   = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const THICK_BORDER = { style: BorderStyle.SINGLE, size: 12, color: "000000" };

// Presets for borders
const OUT_BORDERS = { top: THICK_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER };

const BLUE_FILL = { fill: "051D59", type: ShadingType.CLEAR }; // deep dark blue

function txt(text: string, opts?: { bold?: boolean; size?: number; font?: string; color?: string; underline?: boolean; italic?: boolean }) {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    italics: opts?.italic ?? false,
    size: opts?.size ?? 18, // 9pt base
    font: opts?.font ?? "Arial",
    color: opts?.color ?? "000000",
    underline: opts?.underline ? {} : undefined,
  });
}

function p(text: string | TextRun | TextRun[], opts?: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number }) {
  let runs: TextRun[];
  if (typeof text === "string") {
    runs = [txt(text)];
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
  units: number, 
  opts?: {
    borders?: any;
    shading?: any;
    verticalAlign?: any;
    margins?: any;
  }
) {
  return new TableCell({
    children,
    borders: opts?.borders ?? OUT_BORDERS,
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
        transformation: { width: 30, height: 30 },
        type: "png"
      });
    }
  } catch (err) {
    console.error("Failed to load logo", err);
  }

  // Row 1: Title (3 cells: Logo, Title, Empty)
  rows.push(new TableRow({ children: [
    new TableCell({
      children: [p(logoRun, { align: AlignmentType.LEFT, before: 20, after: 20 })],
      borders: OUT_BORDERS,
      shading: BLUE_FILL,
      verticalAlign: VerticalAlign.CENTER,
      columnSpan: 8,
      margins: { top: 0, bottom: 0, left: 60, right: 0 }
    }),
    new TableCell({
      children: [p(txt("AMTEC SAL SAMPLE ACCEPTANCE FORM", { bold: true, size: 22, color: "FFFFFF" }), { align: AlignmentType.CENTER })],
      borders: OUT_BORDERS,
      shading: BLUE_FILL,
      verticalAlign: VerticalAlign.CENTER,
      columnSpan: 44,
    }),
    new TableCell({
      children: [p(" ")],
      borders: OUT_BORDERS,
      shading: BLUE_FILL,
      verticalAlign: VerticalAlign.CENTER,
      columnSpan: 8,
    })
  ]}));

  // Row 2: General Info
  rows.push(new TableRow({ children: [
    cell([p(txt("A. General Information", { bold: true, size: 20, color: "FFFFFF" }), { before: 20, after: 20 })], 60, { shading: BLUE_FILL })
  ]}));

  // Row 3: Dispatch No, Test Engineers, Control Number
  rows.push(new TableRow({ children: [
    cell([
      p([txt("Dispatch No:     ", { bold: true }), txt(dispatchNo)], { before: 40, after: 40 })
    ], 18, { borders: { top: THICK_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: NO_BORDER } }),
    cell([
      p([txt("Test Engineer/s:     ", { bold: true }), txt(initials)], { before: 40, after: 40 })
    ], 22, { borders: { top: THICK_BORDER, bottom: THICK_BORDER, left: NO_BORDER, right: NO_BORDER } }),
    cell([
      p([txt("Control Number:     ", { bold: true }), txt("SA-2026-", { underline: true })], { before: 40, after: 40 })
    ], 20, { borders: { top: THICK_BORDER, bottom: THICK_BORDER, left: NO_BORDER, right: THICK_BORDER } })
  ]}));

  // Row 4: Table Header (SAL=8, TAM=11, Machine=11, Samples=30)
  const hdrSub = (t: string) => txt("\\n" + t, { size: 14, italic: true });
  rows.push(new TableRow({ children: [
    cell([p([txt("SAL No.", { bold: true }), hdrSub("(to be filled up by SAL staff)")], { align: AlignmentType.CENTER })], 8),
    cell([p([txt("TAM No./ Machine Brand and Model", { bold: true }), hdrSub("(to be filled up by TE)")], { align: AlignmentType.CENTER })], 11),
    cell([p([txt("Machine", { bold: true }), hdrSub("(to be filled up by TE)")], { align: AlignmentType.CENTER })], 11),
    cell([p([txt("List of Samples", { bold: true }), hdrSub("(to be filled up by SAL staff)")], { align: AlignmentType.CENTER })], 30)
  ]}));

  // Machine Rows (5 machines)
  const MIN_M = 5;
  const machineData = [...machines];
  while (machineData.length < MIN_M) machineData.push({} as any);

  machineData.slice(0, MIN_M).forEach((m) => {
    const brandModel = [m.tam_no, m.brand, m.model].filter(Boolean).join(" ");
    const machine = m.machine ?? "";

    // Bullet character: U+2022 • (Safe in Arial)
    const b = () => txt("•  ", { font: "Arial", size: 18 });

    // Sub-row A
    rows.push(new TableRow({ children: [
      cell([p("")], 8, { borders: { top: THICK_BORDER, bottom: NO_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p(txt(brandModel, { size: 16 }), { align: AlignmentType.CENTER })], 11, { borders: { top: THICK_BORDER, bottom: NO_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p(txt(machine, { size: 16 }), { align: AlignmentType.CENTER })], 11, { borders: { top: THICK_BORDER, bottom: NO_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b(), txt("No. of Trials", { bold: true })])], 10, { borders: { top: THICK_BORDER, bottom: THIN_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b()])], 10, { borders: { top: THICK_BORDER, bottom: THIN_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b()])], 10, { borders: { top: THICK_BORDER, bottom: THIN_BORDER, left: THICK_BORDER, right: THICK_BORDER } })
    ]}));

    // Sub-row B
    rows.push(new TableRow({ children: [
      cell([p("")], 8, { borders: { top: NO_BORDER, bottom: NO_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p("")], 11, { borders: { top: NO_BORDER, bottom: NO_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p("")], 11, { borders: { top: NO_BORDER, bottom: NO_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b(), txt("MC", { bold: true })])], 10, { borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b()])], 10, { borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b()])], 10, { borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THICK_BORDER, right: THICK_BORDER } })
    ]}));

    // Sub-row C
    rows.push(new TableRow({ children: [
      cell([p("")], 8, { borders: { top: NO_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p("")], 11, { borders: { top: NO_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p("")], 11, { borders: { top: NO_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b()])], 10, { borders: { top: THIN_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b()])], 10, { borders: { top: THIN_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER } }),
      cell([p([b()])], 10, { borders: { top: THIN_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER } })
    ]}));
  });

  // Remarks Header (Split row! 30 units blue, 30 units white)
  rows.push(new TableRow({ children: [
    cell([
      p([
        txt("B. Remarks/Deficiency ", { bold: true, size: 18, color: "FFFFFF" }),
        txt("(to be filled up by SAL staff)", { size: 14, color: "FFFFFF", italic: true })
      ], { before: 20, after: 20 })
    ], 30, { shading: BLUE_FILL }),
    cell([p("")], 30) // White background
  ]}));

  // Signatures
  // We use nested tables for exact signature line control
  const sigTable = (nameRole: string) => {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [6000, 1000, 3000], // Proportions
      borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideVertical: NO_BORDER, insideHorizontal: NO_BORDER },
      rows: [
        new TableRow({ children: [
          new TableCell({ children: [p("")], borders: { top: NO_BORDER, bottom: THICK_BORDER, left: NO_BORDER, right: NO_BORDER } }),
          new TableCell({ children: [p("")], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
          new TableCell({ children: [p("")], borders: { top: NO_BORDER, bottom: THICK_BORDER, left: NO_BORDER, right: NO_BORDER } }),
        ]}),
        new TableRow({ children: [
          new TableCell({ children: [p(txt("Signature over Printed Name", { size: 14, italic: true }), { align: AlignmentType.CENTER, before: 40 })], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
          new TableCell({ children: [p("")], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
          new TableCell({ children: [p(txt("Date", { size: 14, italic: true }), { align: AlignmentType.CENTER, before: 40 })], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
        ]}),
        new TableRow({ children: [
          new TableCell({ children: [p(txt(nameRole, { size: 16, bold: true, italic: true }), { align: AlignmentType.CENTER, before: 40 })], borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }, columnSpan: 3 })
        ]})
      ]
    });
  };

  rows.push(new TableRow({ children: [
    cell([
      p(txt("Issued by:", { bold: true }), { before: 20 }),
      p("", { before: 600 }), // Spacer
      new Paragraph({ children: [sigTable("SAL Staff") as unknown as TextRun] }) // Render nested table
    ], 30, { verticalAlign: VerticalAlign.TOP }),
    
    cell([
      p(txt("Duly signed by:", { bold: true }), { before: 20 }),
      p("", { before: 600 }), // Spacer
      new Paragraph({ children: [sigTable("Test Engineer /Representative") as unknown as TextRun] })
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
console.log("Done EXACT SAL");
