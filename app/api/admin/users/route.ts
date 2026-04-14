import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/requireAccess'

export async function GET(req: Request) {
  const auth = await requireRole(req, 'admin_scheduler', 'AMaTS')
  if (!auth.ok) return auth.response

  // Fetch profiles
  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch emails from auth.users
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
  const emailMap = Object.fromEntries(authUsers.users.map(u => [u.id, u.email ?? '—']))

  // Merge emails into profiles
  const usersWithEmail = users.map(u => ({ ...u, email: emailMap[u.id] ?? '—' }))

  return NextResponse.json(usersWithEmail)
}