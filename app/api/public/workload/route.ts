import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Live status recomputation ───────────────────────────────────────────────
const MANUAL_STATUSES = new Set(["Re-scheduled", "Cancelled"]);

function computeLiveStatus(dateFrom: string | null, dateTo: string | null, stored: string): string {
  if (MANUAL_STATUSES.has(stored)) return stored;
  if (!dateFrom || !dateTo) return stored || "Pending";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  if (today < from) return "Scheduled";
  if (today > to) return "Done";
  return "Ongoing";
}

function toDateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

// Public endpoint — no auth required
// Returns per-person workload + full dispatch list for the month
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const from = `${monthStr}-01`;
  const to = `${monthStr}-${new Date(year, month, 0).getDate()}`;

  // Get all active staff (engineers + technicians) from the staff table
  const { data: staffList, error: staffErr } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, surname, initials, designation, role")
    .in("role", ["engineer", "technician"])
    .eq("active", true)
    .order("full_name");

  if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 500 });

  // Get all dispatches overlapping this month with full details
  const { data: dispatches, error: dispErr } = await supabaseAdmin
    .from("dispatches")
    .select(`
      id,
      dispatch_number,
      company_name,
      date_from,
      date_to,
      status,
      transport_mode,
      testing_location,
      location,
      contact_person,
      contact_number,
      contact_info,
      type,
      dispatch_assignments (
        id,
        staff_id,
        assignment_type,
        staff ( id, full_name, initials )
      ),
      dispatch_machines (
        id, tam_no, machine, brand, model
      )
    `)
    .lte("date_from", to)
    .gte("date_to", from)
    .order("date_from", { ascending: true });

  if (dispErr) return NextResponse.json({ error: dispErr.message }, { status: 500 });

  // Get all AMaTS sessions overlapping this month with assigned staff.
  const { data: amatsSessions, error: amatsErr } = await supabaseAdmin
    .from("amats_sessions")
    .select(`
      id,
      session_number,
      machine,
      machine_name_or_code,
      date_from,
      date_to,
      status,
      amats_session_assignments (
        id,
        staff_id,
        assignment_type,
        staff ( id, full_name, initials )
      )
    `)
    .lte("date_from", to)
    .gte("date_to", from)
    .order("date_from", { ascending: true });

  if (amatsErr) return NextResponse.json({ error: amatsErr.message }, { status: 500 });

  // Live-compute statuses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveDispatches = (dispatches ?? []).map((d: any) => ({
    ...d,
    status: computeLiveStatus(d.date_from, d.date_to, d.status),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveAmatsSessions = (amatsSessions ?? []).map((s: any) => ({
    ...s,
    date_from: toDateOnly(s.date_from),
    date_to: toDateOnly(s.date_to),
    status: computeLiveStatus(toDateOnly(s.date_from), toDateOnly(s.date_to), s.status),
  }));

  // Build workload per person
  const workload = (staffList ?? []).map((person) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const myDispatches = liveDispatches.filter((d: any) =>
      (d.dispatch_assignments as { staff_id: string | null }[])?.some(
        (a) => a.staff_id === person.id
      )
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const myAmatsSessions = liveAmatsSessions.filter((s: any) =>
      (s.amats_session_assignments as { staff_id: string | null }[])?.some(
        (a) => a.staff_id === person.id
      )
    );

    // Count total dispatch days this month
    const daysInMonth = new Date(year, month, 0).getDate();
    let travelDays = 0;
    for (const d of myDispatches) {
      if (!d.date_from || !d.date_to) continue;
      const dFrom = new Date(d.date_from + "T00:00:00");
      const dTo = new Date(d.date_to + "T00:00:00");
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        if (date >= dFrom && date <= dTo) travelDays++;
      }
    }

    // Count distinct machines across all dispatches
    let machineCount = 0;
    for (const d of myDispatches) {
      machineCount += ((d.dispatch_machines as unknown[]) ?? []).length;
    }
    machineCount += myAmatsSessions.length;

    return {
      id: person.id,
      full_name: person.full_name,
      initials: person.initials,
      role: person.role,
      dispatch_count: myDispatches.length,
      travel_days: travelDays,
      machine_count: machineCount,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatches: myDispatches.map((d: any) => ({
        id: d.id,
        dispatch_number: d.dispatch_number,
        company_name: d.company_name,
        testing_location: d.testing_location,
        location: d.location,
        type: d.type,
        date_from: d.date_from,
        date_to: d.date_to,
        status: d.status,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      amats_sessions: myAmatsSessions.map((s: any) => ({
        id: s.id,
        session_number: s.session_number,
        machine: s.machine,
        machine_name_or_code: s.machine_name_or_code,
        date_from: s.date_from,
        date_to: s.date_to,
        status: s.status,
      })),
    };
  });

  // Full dispatch list for the table (with all fields)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatchList = liveDispatches.map((d: any) => ({
    id: d.id,
    dispatch_number: d.dispatch_number,
    company_name: d.company_name,
    date_from: d.date_from,
    date_to: d.date_to,
    status: d.status,
    transport_mode: d.transport_mode,
    testing_location: d.testing_location,
    location: d.location,
    type: d.type,
    contact_person: d.contact_person ?? (typeof d.contact_info === "string" ? (d.contact_info as string).split(" - ")[0] : null),
    contact_number: d.contact_number ?? (typeof d.contact_info === "string" && (d.contact_info as string).includes(" - ") ? (d.contact_info as string).split(" - ")[1] : null),
    dispatch_assignments: d.dispatch_assignments,
    dispatch_machines: d.dispatch_machines,
  }));

  return NextResponse.json({ workload, dispatchList, amatsSessionList: liveAmatsSessions, year, month });
}
