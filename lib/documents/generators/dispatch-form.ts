// -----------------------------------------------------------------------------
// lib/documents/generators/dispatch-form.ts
// Generates the official AMTEC Dispatch Form as DOCX
// -----------------------------------------------------------------------------

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, WidthType, AlignmentType, VerticalAlign, ShadingType,
} from "docx";

import {
  DocumentDispatchData, formatDateRange,
  extractPersonnel,
} from "../types";

// -- DXA constants -------------------------------------------------------------
const PAGE_W    = 12240; // 8.5 in
const PAGE_H    = 18720; // 13 in (Long Bond / Folio)
const MARGIN    = 720;   // 0.5 in
const CONTENT_W = PAGE_W - MARGIN * 2; // 10800 DXA

const NO_BORDER   = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

const B_B_NONE = { ...ALL_BORDERS, bottom: NO_BORDER };
const B_T_NONE = { ...ALL_BORDERS, top: NO_BORDER };
const B_Y_NONE = { ...ALL_BORDERS, top: NO_BORDER, bottom: NO_BORDER };

const BLUE_FILL = { fill: "1B2A6B", type: ShadingType.CLEAR };
const GRAY_FILL = { fill: "F2F2F2", type: ShadingType.CLEAR };
const YELLOW_FILL = { fill: "FFFF00", type: ShadingType.CLEAR };

function txt(text: string, opts?: { bold?: boolean; size?: number; font?: string; color?: string; underline?: boolean }) {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    size: opts?.size ?? 16, // Default 8pt
    font: opts?.font ?? "Arial",
    color: opts?.color ?? "000000",
    underline: opts?.underline ? {} : undefined,
  });
}

function p(text: string | TextRun[], opts?: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; color?: string; size?: number; before?: number; after?: number }) {
  let runs: TextRun[];
  if (typeof text === "string") {
    runs = text.split("\n").flatMap((line, i, arr) => 
      i === arr.length - 1 ? [txt(line, opts)] : [txt(line, opts), new TextRun({ break: 1 })]
    );
  } else {
    runs = text;
  }
  return new Paragraph({
    children: runs,
    alignment: opts?.align ?? AlignmentType.LEFT,
    spacing: { before: opts?.before ?? 15, after: opts?.after ?? 15 },
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
    margins: opts?.margins ?? { top: 20, bottom: 20, left: 40, right: 40 },
  });
}

function labelCell(text: string, units: number, opts?: { align?: any; borders?: any }) {
  return cell([p(text, { bold: true, align: opts?.align })], units, { shading: GRAY_FILL, borders: opts?.borders });
}

function headerCell(text: string, units: number, opts?: { borders?: any }) {
  return cell([p(text, { bold: true, align: AlignmentType.CENTER })], units, { shading: GRAY_FILL, borders: opts?.borders });
}

function valueCell(text: string, units: number, opts?: { borders?: any }) {
  return cell([p(text)], units, { borders: opts?.borders });
}

export async function generateDispatchForm(dispatch: DocumentDispatchData): Promise<Buffer> {
  const personnel   = extractPersonnel(dispatch);
  const engineers   = personnel.filter(p => ["lead_engineer", "assistant_engineer"].includes(p.assignment_type));
  const technicians = personnel.filter(p => p.assignment_type === "technician");
  const instruments = dispatch.dispatch_instruments ?? [];
  const machines    = dispatch.dispatch_machines ?? [];
  const itinerary   = dispatch.dispatch_itinerary ?? [];

  const engineerNames   = engineers.map(e => e.full_name).join(", ") || "�";
  const technicianNames = technicians.map(t => t.full_name).join(", ") || "�";
  const dateRange       = formatDateRange(dispatch.date_from, dispatch.date_to);
  const location        = dispatch.testing_location || dispatch.company_name || "�";
  
  const isPub  = dispatch.transport_mode === "public_conveyance";
  const isAppl = dispatch.transport_mode === "test_applicant_vehicle";
  const isCol  = dispatch.transport_mode === "college_vehicle";
  const isOth  = dispatch.transport_mode === "other";
  const otherT = dispatch.transport_other_text ?? "";

  const rows: TableRow[] = [];

  // Row 1: DISPATCH FORM
  rows.push(new TableRow({
    children: [
      cell([p("DISPATCH FORM", { bold: true, size: 22, color: "FFFFFF", align: AlignmentType.CENTER, before: 60, after: 60 })], 60, { shading: BLUE_FILL })
    ]
  }));

  // Row 2: Dispatch No
  rows.push(new TableRow({ children: [ labelCell("Dispatch Control Number:", 15), valueCell(dispatch.dispatch_number ?? "", 45) ] }));

  // Row 3: Date
  rows.push(new TableRow({ children: [
    labelCell("Date of Travel", 15),
    valueCell(dateRange, 20),
    cell([p("[ ] Extended until ________________ (____ days)", { size: 14 })], 25, { shading: GRAY_FILL })
  ]}));

  // Row 4: Location
  rows.push(new TableRow({ children: [ labelCell("Location of travel:", 15), valueCell(location, 45) ] }));

  // Row 5: Engineers
  rows.push(new TableRow({ children: [ labelCell("Engineer/s:", 15), valueCell(engineerNames, 45) ] }));

  // Row 6: Technicians
  rows.push(new TableRow({ children: [ labelCell("Technician/s:", 15), valueCell(technicianNames, 45) ] }));

  // Row 7: Instruments Header
  rows.push(new TableRow({ children: [
    headerCell("Instruments:", 15),
    headerCell("Instrument Code / Brand & Model", 14),
    headerCell("Before Travel (Y/N)", 6),
    headerCell("Onsite / Field (Y/N)", 6),
    headerCell("After Travel (Y/N)", 6),
    headerCell("Remarks", 13)
  ]}));

  // Rows 8-25: Instruments (18 rows)
  const instNames = instruments.map(i => i.instrument_name);
  while (instNames.length < 18) instNames.push("");
  instNames.slice(0, 18).forEach(name => {
    rows.push(new TableRow({ children: [
      valueCell(name, 15), valueCell("", 14), valueCell("", 6), valueCell("", 6), valueCell("", 6), valueCell("", 13)
    ]}));
  });

  // Row 26: Company
  rows.push(new TableRow({ children: [ labelCell("Company:", 15), valueCell(dispatch.company_name ?? "", 45) ] }));

  // Row 27: Contact
  rows.push(new TableRow({ children: [ labelCell("Contact Person/ Contact Information:", 15), valueCell(dispatch.contact_info ?? "", 45) ] }));

  // Row 28: Mode of Transport
  rows.push(new TableRow({ children: [
    labelCell("Mode of Transport:", 15),
    cell([p((isPub ? "[X] " : "[ ] ") + "Public Conveyance")], 10, { shading: isPub ? YELLOW_FILL : undefined }),
    cell([p((isAppl ? "[X] " : "[ ] ") + "Test Applicant Vehicle")], 13, { shading: isAppl ? YELLOW_FILL : undefined }),
    cell([p((isCol ? "[X] " : "[ ] ") + "College Vehicle")], 10, { shading: isCol ? YELLOW_FILL : undefined }),
    cell([p((isOth ? "[X] " : "[ ] ") + "Others: " + otherT)], 12, { shading: isOth ? YELLOW_FILL : undefined })
  ]}));

  // Row 29: Other details
  rows.push(new TableRow({ children: [ labelCell("Other Travel Details:", 15), valueCell(dispatch.notes ?? "", 45) ] }));

  // Row 30: Itinerary Header 1 (Fake row span start)
  rows.push(new TableRow({ children: [
    labelCell("Travel Itinerary:", 15, { borders: B_B_NONE }),
    headerCell("Date", 5, { borders: B_B_NONE }),
    headerCell("Per Diem\n(Check (/) if provided by Test Applicant, otherwise cross mark (X). NA if not applicable)", 13),
    headerCell("Time of Travel\n(00:00 to 00:00)", 9, { borders: B_B_NONE }),
    headerCell("Working/Productive Hours\n(00:00 to 00:00)", 9, { borders: B_B_NONE }),
    headerCell("Overtime hours", 9)
  ]}));

  // Row 31: Itinerary Header 2
  rows.push(new TableRow({ children: [
    cell([p("")], 15, { shading: GRAY_FILL, borders: B_Y_NONE }), // C1
    cell([p("")], 5, { shading: GRAY_FILL, borders: B_T_NONE }),  // Date (end)
    headerCell("Accommodation", 7),
    headerCell("B", 2),
    headerCell("L", 2),
    headerCell("D", 2),
    cell([p("")], 9, { shading: GRAY_FILL, borders: B_T_NONE }),  // Time (end)
    cell([p("")], 9, { shading: GRAY_FILL, borders: B_T_NONE }),  // Work (end)
    headerCell("(For offset)", 5),
    headerCell("(For billing)", 4)
  ]}));

  // Rows 32-37: Itinerary rows (6 rows)
  const itinData = [...itinerary];
  while (itinData.length < 6) itinData.push({} as any);
  itinData.slice(0, 6).forEach((row, i) => {
    const isLast = i === 5;
    const c1Borders = isLast ? B_T_NONE : B_Y_NONE;
    rows.push(new TableRow({ children: [
      cell([p("")], 15, { shading: GRAY_FILL, borders: c1Borders }),
      valueCell(row.travel_date ?? "", 5),
      valueCell(row.per_diem_accommodation ?? "", 7),
      valueCell(row.per_diem_b ?? "", 2),
      valueCell(row.per_diem_l ?? "", 2),
      valueCell(row.per_diem_d ?? "", 2),
      valueCell(row.time_of_travel ?? "", 9),
      valueCell(row.working_hours ?? "", 9),
      valueCell(row.overtime_offset ?? "", 5),
      valueCell(row.overtime_billing ?? "", 4)
    ]}));
  });

  // Row 38: Machines to be Tested Header
  rows.push(new TableRow({ children: [
    cell([p("Machines to be Tested:", { bold: true, color: "FFFFFF" })], 60, { shading: BLUE_FILL })
  ]}));

  // Row 39: Machines Header 2
  rows.push(new TableRow({ children: [
    headerCell("TAM No.", 7),
    headerCell("MACHINES", 12),
    headerCell("BRAND", 10),
    headerCell("MODEL", 10),
    headerCell("Serial Number of Unit", 8),
    headerCell("Date of Test", 8),
    headerCell("Status (Y/N)", 5)
  ]}));

  // Rows 40-46: Machines Data (7 rows)
  const machData = [...machines];
  while (machData.length < 7) machData.push({} as any);
  machData.slice(0, 7).forEach(m => {
    rows.push(new TableRow({ children: [
      valueCell(m.tam_no ?? "", 7),
      valueCell(m.machine ?? "", 12),
      valueCell(m.brand ?? "", 10),
      valueCell(m.model ?? "", 10),
      valueCell(m.serial_no ?? "", 8),
      valueCell(m.date_of_test ?? "", 8),
      valueCell(m.status ?? "", 5)
    ]}));
  });

  // Row 47: Remarks / Notes Header
  rows.push(new TableRow({ children: [
    cell([p("Remarks/ Observations:", { bold: true, color: "FFFFFF" })], 30, { shading: BLUE_FILL }),
    cell([p("Notes:", { bold: true, color: "FFFFFF" })], 30, { shading: BLUE_FILL })
  ]}));

  // Row 48: Remarks / Notes Value
  rows.push(new TableRow({ children: [
    cell([p(dispatch.remarks_observation ?? "", { before: 200, after: 200 })], 30, { verticalAlign: VerticalAlign.TOP }),
    cell([p("", { before: 200, after: 200 })], 30, { verticalAlign: VerticalAlign.TOP })
  ]}));

  // Row 49: Signatures Header
  rows.push(new TableRow({ children: [
    labelCell("Approved by:", 15),
    labelCell("Checked by:", 15),
    labelCell("Equipment checked by:", 15),
    labelCell("Encoded by:", 15)
  ]}));

  // Row 50: Signatures Value
  rows.push(new TableRow({ children: [
    cell([
      p("DR. ARTHUR L. FAJARDO", { bold: true, align: AlignmentType.CENTER, before: 600, after: 0 }),
      p("AMTEC Director", { align: AlignmentType.CENTER, before: 0 })
    ], 15),
    cell([
      p("Signature over Name", { align: AlignmentType.CENTER, before: 600, after: 0 }),
      p("Test Coordinator", { align: AlignmentType.CENTER, before: 0 })
    ], 15),
    cell([
      p("Signature over Name", { align: AlignmentType.CENTER, before: 600, after: 0 }),
      p("Test Coordinator", { align: AlignmentType.CENTER, before: 0 })
    ], 15),
    cell([
      p("Signature over Name", { align: AlignmentType.CENTER, before: 600, after: 0 }),
      p("Test Engineer", { align: AlignmentType.CENTER, before: 0 })
    ], 15)
  ]}));

  // Row 51: Footer
  rows.push(new TableRow({ children: [
    cell([p("AMTEC-OP-F4, \"Dispatch Form\"", { size: 14, before: 0, after: 0 })], 30, { borders: { ...ALL_BORDERS, bottom: NO_BORDER, left: NO_BORDER } }),
    cell([p("Date of Revision: 11/20/2024", { size: 14, align: AlignmentType.RIGHT, before: 0, after: 0 })], 30, { borders: { ...ALL_BORDERS, bottom: NO_BORDER, right: NO_BORDER } })
  ]}));

  // Build Table
  const table = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: Array(60).fill(180),
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
