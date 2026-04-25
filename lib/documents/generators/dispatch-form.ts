// ─────────────────────────────────────────────────────────────────────────────
// lib/documents/generators/dispatch-form.ts
// Generates the official AMTEC Dispatch Form as DOCX
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, WidthType, AlignmentType, VerticalAlign, ShadingType, ImageRun,
} from "docx";

import {
  DocumentDispatchData, formatDateRange, formatDate,
  extractPersonnel,
} from "../types";

// ── DXA constants ─────────────────────────────────────────────────────────────
const PAGE_W    = 15840; // 11 in (landscape)
const PAGE_H    = 12240; // 8.5 in (landscape)
const MARGIN    = 720;   // 0.5 in
const CONTENT_W = PAGE_W - MARGIN * 2; // 14400 DXA

const NO_BORDER   = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const NO_BORDERS  = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
const BOTTOM_ONLY = { top: NO_BORDER, bottom: THIN_BORDER, left: NO_BORDER, right: NO_BORDER };

function txt(text: string, opts?: { bold?: boolean; size?: number; font?: string; color?: string }) {
  return new TextRun({
    text,
    bold: opts?.bold ?? false,
    size: opts?.size ?? 18,
    font: opts?.font ?? "Arial",
    color: opts?.color,
  });
}

function cell(
  children: Paragraph[],
  width: number,
  opts?: {
    borders?: any;
    shading?: any;
    verticalAlign?: any;
    columnSpan?: number;
    rowSpan?: number;
    margins?: any;
  }
) {
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

function headerCell(text: string, width: number, opts?: { columnSpan?: number }) {
  return cell(
    [new Paragraph({
      children: [txt(text, { bold: true, size: 16 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
    })],
    width,
    {
      borders: ALL_BORDERS,
      shading: { fill: "D9D9D9", type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      columnSpan: opts?.columnSpan,
    }
  );
}

function labelCell(text: string, width: number, opts?: { columnSpan?: number; rowSpan?: number }) {
  return cell(
    [new Paragraph({
      children: [txt(text, { bold: true, size: 17 })],
      spacing: { before: 0, after: 0 },
    })],
    width,
    { borders: ALL_BORDERS, shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, ...opts }
  );
}

function valueCell(text: string, width: number, opts?: { columnSpan?: number }) {
  return cell(
    [new Paragraph({
      children: [txt(text, { size: 17 })],
      spacing: { before: 0, after: 0 },
    })],
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

const TRANSPORT_LABELS: Record<string, string> = {
  public_conveyance:      "Public Conveyance",
  test_applicant_vehicle: "Test Applicant Vehicle",
  college_vehicle:        "College Vehicle",
  other:                  "Others",
};

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateDispatchForm(dispatch: DocumentDispatchData): Promise<Buffer> {
  const personnel   = extractPersonnel(dispatch);
  const engineers   = personnel.filter(p => ["lead_engineer", "assistant_engineer"].includes(p.assignment_type));
  const technicians = personnel.filter(p => p.assignment_type === "technician");
  const instruments = dispatch.dispatch_instruments ?? [];
  const machines    = dispatch.dispatch_machines ?? [];
  const itinerary   = dispatch.dispatch_itinerary ?? [];

  const engineerNames   = engineers.map(e => e.full_name).join(", ") || "—";
  const technicianNames = technicians.map(t => t.full_name).join(", ") || "—";
  const dateRange       = formatDateRange(dispatch.date_from, dispatch.date_to);
  const transport       = TRANSPORT_LABELS[dispatch.transport_mode ?? ""] ?? dispatch.transport_mode ?? "—";
  const transportOther  = dispatch.transport_mode === "other" ? (dispatch.transport_other_text ?? "") : "";
  const location        = dispatch.testing_location || dispatch.company_name || "—";

  // Column widths for main form (landscape, 14400 total)
  // Col layout: Label(2200) | Value(3200) | Label(2200) | Value(3200) | Label(2200) | Value(1400)
  const C1 = 2200, C2 = 3200, C3 = 2000, C4 = 3200, C5 = 2000, C6 = 1800;
  const ROW_W = C1 + C2 + C3 + C4 + C5 + C6; // should = CONTENT_W = 14400

  // ── Instrument rows ──────────────────────────────────────────────────────
  // Show all provided instruments (minimum 15 rows for blank form look)
  const MIN_INST_ROWS = 15;
  const instNames = instruments.map(i => i.instrument_name);
  while (instNames.length < MIN_INST_ROWS) instNames.push("");

  const instrumentRows = instNames.map(name => {
    const IW = Math.floor(CONTENT_W / 6);
    return new TableRow({
      children: [
        valueCell(name, IW),
        emptyCell(IW),
        emptyCell(IW),
        emptyCell(IW),
        emptyCell(IW),
        emptyCell(CONTENT_W - IW * 5),
      ],
    });
  });

  // ── Machine rows ──────────────────────────────────────────────────────────
  const MIN_MACH_ROWS = 8;
  const machineData = [...machines];
  while (machineData.length < MIN_MACH_ROWS) machineData.push({});

  const MW1 = 1800, MW2 = 3600, MW3 = 2000, MW4 = 2000, MW5 = 2000, MW6 = 1500, MW7 = 1500;
  const machineRows = machineData.map(m => new TableRow({
    children: [
      valueCell(m.tam_no    ?? "", MW1),
      valueCell(m.machine   ?? "", MW2),
      valueCell(m.brand     ?? "", MW3),
      valueCell(m.model     ?? "", MW4),
      valueCell(m.serial_no ?? "", MW5),
      valueCell(m.date_of_test ?? "", MW6),
      valueCell(m.status    ?? "", MW7),
    ],
  }));

  // ── Itinerary rows ────────────────────────────────────────────────────────
  const MIN_ITIN_ROWS = 5;
  const itinData = [...itinerary];
  while (itinData.length < MIN_ITIN_ROWS) itinData.push({});

  const IW1 = 1400, IW2 = 2000, IW3 = 600, IW4 = 600, IW5 = 600,
        IW6 = 2000, IW7 = 2000, IW8 = 1600, IW9 = 1600, IW10 = 2000;
  // Total must = CONTENT_W (14400) — adjusted below
  const itinRows = itinData.map(row => new TableRow({
    children: [
      valueCell(row.travel_date            ?? "", IW1),
      valueCell(row.per_diem_accommodation ?? "", IW2),
      valueCell(row.per_diem_b             ?? "", IW3),
      valueCell(row.per_diem_l             ?? "", IW4),
      valueCell(row.per_diem_d             ?? "", IW5),
      valueCell(row.time_of_travel         ?? "", IW6),
      valueCell(row.working_hours          ?? "", IW7),
      valueCell(row.overtime_offset        ?? "", IW8),
      valueCell(row.overtime_billing       ?? "", IW9 + IW10),
    ],
  }));

  // Transport mode checkboxes
  const isPublic  = dispatch.transport_mode === "public_conveyance";
  const isApplVeh = dispatch.transport_mode === "test_applicant_vehicle";
  const isColVeh  = dispatch.transport_mode === "college_vehicle";
  const isOther   = dispatch.transport_mode === "other";

  const transportRow = new TableRow({
    children: [
      labelCell("Mode of Transport:", 2400),
      cell([
        new Paragraph({
          children: [
            txt(isPublic  ? "☑" : "☐"), txt(" Public Conveyance   "),
            txt(isApplVeh ? "☑" : "☐"), txt(" Test Applicant Vehicle   "),
            txt(isColVeh  ? "☑" : "☐"), txt(" College Vehicle   "),
            txt(isOther   ? "☑" : "☐"), txt(` Others: ${transportOther}`),
          ],
          spacing: { before: 0, after: 0 },
        }),
      ], CONTENT_W - 2400, { columnSpan: 5 }),
    ],
  });

  const IW = Math.floor(CONTENT_W / 6);

  const mainTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [C1, C2, C3, C4, C5, C6],
    rows: [
      // ── Title ──────────────────────────────────────────────────────────────
      new TableRow({
        children: [
          cell(
            [new Paragraph({
              children: [txt("DISPATCH FORM", { bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
            })],
            CONTENT_W,
            { columnSpan: 6, shading: { fill: "1B2A6B", type: ShadingType.CLEAR }, borders: ALL_BORDERS }
          ).constructor === TableCell
            ? (() => {
                const c = cell(
                  [new Paragraph({
                    children: [txt("DISPATCH FORM", { bold: true, size: 28, color: "FFFFFF" })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 60 },
                  })],
                  CONTENT_W,
                  { columnSpan: 6, shading: { fill: "1B2A6B", type: ShadingType.CLEAR }, borders: ALL_BORDERS }
                );
                return c;
              })()
            : emptyCell(CONTENT_W, { columnSpan: 6 }),
        ],
      }),

      // ── Row 1: Dispatch Control Number ────────────────────────────────────
      new TableRow({
        children: [
          labelCell("Dispatch Control Number:", C1 + C2),
          valueCell(dispatch.dispatch_number ?? "", C3 + C4 + C5 + C6, { columnSpan: 4 }),
        ],
      }),

      // ── Row 2: Date of Travel + Location ──────────────────────────────────
      new TableRow({
        children: [
          labelCell("Date of Travel", C1),
          valueCell(dateRange, C2),
          labelCell("□ Extended until ________ (___ days)", C3 + C4, { columnSpan: 2 }),
          emptyCell(C5 + C6, { columnSpan: 2 }),
        ],
      }),

      // ── Row 3: Location ────────────────────────────────────────────────────
      new TableRow({
        children: [
          labelCell("Location of travel:", C1),
          valueCell(location, C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
        ],
      }),

      // ── Row 4: Engineers ───────────────────────────────────────────────────
      new TableRow({
        children: [
          labelCell("Engineer/s:", C1),
          valueCell(engineerNames, C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
        ],
      }),

      // ── Row 5: Technicians ─────────────────────────────────────────────────
      new TableRow({
        children: [
          labelCell("Technician/s:", C1),
          valueCell(technicianNames, C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
        ],
      }),

      // ── Instruments header ────────────────────────────────────────────────
      new TableRow({
        children: [
          headerCell("Instruments:", IW),
          headerCell("Instrument Code / Brand & Model", IW),
          headerCell("Before Travel (Y/N)", IW),
          headerCell("Onsite / Field (Y/N)", IW),
          headerCell("After Travel (Y/N)", IW),
          headerCell("Remarks", CONTENT_W - IW * 5),
        ],
      }),

      // ── Instrument rows ────────────────────────────────────────────────────
      ...instrumentRows,

      // ── Company ────────────────────────────────────────────────────────────
      new TableRow({
        children: [
          labelCell("Company:", C1),
          valueCell(dispatch.company_name ?? "", C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
        ],
      }),

      // ── Contact ────────────────────────────────────────────────────────────
      new TableRow({
        children: [
          labelCell("Contact Person / Contact Information:", C1 + C2, { columnSpan: 2 }),
          valueCell(dispatch.contact_info ?? "", C3 + C4 + C5 + C6, { columnSpan: 4 }),
        ],
      }),

      // ── Transport ─────────────────────────────────────────────────────────
      transportRow,

      // ── Other Travel Details ───────────────────────────────────────────────
      new TableRow({
        children: [
          labelCell("Other Travel Details:", C1),
          valueCell(dispatch.notes ?? "", C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
        ],
      }),

      // ── Itinerary header ──────────────────────────────────────────────────
      new TableRow({
        children: [
          headerCell("Travel Itinerary:", IW1 + IW2),
          headerCell("Per Diem", IW3 + IW4 + IW5 + IW6),
          headerCell("Time of Travel (00:00 to 00:00)", IW7),
          headerCell("Working/Productive Hours (00:00 to 00:00)", IW8),
          headerCell("Overtime hours (For offset)", IW9),
          headerCell("Overtime hours (For billing)", IW10),
        ],
      }),
      new TableRow({
        children: [
          headerCell("Date", IW1),
          headerCell("Accommodation", IW2),
          headerCell("B", IW3),
          headerCell("L", IW4),
          headerCell("D", IW5),
          emptyCell(IW6 + IW7 + IW8 + IW9 + IW10, { columnSpan: 5 }),
        ],
      }),

      // ── Itinerary rows ─────────────────────────────────────────────────────
      ...itinRows,

      // ── Machines header ────────────────────────────────────────────────────
      new TableRow({
        children: [
          headerCell("Machines to be Tested:", MW1 + MW2, { columnSpan: 2 }),
          emptyCell(MW3 + MW4 + MW5 + MW6 + MW7, { columnSpan: 5 }),
        ],
      }),
      new TableRow({
        children: [
          headerCell("TAM No.", MW1),
          headerCell("MACHINES", MW2),
          headerCell("BRAND", MW3),
          headerCell("MODEL", MW4),
          headerCell("Serial Number of Unit", MW5),
          headerCell("Date of Test", MW6),
          headerCell("Status (Y/N)", MW7),
        ],
      }),

      // ── Machine rows ───────────────────────────────────────────────────────
      ...machineRows,

      // ── Remarks ────────────────────────────────────────────────────────────
      new TableRow({
        children: [
          labelCell("Remarks / Observations:", C1 + C2 + C3),
          labelCell("Notes:", C4 + C5 + C6, { columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          valueCell(dispatch.remarks_observation ?? "", C1 + C2 + C3, { columnSpan: 3 }),
          valueCell("", C4 + C5 + C6, { columnSpan: 3 }),
        ],
      }),

      // ── Signature block ────────────────────────────────────────────────────
      new TableRow({
        children: [
          cell([
            new Paragraph({ children: [txt("Approved by:", { bold: true })], spacing: { before: 0, after: 60 } }),
            new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("DR. ARTHUR L. FAJARDO", { bold: true })], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("AMTEC Director")], spacing: { before: 0, after: 0 } }),
          ], C1 + C2, { columnSpan: 2, borders: ALL_BORDERS }),
          cell([
            new Paragraph({ children: [txt("Checked by:", { bold: true })], spacing: { before: 0, after: 60 } }),
            new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("Signature over Name")], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("Test Coordinator")], spacing: { before: 0, after: 0 } }),
          ], C3 + C4, { columnSpan: 2, borders: ALL_BORDERS }),
          cell([
            new Paragraph({ children: [txt("Equipment checked by:", { bold: true })], spacing: { before: 0, after: 60 } }),
            new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("Signature over Name")], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("Test Coordinator")], spacing: { before: 0, after: 0 } }),
          ], C5, { borders: ALL_BORDERS }),
          cell([
            new Paragraph({ children: [txt("Encoded by:", { bold: true })], spacing: { before: 0, after: 60 } }),
            new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("Signature over Name")], spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [txt("Test Engineer")], spacing: { before: 0, after: 0 } }),
          ], C6, { borders: ALL_BORDERS }),
        ],
      }),

      // ── Footer note ───────────────────────────────────────────────────────
      new TableRow({
        children: [
          cell([
            new Paragraph({
              children: [txt('AMTEC-OP-F4, "Dispatch Form"', { size: 14 })],
              spacing: { before: 0, after: 0 },
            }),
          ], C1 + C2 + C3, { columnSpan: 3, borders: ALL_BORDERS }),
          cell([
            new Paragraph({
              children: [txt("Date of Revision: 11/20/2024", { size: 14 })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 0 },
            }),
          ], C4 + C5 + C6, { columnSpan: 3, borders: ALL_BORDERS }),
        ],
      }),
    ],
  });

  // Title row fix — recreate with proper color
  const titleRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: "DISPATCH FORM", bold: true, size: 28, color: "FFFFFF", font: "Arial" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        })],
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnSpan: 6,
        borders: ALL_BORDERS,
        shading: { fill: "1B2A6B", type: ShadingType.CLEAR },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
      }),
    ],
  });

  // Build clean table without broken title row logic
  const cleanTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [C1, C2, C3, C4, C5, C6],
    rows: [
      titleRow,
      // Dispatch number
      new TableRow({ children: [
        labelCell("Dispatch Control Number:", C1),
        valueCell(dispatch.dispatch_number ?? "", C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
      ]}),
      // Date of travel
      new TableRow({ children: [
        labelCell("Date of Travel", C1),
        valueCell(dateRange, C2),
        cell([new Paragraph({
          children: [txt("□ Extended until ____________ (    days)")],
          spacing: { before: 0, after: 0 },
        })], C3 + C4 + C5 + C6, { columnSpan: 4, borders: ALL_BORDERS }),
      ]}),
      // Location
      new TableRow({ children: [
        labelCell("Location of travel:", C1),
        valueCell(location, C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
      ]}),
      // Engineers
      new TableRow({ children: [
        labelCell("Engineer/s:", C1),
        valueCell(engineerNames, C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
      ]}),
      // Technicians
      new TableRow({ children: [
        labelCell("Technician/s:", C1),
        valueCell(technicianNames, C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
      ]}),
      // Instruments header
      new TableRow({ children: [
        headerCell("Instruments:", IW),
        headerCell("Instrument Code / Brand & Model", IW),
        headerCell("Before Travel (Y/N)", IW),
        headerCell("Onsite / Field (Y/N)", IW),
        headerCell("After Travel (Y/N)", IW),
        headerCell("Remarks", CONTENT_W - IW * 5),
      ]}),
      ...instrumentRows,
      // Company
      new TableRow({ children: [
        labelCell("Company:", C1),
        valueCell(dispatch.company_name ?? "", C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
      ]}),
      // Contact
      new TableRow({ children: [
        labelCell("Contact Person / Contact Information:", C1 + C2, { columnSpan: 2 }),
        valueCell(dispatch.contact_info ?? "", C3 + C4 + C5 + C6, { columnSpan: 4 }),
      ]}),
      // Transport
      transportRow,
      // Other details
      new TableRow({ children: [
        labelCell("Other Travel Details:", C1),
        valueCell(dispatch.notes ?? "", C2 + C3 + C4 + C5 + C6, { columnSpan: 5 }),
      ]}),
      // Itinerary header
      new TableRow({ children: [
        headerCell("Travel Itinerary:", IW1 + IW2, { columnSpan: 2 }),
        headerCell("Per Diem (Check if provided by Test Applicant, otherwise X, NA if not applicable)", IW3 + IW4 + IW5),
        headerCell("Time of Travel (00:00 to 00:00)", IW6 + IW7),
        headerCell("Working/Productive Hours (00:00 to 00:00)", IW8),
        headerCell("Overtime hours (For offset)", IW9),
        headerCell("(For billing)", IW10),
      ]}),
      new TableRow({ children: [
        headerCell("Date", IW1),
        headerCell("Accommodation", IW2),
        headerCell("B", IW3),
        headerCell("L", IW4),
        headerCell("D", IW5),
        emptyCell(IW6 + IW7 + IW8 + IW9 + IW10, { columnSpan: 5 }),
      ]}),
      ...itinRows,
      // Machines header
      new TableRow({ children: [
        cell([new Paragraph({
          children: [txt("Machines to be Tested:", { bold: true })],
          spacing: { before: 0, after: 0 },
        })], MW1 + MW2 + MW3 + MW4 + MW5 + MW6 + MW7, {
          columnSpan: 7,
          shading: { fill: "D9D9D9", type: ShadingType.CLEAR },
          borders: ALL_BORDERS,
        }),
      ]}),
      new TableRow({ children: [
        headerCell("TAM No.", MW1),
        headerCell("MACHINES", MW2),
        headerCell("BRAND", MW3),
        headerCell("MODEL", MW4),
        headerCell("Serial Number of Unit", MW5),
        headerCell("Date of Test", MW6),
        headerCell("Status (Y/N)", MW7),
      ]}),
      ...machineRows,
      // Remarks
      new TableRow({ children: [
        labelCell("Remarks / Observations:", C1 + C2 + C3, { columnSpan: 3 }),
        labelCell("Notes:", C4 + C5 + C6, { columnSpan: 3 }),
      ]}),
      new TableRow({ children: [
        valueCell(dispatch.remarks_observation ?? "", C1 + C2 + C3, { columnSpan: 3 }),
        valueCell("", C4 + C5 + C6, { columnSpan: 3 }),
      ]}),
      // Signatures
      new TableRow({ children: [
        cell([
          new Paragraph({ children: [txt("Approved by:", { bold: true })], spacing: { before: 0, after: 40 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("DR. ARTHUR L. FAJARDO", { bold: true })], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("AMTEC Director")], spacing: { before: 0, after: 0 } }),
        ], C1 + C2, { columnSpan: 2, borders: ALL_BORDERS }),
        cell([
          new Paragraph({ children: [txt("Checked by:", { bold: true })], spacing: { before: 0, after: 40 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Signature over Name")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Test Coordinator")], spacing: { before: 0, after: 0 } }),
        ], C3 + C4, { columnSpan: 2, borders: ALL_BORDERS }),
        cell([
          new Paragraph({ children: [txt("Equipment checked by:", { bold: true })], spacing: { before: 0, after: 40 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Signature over Name")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Test Coordinator")], spacing: { before: 0, after: 0 } }),
        ], C5, { borders: ALL_BORDERS }),
        cell([
          new Paragraph({ children: [txt("Encoded by:", { bold: true })], spacing: { before: 0, after: 40 } }),
          new Paragraph({ children: [txt("")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Signature over Name")], spacing: { before: 0, after: 0 } }),
          new Paragraph({ children: [txt("Test Engineer")], spacing: { before: 0, after: 0 } }),
        ], C6, { borders: ALL_BORDERS }),
      ]}),
      // Footer
      new TableRow({ children: [
        cell([new Paragraph({
          children: [txt('AMTEC-OP-F4, "Dispatch Form"', { size: 14 })],
          spacing: { before: 0, after: 0 },
        })], C1 + C2 + C3, { columnSpan: 3, borders: ALL_BORDERS }),
        cell([new Paragraph({
          children: [txt("Date of Revision: 11/20/2024", { size: 14 })],
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 0 },
        })], C4 + C5 + C6, { columnSpan: 3, borders: ALL_BORDERS }),
      ]}),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children: [cleanTable as unknown as Paragraph],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
