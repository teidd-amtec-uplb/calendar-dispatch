import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/requireAccess'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, 'admin_scheduler', 'AMaTS')
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const { active, role, lab, initials, full_name, surname, designation } = body

  const updates: Record<string, unknown> = {}
  if (typeof active === 'boolean') updates.active = active
  if (role) updates.role = role
  if (lab !== undefined) updates.lab = lab
  if (initials !== undefined) updates.initials = initials
  if (full_name !== undefined) updates.full_name = full_name
  if (surname !== undefined) updates.surname = surname
  if (designation !== undefined) updates.designation = designation

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, 'admin_scheduler', 'AMaTS')
  if (!auth.ok) return auth.response

  const { id } = await params

  // Delete profile first (FK constraint), then auth user
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', id)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (authDeleteError) return NextResponse.json({ error: authDeleteError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}