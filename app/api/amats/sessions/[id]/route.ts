// app/api/amats/sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, requireRole } from "@/lib/auth/requireAccess";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await getAuthUser(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("amats_sessions")
    .select(`
      *,
      amats_session_tests ( id, test_name ),
      amats_session_assignments (
        id,
        assignment_type,
        staff:staff_id ( id, full_name, initials, designation )
      )
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ session: data });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireRole(req, "AMaTS", "admin_scheduler");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const {
    machine,
    machine_name_or_code,
    date_from,
    date_to,
    notes,
    selected_tests,
    engineers,
    technicians,
  } = body;

  // Update core session
  const { error: updateError } = await supabaseAdmin
    .from("amats_sessions")
    .update({
      machine,
      machine_name_or_code: machine_name_or_code || null,
      date_from,
      date_to,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Replace tests
  await supabaseAdmin.from("amats_session_tests").delete().eq("session_id", id);
  if (selected_tests && selected_tests.length > 0) {
    await supabaseAdmin.from("amats_session_tests").insert(
      selected_tests.map((t: string) => ({ session_id: id, test_name: t }))
    );
  }

  // Replace assignments
  await supabaseAdmin.from("amats_session_assignments").delete().eq("session_id", id);
  const allAssignments = [
    ...(engineers || []).map((e: { staff_id: string }) => ({
      session_id: id,
      staff_id: e.staff_id,
      assignment_type: "test_engineer",
    })),
    ...(technicians || []).map((t: { staff_id: string }) => ({
      session_id: id,
      staff_id: t.staff_id,
      assignment_type: "test_technician",
    })),
  ];
  if (allAssignments.length > 0) {
    await supabaseAdmin.from("amats_session_assignments").insert(allAssignments);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireRole(req, "AMaTS", "admin_scheduler");
  if (!auth.ok) return auth.response;

  const { error } = await supabaseAdmin
    .from("amats_sessions")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
