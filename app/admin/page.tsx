'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '../components/AppLayout'
import { supabaseBrowser } from '@/lib/supabase/client'

type StaffMember = {
  id: string
  full_name: string
  surname: string
  initials: string
  designation: string | null
  email: string | null
  role: string
  active: boolean
}

const roleBadge: Record<string, string> = {
  engineer: 'bg-blue-100 text-blue-800',
  technician: 'bg-purple-100 text-purple-800',
}

const EMPTY_FORM = {
  full_name: '',
  surname: '',
  initials: '',
  designation: '',
  email: '',
  role: 'engineer' as 'engineer' | 'technician',
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [token, setToken] = useState('')

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formSuccess, setFormSuccess] = useState('')

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/login'); return }

      const meRes = await fetch('/api/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id }),
      })
      const meData = await meRes.json()
      const userRole = meData.profile?.role ?? ''

      if (!['admin_scheduler', 'AMaTS'].includes(userRole)) {
        router.push('/dashboard')
        return
      }

      const { data: session } = await supabase.auth.getSession()
      setToken(session.session?.access_token ?? '')

      await loadStaff()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase])

  async function loadStaff() {
    setLoading(true)
    const [engRes, techRes] = await Promise.all([
      fetch('/api/staff/engineers'),
      fetch('/api/staff/technicians'),
    ])
    const engData = await engRes.json()
    const techData = await techRes.json()
    setStaff([...(engData.staff ?? []), ...(techData.staff ?? [])])
    setLoading(false)
  }

  const filtered = staff.filter(s => {
    const matchSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.surname ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.initials ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'all' || s.role === filterRole
    return matchSearch && matchRole
  })

  const engineerCount = staff.filter(s => s.role === 'engineer').length
  const techCount = staff.filter(s => s.role === 'technician').length

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    if (!form.full_name.trim() || !form.surname.trim() || !form.initials.trim()) {
      setFormError('Full Name, Surname, and Initials are required.')
      return
    }
    setFormLoading(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setFormError(json.error ?? 'Failed to add staff member.')
      } else {
        setFormSuccess(`${form.full_name} has been added successfully!`)
        setForm(EMPTY_FORM)
        await loadStaff()
        setTimeout(() => {
          setFormSuccess('')
          setShowAddForm(false)
        }, 2000)
      }
    } catch {
      setFormError('Network error. Please try again.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(member: StaffMember) {
    if (!confirm(`Permanently delete ${member.full_name}? This cannot be undone and will remove them from all future dispatch selections.`)) return
    setDeletingId(member.id)
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error ?? 'Failed to delete staff member.')
      } else {
        setStaff(prev => prev.filter(s => s.id !== member.id))
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A6B]">Admin Panel</h1>
            <p className="text-gray-500 mt-1 text-sm">AMTEC staff directory — engineers and technicians</p>
          </div>
          <button
            onClick={() => { setShowAddForm(v => !v); setFormError(''); setFormSuccess('') }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#1B2A6B' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {showAddForm ? 'Cancel' : 'Add Staff'}
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Staff', value: staff.length, color: 'text-[#1B2A6B]' },
            { label: 'Engineers', value: engineerCount, color: 'text-blue-600' },
            { label: 'Technicians', value: techCount, color: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Add Staff Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-base font-bold text-[#1B2A6B] mb-4">Add New Staff Member</h2>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Juan Dela Cruz"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A6B]/20"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Surname <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Dela Cruz"
                  value={form.surname}
                  onChange={e => setForm(f => ({ ...f, surname: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A6B]/20"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Initials <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. JDC"
                  value={form.initials}
                  onChange={e => setForm(f => ({ ...f, initials: e.target.value.toUpperCase() }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A6B]/20 uppercase"
                  maxLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Role <span className="text-red-500">*</span></label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as 'engineer' | 'technician' }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A6B]/20 bg-white"
                >
                  <option value="engineer">Engineer</option>
                  <option value="technician">Technician</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Agricultural Engineer I"
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A6B]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="e.g. jdelacruz@amtec.gov.ph"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A6B]/20"
                />
              </div>

              {/* Feedback */}
              {formError && (
                <div className="sm:col-span-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>
              )}
              {formSuccess && (
                <div className="sm:col-span-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">✓ {formSuccess}</div>
              )}

              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); setFormError('') }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ background: '#1B2A6B' }}>
                  {formLoading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {formLoading ? 'Adding...' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by name, initials, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A6B]/20 w-64"
          />
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[
              { value: 'all', label: 'All' },
              { value: 'engineer', label: 'Engineers' },
              { value: 'technician', label: 'Technicians' },
            ].map(f => (
              <button key={f.value} onClick={() => setFilterRole(f.value)}
                className="px-4 py-2 text-xs font-semibold transition-all"
                style={{
                  background: filterRole === f.value ? '#1B2A6B' : 'white',
                  color: filterRole === f.value ? 'white' : '#6B7280',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading staff...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No staff found.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200" style={{ background: '#F8F9FB' }}>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-10">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Initials</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Full Name</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Surname</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Designation</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}
                    className={`border-b border-gray-50 hover:bg-[#F4F6FB]/60 transition-colors ${
                      i % 2 === 0 ? '' : 'bg-gray-50/30'
                    }`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: s.role === 'engineer' ? '#1B2A6B' : '#7C3AED' }}>
                          {s.initials?.substring(0, 2) ?? '?'}
                        </div>
                        <span className="text-xs font-bold text-gray-700">{s.initials}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.full_name}</td>
                    <td className="px-4 py-3 text-gray-700">{s.surname}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{s.designation ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        roleBadge[s.role] ?? 'bg-gray-100 text-gray-700'
                      }`}>
                        {s.role === 'engineer' ? 'Engineer' : 'Technician'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        title={`Delete ${s.full_name}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderColor: '#DC2626', color: '#DC2626' }}
                      >
                        {deletingId === s.id ? (
                          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}