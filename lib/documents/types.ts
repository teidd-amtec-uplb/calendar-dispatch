// ─────────────────────────────────────────────────────────────────────────────
// lib/documents/types.ts
// Shared types for all AMTEC document generators
// ─────────────────────────────────────────────────────────────────────────────

export interface StaffMember {
  staff_id: string;
  full_name: string;
  initials: string;
  designation: string;
  assignment_type: "lead_engineer" | "assistant_engineer" | "technician" | "intern";
}

export interface DispatchInstrument {
  instrument_name: string;
  code_brand_model?: string | null;
  before_travel?: string | null;
  onsite_field?: string | null;
  after_travel?: string | null;
  remarks?: string | null;
}

export interface DispatchMachine {
  tam_no?: string | null;
  machine?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_no?: string | null;
  date_of_test?: string | null;
  status?: string | null;
}

export interface DispatchItinerary {
  travel_date?: string | null;
  per_diem_accommodation?: string | null;
  per_diem_b?: string | null;
  per_diem_l?: string | null;
  per_diem_d?: string | null;
  time_of_travel?: string | null;
  working_hours?: string | null;
  overtime_offset?: string | null;
  overtime_billing?: string | null;
}

export interface DocumentDispatchData {
  // Core identifiers
  id: string;
  dispatch_number: string;

  // Dates
  date_from: string;
  date_to: string;

  // Location & company
  testing_location: string;
  company_name: string;
  contact_person?: string | null;
  contact_number?: string | null;
  contact_info?: string | null;

  // Transport
  transport_mode: string;
  transport_other_text?: string | null;

  // Notes
  notes?: string | null;
  remarks_observation?: string | null;

  // Extended trip
  is_extended?: boolean;
  extended_days?: number | null;

  // Type
  type?: string | null;

  // Status
  status?: string;

  // Related data
  dispatch_assignments: Array<{
    id: string;
    staff_id?: string | null;
    assignment_type: string;
    staff?: {
      full_name: string;
      initials: string;
      designation: string;
    } | null;
  }>;
  dispatch_instruments: DispatchInstrument[];
  dispatch_machines: DispatchMachine[];
  dispatch_itinerary: DispatchItinerary[];
}

// ── Derived helpers ───────────────────────────────────────────────────────────

/** Returns true if trip spans more than 1 calendar day */
export function isLongTrip(dateFrom: string, dateTo: string): boolean {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const diffMs = to.getTime() - from.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 1;
}

/** Formats a date range string: "January 8–9, 2026" or "January 8, 2026 – February 2, 2026" */
export function formatDateRange(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  if (dateFrom === dateTo) {
    return from.toLocaleDateString("en-PH", opts);
  }
  return `${from.toLocaleDateString("en-PH", opts)} – ${to.toLocaleDateString("en-PH", opts)}`;
}

/** Formats a single date: "January 8, 2026" */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

/** Today's date formatted */
export function formatToday(): string {
  return new Date().toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

/** Extracts ordered personnel list from dispatch assignments */
export function extractPersonnel(dispatch: DocumentDispatchData): StaffMember[] {
  const order = ["lead_engineer", "assistant_engineer", "technician", "intern"];
  const assignments = [...(dispatch.dispatch_assignments ?? [])];

  assignments.sort((a, b) => {
    return order.indexOf(a.assignment_type) - order.indexOf(b.assignment_type);
  });

  return assignments
    .filter(a => a.staff)
    .map(a => ({
      staff_id: a.staff_id ?? "",
      full_name: a.staff!.full_name,
      initials: a.staff!.initials,
      designation: a.assignment_type === "intern" ? "Intern" : a.staff!.designation,
      assignment_type: a.assignment_type as StaffMember["assignment_type"],
    }));
}

/** Formats machine list as a readable string for TR forms */
export function formatMachineList(machines: DispatchMachine[]): string {
  if (!machines.length) return "Testing of Agricultural Machinery";
  return machines
    .map(m => [m.machine, m.brand, m.model].filter(Boolean).join(" "))
    .join("; ");
}

/** Maps transport_mode to the TR checkbox fields */
export function getTransportFields(transportMode: string): {
  colVehicle: string;
  pubConveyance: string;
  privVehicle: string;
} {
  return {
    colVehicle:    transportMode === "college_vehicle"        ? "☑ College Vehicle"        : "☐ College Vehicle",
    pubConveyance: transportMode === "public_conveyance"      ? "☑ Public Conveyance"      : "☐ Public Conveyance",
    privVehicle:   transportMode === "test_applicant_vehicle" ? "☑ Test Applicant Vehicle" : "☐ Test Applicant Vehicle",
  };
}
