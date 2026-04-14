import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AuthResult = {
  user: { id: string; email?: string };
  profile: { id: string; full_name: string; role: string; active: boolean; lab: string | null; initials: string | null };
};

/**
 * Extract user from Bearer token. Returns null + error response if invalid.
 */
export async function getAuthUser(req: Request): Promise<
  { ok: true; data: AuthResult } | { ok: false; response: NextResponse }
> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user) {
    return { ok: false, response: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, active, lab, initials")
    .eq("id", userData.user.id)
    .single();

  if (profileErr || !profile) {
    return { ok: false, response: NextResponse.json({ error: "Profile not found" }, { status: 401 }) };
  }

  if (!profile.active) {
    return { ok: false, response: NextResponse.json({ error: "Account is inactive" }, { status: 403 }) };
  }

  return {
    ok: true,
    data: {
      user: { id: userData.user.id, email: userData.user.email },
      profile,
    },
  };
}

/**
 * Check if user has one of the required roles.
 * Usage: const auth = await requireRole(req, 'admin_scheduler', 'AMaTS');
 */
export async function requireRole(req: Request, ...allowedRoles: string[]): Promise<
  { ok: true; data: AuthResult } | { ok: false; response: NextResponse }
> {
  const result = await getAuthUser(req);
  if (!result.ok) return result;

  if (!allowedRoles.includes(result.data.profile.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return result;
}
