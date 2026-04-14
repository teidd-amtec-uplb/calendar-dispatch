import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireAccess";

const VALID_TYPES = [
  "field_scheduler", "amats_scheduler", "wfh", "meeting",
  "offset_leave", "half_day_morning", "half_day_afternoon",
  "holiday", "no_pasok", "scheduled",
  // legacy values kept for backwards compat
  "day_off", "scheduler", "email",
];

/**
 * GET /api/staff-events?year=2026&month=4
 * Public — returns all staff calendar events for a given month
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to   = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  const { data, error } = await supabaseAdmin
    .from("staff_calendar_events")
    .select("id, staff_id, event_date, event_type, notes")
    .gte("event_date", from)
    .lte("event_date", to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return as "events" with profile_id aliased to staff_id for backwards compat
  const events = (data ?? []).map(e => ({ ...e, profile_id: e.staff_id }));
  return NextResponse.json({ events });
}

/**
 * POST /api/staff-events
 * Admin/scheduler only — create or update a staff calendar event
 * Body: { profile_id, event_date, event_type, notes? }
 *   OR for bulk: { bulk: true, event_date, event_type, notes?, staff_ids?: string[] }
 *   (if staff_ids is omitted on bulk, applies to ALL active staff)
 */
export async function POST(req: Request) {
  const auth = await requireRole(req, "admin_scheduler", "AMaTS");
  if (!auth.ok) return auth.response;

  const body = await req.json();

  // ── Bulk mode ────────────────────────────────────────────────────────────────
  if (body.bulk) {
    const { event_date, event_type, notes, staff_ids, date_from, date_to, cells } = body;

    if (!event_type) {
      return NextResponse.json({ error: "event_type is required" }, { status: 400 });
    }
    
    // Clear/Delete bulk action
    if (event_type === "delete" || event_type === "clear") {
      if (cells && Array.isArray(cells) && cells.length > 0) {
        await Promise.all(cells.map(c => 
          supabaseAdmin.from("staff_calendar_events")
            .delete()
            .eq("staff_id", c.profile_id)
            .eq("event_date", c.event_date)
        ));
        return NextResponse.json({ success: true, count: cells.length });
      }
      return NextResponse.json({ error: "cells array required for bulk delete" }, { status: 400 });
    }

    if (!VALID_TYPES.includes(event_type)) {
      return NextResponse.json({ error: `Invalid event_type` }, { status: 400 });
    }

    let rows: any[] = [];
    
    if (cells && Array.isArray(cells)) {
      rows = cells.map(c => ({
        staff_id: c.profile_id,
        event_date: c.event_date,
        event_type,
        notes: notes ?? null,
        created_by: auth.data.user.id,
        updated_at: new Date().toISOString(),
      }));
    } else {
      // Legacy bulk processing logic
      let targetIds: string[] = staff_ids ?? [];
      if (targetIds.length === 0) {
        const { data: allStaff } = await supabaseAdmin.from("staff").select("id").eq("active", true);
        targetIds = (allStaff ?? []).map(s => s.id);
      }
      const dates: string[] = [];
      if (date_from && date_to) {
        const start = new Date(date_from + "T00:00:00");
        const end   = new Date(date_to   + "T00:00:00");
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${day}`);
        }
      } else if (event_date) {
        dates.push(event_date);
      } else {
        return NextResponse.json({ error: "cells array OR date_from+date_to required" }, { status: 400 });
      }

      rows = targetIds.flatMap(staff_id =>
        dates.map(dt => ({
          staff_id,
          event_date: dt,
          event_type,
          notes: notes ?? null,
          created_by: auth.data.user.id,
          updated_at: new Date().toISOString(),
        }))
      );
    }

    if (rows.length === 0) return NextResponse.json({ success: true, count: 0 });

    const { error } = await supabaseAdmin
      .from("staff_calendar_events")
      .upsert(rows, { onConflict: "staff_id,event_date" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, count: rows.length });
  }

  // ── Single event mode ────────────────────────────────────────────────────────
  const { profile_id, event_date, event_type, notes } = body;

  if (!profile_id || !event_date || !event_type) {
    return NextResponse.json({ error: "profile_id, event_date, and event_type are required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(event_type)) {
    return NextResponse.json({ error: `Invalid event_type. Must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("staff_calendar_events")
    .upsert(
      {
        staff_id: profile_id,   // profile_id from client = staff.id
        event_date,
        event_type,
        notes: notes ?? null,
        created_by: auth.data.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id,event_date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

/**
 * DELETE /api/staff-events
 * Admin/scheduler only — remove a staff calendar event
 * Body: { profile_id, event_date }
 */
export async function DELETE(req: Request) {
  const auth = await requireRole(req, "admin_scheduler", "AMaTS");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { profile_id, event_date } = body;

  if (!profile_id || !event_date) {
    return NextResponse.json({ error: "profile_id and event_date are required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("staff_calendar_events")
    .delete()
    .eq("staff_id", profile_id)
    .eq("event_date", event_date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
