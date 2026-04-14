import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const body = await req.json();
  const { userId, full_name, role } = body;

  if (!userId || !full_name || !role) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const allowedRoles = ["engineer", "technician", "admin_scheduler", "AMaTS"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
    id: userId,
    full_name,
    role,
    active: false,
  });

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
