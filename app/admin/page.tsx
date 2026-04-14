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

export default function AdminPage() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')

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

      // Fetch engineers + technicians from staff table
      const [engRes, techRes] = await Promise.all([
        fetch('/api/staff/engineers'),
        fetch('/api/staff/technicians'),
      ])
      const engData = await engRes.json()
      const techData = await techRes.json()
      setStaff([...(engData.staff ?? []), ...(techData.staff ?? [])])
      setLoading(false)
    }
    init()
  }, [router, supabase])

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

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1B2A6B]">Admin Panel</h1>
          <p className="text-gray-500 mt-1 text-sm">AMTEC staff directory — engineers and technicians</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
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
        </div>

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