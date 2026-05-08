import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireAccess";

// DELETE /api/staff/[id] — Soft delete a staff member by setting active to false
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "admin_scheduler", "AMaTS");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("staff")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
