// app/api/amats/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, requireRole } from "@/lib/auth/requireAccess";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("amats_sessions")
    .select(`
      *,
      amats_session_tests ( test_name ),
      amats_session_assignments ( assignment_type, staff:staff_id ( id, full_name, initials, designation ) )
    `)
    .order("date_from", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "AMaTS", "admin_scheduler");
  if (!auth.ok) return auth.response;
  const user = auth.data.user;

  const body = await req.json();
  const {
    session_number,
    machine,
    machine_name_or_code,
    date_from,
    date_to,
    notes,
    selected_tests,     // string[]
    engineers,          // { staff_id: string }[]
    technicians,        // { staff_id: string }[]
  } = body;

  // Validate required fields
  if (!session_number || !machine || !date_from || !date_to) {
    return NextResponse.json(
      { error: "session_number, machine, date_from, and date_to are required" },
      { status: 400 }
    );
  }

  if (!selected_tests || selected_tests.length === 0) {
    return NextResponse.json(
      { error: "At least one test must be selected" },
      { status: 400 }
    );
  }

  // Insert session
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("amats_sessions")
    .insert({
      session_number,
      machine,
      machine_name_or_code: machine_name_or_code || null,
      date_from,
      date_to,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (sessionError) {
    if (sessionError.code === "23505") {
      return NextResponse.json(
        { error: "Session number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // Insert selected tests
  if (selected_tests.length > 0) {
    const testRows = selected_tests.map((test_name: string) => ({
      session_id: session.id,
      test_name,
    }));
    const { error: testsError } = await supabaseAdmin
      .from("amats_session_tests")
      .insert(testRows);
    if (testsError) {
      await supabaseAdmin.from("amats_sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: testsError.message }, { status: 500 });
    }
  }

  // Insert assignments (engineers)
  const allAssignments = [
    ...(engineers || []).map((e: { staff_id: string }) => ({
      session_id: session.id,
      staff_id: e.staff_id,
      assignment_type: "test_engineer",
    })),
    ...(technicians || []).map((t: { staff_id: string }) => ({
      session_id: session.id,
      staff_id: t.staff_id,
      assignment_type: "test_technician",
    })),
  ];

  if (allAssignments.length > 0) {
    const { error: assignError } = await supabaseAdmin
      .from("amats_session_assignments")
      .insert(allAssignments);
    if (assignError) {
      await supabaseAdmin.from("amats_sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ session }, { status: 201 });
}
