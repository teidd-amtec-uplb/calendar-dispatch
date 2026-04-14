import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, requireRole } from "@/lib/auth/requireAccess";

// ─── Status helper ───────────────────────────────────────────────────────────
function computeStatus(dateFrom: string | null, dateTo: string | null): string {
  if (!dateFrom || !dateTo) return "Pending";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  if (today < from) return "Scheduled";
  if (today > to) return "Done";
  return "Ongoing";
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const { data: dispatch, error } = await supabaseAdmin
    .from("dispatches")
    .select(`
      *,
      dispatch_assignments ( id, staff_id, profile_id, assignment_type, is_override, override_reason, staff ( full_name, initials, designation ) ),
      dispatch_instruments ( * ),
      dispatch_itinerary ( * ),
      dispatch_machines ( * )
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!dispatch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ dispatch });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "admin_scheduler", "AMaTS");
  if (!auth.ok) return auth.response;

  const user = auth.data.user;
  const { id } = await params;
  const body = await req.json();

  const {
    date_from, date_to, company_name, contact_person, contact_number,
    transport_mode, transport_other_text, notes,
    remarks_observation, testing_location, type,
    lead_engineer_id, assistant_engineer_ids = [], technician_ids = [],
    instruments, machines,
  } = body;

  // ── Fetch old dispatch for status comparison ────────────────────────────────
  const { data: oldDispatch } = await supabaseAdmin
    .from("dispatches")
    .select("status, date_from, date_to")
    .eq("id", id)
    .single();

  const oldStatus = oldDispatch?.status ?? "Pending";

  // ── Compute new status ──────────────────────────────────────────────────────
  let newStatus = computeStatus(date_from, date_to);

  // If dates changed after being Scheduled → Re-scheduled
  if (
    oldStatus === "Scheduled" &&
    oldDispatch &&
    (oldDispatch.date_from !== date_from || oldDispatch.date_to !== date_to)
  ) {
    newStatus = "Re-scheduled";
  }

  // ── Update main dispatch record ──────────────────────────────────────────────
  const { error: updateErr } = await supabaseAdmin
    .from("dispatches")
    .update({
      date_from,
      date_to,
      start_date: date_from,
      end_date: date_to,
      company_name,
      contact_person: contact_person ?? null,
      contact_number: contact_number ?? null,
      contact_info: [contact_person, contact_number].filter(Boolean).join(" - ") || null,
      transport_mode,
      transport_other_text,
      notes,
      remarks_observation,
      testing_location,
      type,
      location: company_name,
      status: newStatus,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // ── Status history (if changed) ─────────────────────────────────────────────
  if (oldStatus !== newStatus) {
    await supabaseAdmin.from("dispatch_status_history").insert({
      dispatch_id: id,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: user.id,
      remarks: "Dispatch updated",
    });
  }

  // ── Replace assignments (unified) ───────────────────────────────────────────
  await supabaseAdmin.from("dispatch_assignments").delete().eq("dispatch_id", id);

  const assignments = [
    ...(lead_engineer_id ? [{ dispatch_id: id, staff_id: lead_engineer_id, assignment_type: "lead_engineer" }] : []),
    ...assistant_engineer_ids.map((sid: string) => ({ dispatch_id: id, staff_id: sid, assignment_type: "assistant_engineer" })),
    ...technician_ids.map((sid: string) => ({ dispatch_id: id, staff_id: sid, assignment_type: "technician" })),
  ];

  if (assignments.length > 0) {
    const { error: assignErr } = await supabaseAdmin
      .from("dispatch_assignments")
      .insert(assignments);
    if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 });
  }

  // ── Replace instruments (only if provided in body) ───────────────────────────
  if (instruments !== undefined) {
    await supabaseAdmin.from("dispatch_instruments").delete().eq("dispatch_id", id);
    if (instruments.length > 0) {
      const { error: instErr } = await supabaseAdmin
        .from("dispatch_instruments")
        .insert(
          instruments.map((inst: any) => ({
            dispatch_id: id,
            instrument_name: inst.instrument_name,
            code_brand_model: inst.code_brand_model,
            before_travel: inst.before_travel,
            remarks: inst.remarks,
          }))
        );
      if (instErr) return NextResponse.json({ error: instErr.message }, { status: 500 });
    }
  }

  // ── Replace machines (only if provided in body) ──────────────────────────────
  if (machines !== undefined) {
    await supabaseAdmin.from("dispatch_machines").delete().eq("dispatch_id", id);
    if (machines.length > 0) {
      const { error: machErr } = await supabaseAdmin
        .from("dispatch_machines")
        .insert(
          machines.map((m: any) => ({
            dispatch_id: id,
            tam_no: m.tam_no,
            machine: m.machine,
            brand: m.brand,
            model: m.model,
            serial_no: m.serial_no,
            date_of_test: m.date_of_test || null,
            status: m.status || null,
          }))
        );
      if (machErr) return NextResponse.json({ error: machErr.message }, { status: 500 });
    }
  }

  // ── Fetch and return updated dispatch ────────────────────────────────────────
  const { data: dispatch, error: fetchErr } = await supabaseAdmin
    .from("dispatches")
    .select(`
      *,
      dispatch_assignments ( id, staff_id, profile_id, assignment_type, is_override, override_reason, staff ( full_name, initials, designation ) ),
      dispatch_instruments ( * ),
      dispatch_itinerary ( * ),
      dispatch_machines ( * )
    `)
    .eq("id", id)
    .single();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  return NextResponse.json({ dispatch });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "admin_scheduler", "AMaTS");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const { error } = await supabaseAdmin.from("dispatches").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
