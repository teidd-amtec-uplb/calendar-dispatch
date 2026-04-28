import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireAccess";

// POST /api/staff — Add a new engineer or technician
export async function POST(req: Request) {
  const auth = await requireRole(req, "admin_scheduler", "AMaTS");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { full_name, surname, initials, designation, email, role } = body;

  if (!full_name || !surname || !initials || !role) {
    return NextResponse.json(
      { error: "full_name, surname, initials, and role are required." },
      { status: 400 }
    );
  }

  if (!["engineer", "technician"].includes(role)) {
    return NextResponse.json(
      { error: "Role must be 'engineer' or 'technician'." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("staff")
    .insert({
      full_name: full_name.trim(),
      surname: surname.trim(),
      initials: initials.trim().toUpperCase(),
      designation: designation?.trim() || null,
      email: email?.trim() || null,
      role,
      active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data }, { status: 201 });
}
