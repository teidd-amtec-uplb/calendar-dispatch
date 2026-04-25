// ─────────────────────────────────────────────────────────────────────────────
// lib/documents/generators/travel-request.ts
// Generates Travel Request DOCX — two carbon-copy forms side by side per page.
// One page per assigned person. Handles short/long trip approval blocks.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, WidthType, AlignmentType, VerticalAlign, SectionType,
} from "docx";

import {
  DocumentDispatchData, StaffMember,
  isLongTrip, formatDateRange, formatToday,
  extractPersonnel, formatMachineList, getTransportFields,
} from "../types";

// ── Layout constants ──────────────────────────────────────────────────────────
const PAGE_W    = 12240;
const PAGE_H    = 15840;
const MARGIN    = 720;
const CONTENT_W = PAGE_W - MARGIN * 2; // 10800
const GUTTER    = 360;
const FORM_W    = Math.floor((CONTENT_W - GUTTER) / 2); // ~5220
const LABEL_W   = 1600;
const VALUE_W   = FORM_W - LABEL_W;

// ── Border presets ────────────────────────────────────────────────────────────
const NO_B  = { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" };
const TH_B  = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const NO_BS = { top: NO_B, bottom: NO_B, left: NO_B, right: NO_B };
const TH_BS = { top: TH_B, bottom: TH_B, left: TH_B, right: TH_B };
const BOT_B = { top: NO_B, bottom: TH_B, left: NO_B, right: NO_B };

// ── Helpers ───────────────────────────────────────────────────────────────────
function t(text: string, opts?: { bold?: boolean; size?: number; underline?: boolean }): TextRun {
  return new TextRun({
    text,
    bold:      opts?.bold ?? false,
    size:      opts?.size ?? 22,
    font:      "Times New Roman",
    color:     "000000",
    underline: opts?.underline ? {} : undefined,
  });
}

function pp(
  runs: TextRun | TextRun[],
  opts?: { align?: typeof AlignmentType[keyof typeof AlignmentType]; after?: number }
): Paragraph {
  return new Paragraph({
    children: Array.isArray(runs) ? runs : [runs],
    alignment: opts?.align ?? AlignmentType.LEFT,
    spacing: { before: 0, after: opts?.after ?? 20, line: 240 },
  });
}

function emptyPara(): Paragraph {
  return new Paragraph({ children: [t("")], spacing: { before: 0, after: 20, line: 240 } });
}

function tc(
  children: Paragraph[],
  width: number,
  opts?: { borders?: any; span?: number; ml?: number }
): TableCell {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    borders: opts?.borders ?? NO_BS,
    columnSpan: opts?.span,
    margins: { top: 0, bottom: 0, left: opts?.ml ?? 80, right: 80 },
    verticalAlign: VerticalAlign.TOP,
  });
}

function emptyTR(width: number): TableRow {
  return new TableRow({
    children: [tc([emptyPara()], width, { span: 2, borders: NO_BS })],
  });
}

function fieldRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      tc([pp(t(label, { size: 17 }))], LABEL_W, { borders: NO_BS, ml: 0 }),
      tc([pp(t(value, { size: 17 }))], VALUE_W, { borders: BOT_B }),
    ],
  });
}

// ── Build one complete form table (single column, FORM_W wide) ────────────────
function buildFormTable(
  person: StaffMember & { isLead: boolean },
  dispatch: DocumentDispatchData,
  longTrip: boolean
): Table {
  const tm      = dispatch.transport_mode ?? "";
  const colV    = (tm === "college_vehicle"        ? "☑" : "☐") + " College Vehicle";
  const pubV    = (tm === "public_conveyance"       ? "☑" : "☐") + " Public Conveyance";
  const prvV    = (tm === "test_applicant_vehicle"  ? "☑" : "☐") + " Test Applicant Vehicle";
  const machines = formatMachineList(dispatch.dispatch_machines ?? []);
  const purpose  = `Testing of ${machines || "Agricultural Machinery"} in accordance with PNS/PAES`;
  const dateRange = formatDateRange(dispatch.date_from, dispatch.date_to);
  const today    = formatToday();
  const location = dispatch.testing_location || dispatch.company_name || "";

  // Approval block rows
  const approvalRows: TableRow[] = longTrip
    ? [
        new TableRow({ children: [tc([pp(t("NOTED BY:", { bold: true, size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
        emptyTR(FORM_W), emptyTR(FORM_W),
        new TableRow({ children: [tc([pp(t("ARTHUR L. FAJARDO, Ph.D.", { bold: true, size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
        new TableRow({ children: [tc([pp(t("Director, AMTEC", { size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
        emptyTR(FORM_W),
        new TableRow({ children: [tc([pp(t("APPROVED BY:", { bold: true, size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
        emptyTR(FORM_W), emptyTR(FORM_W),
        new TableRow({ children: [tc([pp(t("MARION LUX Y. CASTRO", { bold: true, size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
        new TableRow({ children: [tc([pp(t(person.isLead ? "Officer-in-charge, CEAT" : "OIC - Dean, CEAT", { size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
      ]
    : [
        new TableRow({ children: [tc([pp(t("APPROVED:", { bold: true, size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
        emptyTR(FORM_W), emptyTR(FORM_W),
        new TableRow({ children: [tc([pp(t("ARTHUR L. FAJARDO, Ph.D.", { bold: true, size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
        new TableRow({ children: [tc([pp(t("Director, AMTEC", { size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
      ];

  return new Table({
    width: { size: FORM_W, type: WidthType.DXA },
    columnWidths: [LABEL_W, VALUE_W],
    borders: { top: NO_B, bottom: NO_B, left: NO_B, right: NO_B, insideH: NO_B, insideV: NO_B },
    rows: [
      // ── University header ───────────────────────────────────────────────
      new TableRow({ children: [tc([
        pp(t("University of the Philippines Los Baños", { bold: true, size: 18 }), { align: AlignmentType.CENTER, after: 0 }),
        pp(t("College, Laguna", { bold: true, size: 18 }), { align: AlignmentType.CENTER }),
      ], FORM_W, { span: 2, borders: TH_BS })] }),

      emptyTR(FORM_W),

      // ── Initials, dispatch no, date ─────────────────────────────────────
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W, { borders: NO_BS }),
        tc([
          pp(t(`${person.initials}  ${dispatch.dispatch_number ?? ""}`, { size: 17 })),
          pp(t("TR. NO.", { size: 16 })),
          pp(t(today, { size: 17 })),
          pp(t("Date", { size: 16 })),
        ], VALUE_W, { borders: NO_BS }),
      ]}),

      emptyTR(FORM_W),

      // ── Form fields ─────────────────────────────────────────────────────
      fieldRow("Name               :", person.full_name),
      fieldRow("Designation     :", person.designation),
      fieldRow("Date of Travel  :", dateRange),
      fieldRow("Destination      :", location),
      fieldRow("Purpose of Travel:", purpose),
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W, { borders: NO_BS }),
        tc([pp(t(machines, { size: 16 }))], VALUE_W, { borders: NO_BS }),
      ]}),

      emptyTR(FORM_W),
      fieldRow("Source of Fund:", ""),

      // ── Transport ───────────────────────────────────────────────────────
      new TableRow({ children: [
        tc([pp(t("Transportation  :", { size: 17 }))], LABEL_W, { borders: NO_BS, ml: 0 }),
        tc([pp(t(colV, { size: 17 }))], VALUE_W, { borders: NO_BS }),
      ]}),
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W, { borders: NO_BS }),
        tc([pp(t(pubV, { size: 17 }))], VALUE_W, { borders: NO_BS }),
      ]}),
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W, { borders: NO_BS }),
        tc([pp(t(prvV, { size: 17 }))], VALUE_W, { borders: NO_BS }),
      ]}),

      // ── Expected Time of Arrival ────────────────────────────────────────
      new TableRow({ children: [tc([pp(t("Expected Time of Arrival", { bold: true, size: 17 }))], FORM_W, { span: 2, borders: NO_BS })] }),
      fieldRow("AT Destination       :", ""),
      fieldRow("FROM Destination :", ""),

      emptyTR(FORM_W),

      // ── Approval block ──────────────────────────────────────────────────
      ...approvalRows,

      // ── Dashed divider ──────────────────────────────────────────────────
      new TableRow({ children: [tc([
        pp(t("─".repeat(72), { size: 14 }), { align: AlignmentType.CENTER }),
      ], FORM_W, { span: 2, borders: NO_BS })] }),

      // ── Certification stub ──────────────────────────────────────────────
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W, { borders: NO_BS }),
        tc([pp(t("Date", { size: 17 }))], VALUE_W, { borders: NO_BS }),
      ]}),

      new TableRow({ children: [tc([pp([
        t("This is to certify that ", { size: 17 }),
        t(person.full_name, { bold: true, size: 17, underline: true }),
        t(" was here in ______________________________", { size: 17 }),
      ])], FORM_W, { span: 2, borders: NO_BS })] }),

      emptyTR(FORM_W),

      new TableRow({ children: [tc([
        pp(t("(name and address of agency)", { size: 16 }), { align: AlignmentType.CENTER }),
      ], FORM_W, { span: 2, borders: NO_BS })] }),

      new TableRow({ children: [
        tc([pp(t("on", { size: 17 }))], 300, { borders: NO_BS, ml: 0 }),
        tc([emptyPara()], 2000, { borders: BOT_B }),
        tc([pp(t("in connection with", { size: 17 }))], FORM_W - 2300, { borders: NO_BS }),
      ]}),

      new TableRow({ children: [
        tc([emptyPara()], 300, { borders: NO_BS }),
        tc([pp(t("(date of visit)", { size: 16 }), { align: AlignmentType.CENTER })], 2000, { borders: NO_BS }),
        tc([emptyPara()], FORM_W - 2300, { borders: NO_BS }),
      ]}),

      emptyTR(FORM_W),

      new TableRow({ children: [tc([emptyPara()], FORM_W, { span: 2, borders: BOT_B })] }),
      new TableRow({ children: [tc([
        pp(t("(nature of business)", { size: 16 }), { align: AlignmentType.CENTER }),
      ], FORM_W, { span: 2, borders: NO_BS })] }),

      emptyTR(FORM_W),

      new TableRow({ children: [tc([pp(
        t("This certification is issued in accordance with the Joint COA-DBM Circular 86-1, Nov. 12, 1986.", { size: 16 })
      )], FORM_W, { span: 2, borders: NO_BS })] }),

      emptyTR(FORM_W),

      // ── Signature lines ─────────────────────────────────────────────────
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W + 300, { borders: NO_BS }),
        tc([emptyPara()], VALUE_W - 300, { borders: BOT_B }),
      ]}),
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W + 300, { borders: NO_BS }),
        tc([pp(t("Signature over printed Name", { size: 16 }))], VALUE_W - 300, { borders: NO_BS }),
      ]}),
      emptyTR(FORM_W),
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W + 300, { borders: NO_BS }),
        tc([emptyPara()], VALUE_W - 300, { borders: BOT_B }),
      ]}),
      new TableRow({ children: [
        tc([emptyPara()], LABEL_W + 300, { borders: NO_BS }),
        tc([pp(t("Designation", { size: 16 }))], VALUE_W - 300, { borders: NO_BS }),
      ]}),
    ],
  });
}

// ── One page: two identical copies side by side ───────────────────────────────
function buildPersonPage(
  person: StaffMember & { isLead: boolean },
  dispatch: DocumentDispatchData,
  longTrip: boolean
): Table {
  const leftForm  = buildFormTable(person, dispatch, longTrip);
  const rightForm = buildFormTable(person, dispatch, longTrip);

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [FORM_W, GUTTER, FORM_W],
    borders: { top: NO_B, bottom: NO_B, left: NO_B, right: NO_B, insideH: NO_B, insideV: NO_B },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [leftForm],
            width: { size: FORM_W, type: WidthType.DXA },
            borders: { top: NO_B, bottom: NO_B, left: NO_B, right: NO_B },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlign.TOP,
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("")] })],
            width: { size: GUTTER, type: WidthType.DXA },
            borders: { top: NO_B, bottom: NO_B, left: NO_B, right: NO_B },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          }),
          new TableCell({
            children: [rightForm],
            width: { size: FORM_W, type: WidthType.DXA },
            borders: { top: NO_B, bottom: NO_B, left: NO_B, right: NO_B },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlign.TOP,
          }),
        ],
      }),
    ],
  });
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateTravelRequest(dispatch: DocumentDispatchData): Promise<Buffer> {
  const rawPersonnel = extractPersonnel(dispatch);
  const longTrip     = isLongTrip(dispatch.date_from, dispatch.date_to);

  const personnel = rawPersonnel.map(p => ({
    ...p,
    isLead: p.assignment_type === "lead_engineer",
  }));

  // One section per person = one page per person
  const sections = personnel.map((person, idx) => ({
    properties: {
      page: {
        size:   { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
      ...(idx > 0 ? { type: SectionType.NEXT_PAGE } : {}),
    },
    children: [buildPersonPage(person, dispatch, longTrip) as unknown as Paragraph],
  }));

  const doc = new Document({ sections });
  return Packer.toBuffer(doc);
}
