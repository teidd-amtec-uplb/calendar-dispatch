// app/api/public/amats-sessions/route.ts
// Public endpoint — no auth required. Returns AMaTS sessions for the calendar.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("amats_sessions")
    .select(`
      id,
      session_number,
      machine,
      machine_name_or_code,
      date_from,
      date_to,
      status,
      amats_session_tests ( id, test_name ),
      amats_session_assignments (
        id,
        assignment_type,
        staff:staff_id ( id, full_name, initials )
      )
    `)
    .order("date_from", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessions: data ?? [] });
}
