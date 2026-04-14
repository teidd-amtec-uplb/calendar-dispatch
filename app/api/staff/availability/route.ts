import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/staff/availability?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&exclude_dispatch_id=...&exclude_session_id=...
 *
 * Returns unavailable staff IDs with the reason:
 *   - "conflict"  → already dispatched or in an AMaTS session on overlapping dates
 *   - "cooldown"  → dispatched within 7 days before date_from
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date_from = searchParams.get("date_from");
  const date_to = searchParams.get("date_to");
  const exclude_dispatch_id = searchParams.get("exclude_dispatch_id") ?? undefined;
  const exclude_session_id = searchParams.get("exclude_session_id") ?? undefined;

  if (!date_from || !date_to) {
    return NextResponse.json({ unavailable: {} });
  }

  // ── 1. Direct overlap: dispatches whose dates overlap [date_from, date_to] ──
  let overlapQuery = supabaseAdmin
    .from("dispatches")
    .select(`
      id, dispatch_number, date_from, date_to,
      dispatch_assignments ( staff_id, profile_id, assignment_type )
    `)
    .lte("date_from", date_to)
    .gte("date_to", date_from)
    .not("status", "in", '("Cancelled","Done")');

  if (exclude_dispatch_id) {
    overlapQuery = overlapQuery.neq("id", exclude_dispatch_id);
  }

  // ── 2. AMaTS session conflicts ─────────────────────────────────────────────
  let amatsQuery = supabaseAdmin
    .from("amats_sessions")
    .select(`
      id, session_number, date_from, date_to,
      amats_session_assignments ( staff_id )
    `)
    .lte("date_from", date_to)
    .gte("date_to", date_from)
    .not("status", "in", '("Cancelled","Done")');

  if (exclude_session_id) {
    amatsQuery = amatsQuery.neq("id", exclude_session_id);
  }

  const [
    { data: overlapping, error: overlapErr },
    { data: amatsSessions, error: amatsErr },
  ] = await Promise.all([overlapQuery, amatsQuery]);

  if (overlapErr) return NextResponse.json({ error: overlapErr.message }, { status: 500 });
  if (amatsErr) return NextResponse.json({ error: amatsErr.message }, { status: 500 });

  const unavailable: Record<string, { reason: "conflict" | "cooldown"; dispatch_number: string; until?: string }> = {};

  // Mark conflict staff from overlapping dispatches
  for (const d of overlapping ?? []) {
    const assignments: any[] = d.dispatch_assignments ?? [];
    for (const a of assignments) {
      if (!a.staff_id && !a.profile_id) continue;
      const matchId = a.staff_id ?? a.profile_id;
      if (!["engineer", "lead_engineer", "assistant_engineer", "technician"].includes(a.assignment_type)) continue;
      unavailable[matchId] = { reason: "conflict", dispatch_number: d.dispatch_number };
    }
  }

  // Mark conflict staff from overlapping AMaTS sessions
  for (const s of amatsSessions ?? []) {
    const assignments: any[] = s.amats_session_assignments ?? [];
    for (const a of assignments) {
      if (!a.staff_id) continue;
      if (unavailable[a.staff_id]?.reason === "conflict") continue;
      unavailable[a.staff_id] = { reason: "conflict", dispatch_number: s.session_number };
    }
  }

  return NextResponse.json({ unavailable });
}
