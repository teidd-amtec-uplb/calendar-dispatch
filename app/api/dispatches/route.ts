import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, requireRole } from "@/lib/auth/requireAccess";

// ─── Dispatch status helper ──────────────────────────────────────────────────
const MANUAL_STATUSES = new Set(["Re-scheduled", "Cancelled"]);

function computeStatus(dateFrom: string | null, dateTo: string | null, stored?: string): string {
  if (stored && MANUAL_STATUSES.has(stored)) return stored;
  if (!dateFrom || !dateTo) return stored || "Pending";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  if (today < from) return "Scheduled";
  if (today > to) return "Done";
  return "Ongoing";
}

// ─── GET: fetch all dispatches ────────────────────────────────────────────────
export async function GET(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth.ok) return auth.response;

  const { profile } = auth.data;
  const isManager = ["admin_scheduler", "AMaTS"].includes(profile.role);

  let query = supabaseAdmin
    .from("dispatches")
    .select(`
      id, dispatch_number, company_name, date_from, date_to,
      transport_mode, created_at, type, location, status, lab,
      contact_person, contact_number, testing_location, notes, created_by_role,
      dispatch_assignments ( id, staff_id, assignment_type, staff ( full_name ) ),
      dispatch_machines ( id, tam_no, machine, brand, model )
    `)
    .order("created_at", { ascending: false });

  if (!isManager) {
    // Non-managers only see dispatches they are assigned to
    const { data: assignments } = await supabaseAdmin
      .from("dispatch_assignments")
      .select("dispatch_id")
      .eq("profile_id", profile.id);

    const uniqueIds = [...new Set((assignments ?? []).map((r) => r.dispatch_id))];

    if (uniqueIds.length === 0) {
      return NextResponse.json({ dispatches: [], noAssignments: true });
    }

    query = query.in("id", uniqueIds);
  }

  const { data: dispatches, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Live-recompute statuses based on current date
  const liveDispatches = (dispatches ?? []).map((d: any) => ({
    ...d,
    status: computeStatus(d.date_from, d.date_to, d.status),
  }));

  return NextResponse.json({ dispatches: liveDispatches });
}


// ─── POST: create dispatch ────────────────────────────────────────────────────
export async function POST(req: Request) {
  const auth = await requireRole(req, "admin_scheduler", "AMaTS");
  if (!auth.ok) return auth.response;

  const user = auth.data.user;
  const body = await req.json();
  const {
    dispatch_number,
    date_from, date_to, company_name, contact_person, contact_number,
    transport_mode, transport_other_text, notes,
    remarks_observation, testing_location, type,
    lead_engineer_id, assistant_engineer_ids = [], technician_ids = [],
    instruments = [], machines = [],
  } = body;

  if (!dispatch_number?.trim()) {
    return NextResponse.json({ error: "Dispatch number is required (e.g. DIS-2026-0001)" }, { status: 400 });
  }

  if (!lead_engineer_id) {
    return NextResponse.json({ error: "Lead engineer is required" }, { status: 400 });
  }

  const status = computeStatus(date_from, date_to);

  // ── Insert dispatch ──────────────────────────────────────────────────────────
  const { data: dispatch, error: dispatchErr } = await supabaseAdmin
    .from("dispatches")
    .insert({
      created_by: user.id,
      created_by_role: auth.data.profile.role ?? null,
      type: type ?? "on_field",
      location: company_name,
      start_date: date_from,
      end_date: date_to,
      date_from,
      date_to,
      company_name,
      contact_person: contact_person ?? null,
      contact_number: contact_number ?? null,
      contact_info: [contact_person, contact_number].filter(Boolean).join(" - ") || null,
      transport_mode,
      transport_other_text,
      notes,
      remarks_observation,
      dispatch_number,
      testing_location,
      status,
      lab: auth.data.profile.lab ?? null,
    })
    .select()
    .single();

  if (dispatchErr || !dispatch) {
    if (dispatchErr?.message?.includes("dispatches_dispatch_number_key")) {
      return NextResponse.json({ error: `Dispatch number "${dispatch_number}" already exists. Please use a different number.` }, { status: 409 });
    }
    return NextResponse.json({ error: dispatchErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const dispatchId = dispatch.id;

  // ── Helper: rollback on error ────────────────────────────────────────────────
  async function rollback() {
    await supabaseAdmin.from("dispatches").delete().eq("id", dispatchId);
  }

  // ── Assignments (unified) ───────────────────────────────────────────────────
  const assignments = [
    { dispatch_id: dispatchId, staff_id: lead_engineer_id, assignment_type: "lead_engineer" },
    ...assistant_engineer_ids.map((id: string) => ({ dispatch_id: dispatchId, staff_id: id, assignment_type: "assistant_engineer" })),
    ...technician_ids.map((id: string) => ({ dispatch_id: dispatchId, staff_id: id, assignment_type: "technician" })),
  ];

  if (assignments.length > 0) {
    const { error: assignErr } = await supabaseAdmin
      .from("dispatch_assignments")
      .insert(assignments);
    if (assignErr) { await rollback(); return NextResponse.json({ error: assignErr.message }, { status: 500 }); }
  }

  // ── Instruments ──────────────────────────────────────────────────────────────
  if (instruments.length > 0) {
    const { error: instErr } = await supabaseAdmin
      .from("dispatch_instruments")
      .insert(
        instruments.map((inst: any) => ({
          dispatch_id: dispatchId,
          instrument_name: inst.instrument_name,
          code_brand_model: inst.code_brand_model,
          before_travel: inst.before_travel,
          remarks: inst.remarks,
        }))
      );
    if (instErr) { await rollback(); return NextResponse.json({ error: instErr.message }, { status: 500 }); }
  }

  // ── Machines ─────────────────────────────────────────────────────────────────
  if (machines.length > 0) {
    const { error: machErr } = await supabaseAdmin
      .from("dispatch_machines")
      .insert(
        machines.map((m: any) => ({
          dispatch_id: dispatchId,
          tam_no: m.tam_no,
          machine: m.machine,
          brand: m.brand,
          model: m.model,
          serial_no: m.serial_no,
          date_of_test: m.date_of_test || null,
          status: m.status || null,
        }))
      );
    if (machErr) { await rollback(); return NextResponse.json({ error: machErr.message }, { status: 500 }); }
  }

  // ── Initial status history ──────────────────────────────────────────────────
  await supabaseAdmin.from("dispatch_status_history").insert({
    dispatch_id: dispatchId,
    old_status: null,
    new_status: status,
    changed_by: user.id,
    remarks: "Dispatch created",
  });

  return NextResponse.json({ dispatch });
}
