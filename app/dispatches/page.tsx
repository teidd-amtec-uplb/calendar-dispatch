"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import Link from "next/link";
import AppLayout from "../components/AppLayout";

type Dispatch = {
  id: string;
  dispatch_number: string | null;
  company_name: string | null;
  date_from: string | null;
  date_to: string | null;
  transport_mode: string | null;
  created_at: string;
  created_by_role?: string | null;
  type: string;
  location: string;
  dispatch_assignments: {
    assignment_type: "lead_engineer" | "assistant_engineer" | "technician";
    staff: { full_name: string; initials?: string | null } | null;
  }[];
};

const TRANSPORT_LABELS: Record<string, string> = {
  public_conveyance: "Public Conveyance",
  test_applicant_vehicle: "Test Applicant Vehicle",
  college_vehicle: "College Vehicle",
  other: "Other",
};

// ─── Computed status ──────────────────────────────────────────────────────────
type DispatchStatus = "Scheduled" | "Ongoing" | "Completed" | "Unknown";

function getDispatchStatus(date_from: string | null, date_to: string | null): DispatchStatus {
  if (!date_from || !date_to) return "Unknown";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = parseLocalDate(date_from);
  const to = parseLocalDate(date_to);
  if (today < from) return "Scheduled";
  if (today > to) return "Completed";
  return "Ongoing";
}

function getSurname(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(" ");
  return parts[parts.length - 1];
}

function parseLocalDate(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const STATUS_STYLES: Record<DispatchStatus, { bg: string; color: string }> = {
  Scheduled: { bg: "#EEF1FB", color: "#1B2A6B" },
  Ongoing:   { bg: "#DBEAFE", color: "#1E40AF" },
  Completed: { bg: "#D1FAE5", color: "#065F46" },
  Unknown:   { bg: "#F3F4F6", color: "#6B7280" },
};

function StatusBadge({ date_from, date_to }: { date_from: string | null; date_to: string | null }) {
  const status = getDispatchStatus(date_from, date_to);
  const s = STATUS_STYLES[status];
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

export default function DispatchListPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [search, setSearch] = useState("");
  const [dispatchNumberFilter, setDispatchNumberFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [personnelFilter, setPersonnelFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  
  const [role, setRole] = useState("");
  const [token, setToken] = useState("");
  const [noAssignments, setNoAssignments] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uniquePersonnel = useMemo(() => {
    const names = new Set<string>();
    dispatches.forEach(d => {
      d.dispatch_assignments?.forEach(a => {
        if (a.staff?.full_name) names.add(a.staff.full_name);
      });
    });
    return Array.from(names).sort();
  }, [dispatches]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login"); return; }

      const meRes = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      });
      const meData = await meRes.json();
      setRole(meData.profile?.role ?? "");

      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) { router.push("/login"); return; }
      setToken(accessToken);

      const res = await fetch("/api/dispatches", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) { setLoading(false); return; }
      setDispatches(json.dispatches ?? []);
      if (json.noAssignments) setNoAssignments(true);
      setLoading(false);
    }
    load();
  }, [router, supabase]);

  async function handleDeleteDispatch(e: React.MouseEvent, d: Dispatch) {
    e.stopPropagation(); // prevent row click navigation
    if (!token || deletingId) return;

    if (!confirm(`Are you sure you want to delete dispatch ${d.dispatch_number ?? "unnamed"}? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(d.id);
    try {
      const res = await fetch(`/api/dispatches/${d.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to delete dispatch");
        return;
      }
      
      // Update state locally
      setDispatches(prev => prev.filter(x => x.id !== d.id));
    } catch {
      alert("Failed to delete dispatch. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setDispatchNumberFilter("");
    setStatusFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setPersonnelFilter("all");
  }

  let filtered = dispatches.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch =
      d.dispatch_number?.toLowerCase().includes(q) ||
      d.company_name?.toLowerCase().includes(q) ||
      d.location?.toLowerCase().includes(q);
      
    const matchesDispatchNumber =
      !dispatchNumberFilter.trim() ||
      d.dispatch_number?.toLowerCase().includes(dispatchNumberFilter.trim().toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      getDispatchStatus(d.date_from, d.date_to) === statusFilter;

    const matchesDateFrom = !dateFromFilter || (d.date_to ?? "") >= dateFromFilter;
    const matchesDateTo   = !dateToFilter   || (d.date_from ?? "") <= dateToFilter;

    const matchesPersonnel =
      personnelFilter === "all" ||
      d.dispatch_assignments?.some(a => a.staff?.full_name === personnelFilter);

    return matchesSearch && matchesDispatchNumber && matchesStatus && matchesDateFrom && matchesDateTo && matchesPersonnel;
  });

  filtered = filtered.sort((a, b) => {
    if (sortBy === "date_desc") {
      return (b.date_from || "").localeCompare(a.date_from || "");
    }
    if (sortBy === "date_asc") {
      return (a.date_from || "").localeCompare(b.date_from || "");
    }
    if (sortBy === "dispatch_asc") {
      return (a.dispatch_number || "").localeCompare(b.dispatch_number || "");
    }
    if (sortBy === "dispatch_desc") {
      return (b.dispatch_number || "").localeCompare(a.dispatch_number || "");
    }
    if (sortBy === "engineers_asc") {
      const eA = a.dispatch_assignments?.filter(x => ["lead_engineer", "assistant_engineer"].includes(x.assignment_type)).map(x => x.staff?.initials).join("") || "";
      const eB = b.dispatch_assignments?.filter(x => ["lead_engineer", "assistant_engineer"].includes(x.assignment_type)).map(x => x.staff?.initials).join("") || "";
      return eA.localeCompare(eB);
    }
    if (sortBy === "technicians_asc") {
      const tA = a.dispatch_assignments?.filter(x => x.assignment_type === "technician").map(x => x.staff?.initials).join("") || "";
      const tB = b.dispatch_assignments?.filter(x => x.assignment_type === "technician").map(x => x.staff?.initials).join("") || "";
      return tA.localeCompare(tB);
    }
    return 0;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 text-sm">Loading dispatches...</p>
    </div>
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="w-full px-4 py-8 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dispatches</h1>
              <p className="text-sm text-gray-500 mt-1">{dispatches.length} total records</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard"
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 text-gray-700">
                ← Dashboard
              </Link>
              {role === "admin_scheduler" && (
                <Link href="/dispatch/new"
                  className="px-4 py-2 text-sm text-white rounded hover:opacity-90"
                  style={{ background: "#1B2A6B" }}>
                  + New Dispatch
                </Link>
              )}
            </div>
          </div>

          {/* Filters & Sorting */}
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input
                type="text"
                placeholder="Search by company, or location..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 xl:col-span-2"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <input
                type="text"
                placeholder="Dispatch number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={dispatchNumberFilter}
                onChange={(e) => setDispatchNumberFilter(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={personnelFilter}
                onChange={e => setPersonnelFilter(e.target.value)}>
                <option value="all">All personnel</option>
                {uniquePersonnel.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                onClick={clearFilters}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:max-w-lg">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-10 shrink-0">From</span>
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-10 shrink-0">To</span>
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Showing {filtered.length} of {dispatches.length} dispatches
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Dispatch #</th>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Date From</th>
                  <th className="px-4 py-3 text-left">Date To</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Transport</th>
                  <th className="px-4 py-3 text-left">Engineers</th>
                  <th className="px-4 py-3 text-left">Technicians</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  {role === "admin_scheduler" && (
                    <th className="px-4 py-3 text-left">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={role === "admin_scheduler" ? 10 : 9} className="px-4 py-16 text-center">
                      <p className="text-gray-500 font-semibold text-base mb-1">
                        {noAssignments ? "No dispatches assigned to you." : "No dispatches found."}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {noAssignments
                          ? "Please contact your scheduler to be assigned to a dispatch."
                          : "Try adjusting your search or filter."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => {
                    const engineers = d.dispatch_assignments
                      ?.filter((a) => ["lead_engineer", "assistant_engineer"].includes(a.assignment_type))
                      .map((a) => getSurname(a.staff?.full_name))
                      .join(", ") || "—";
                    const technicians = d.dispatch_assignments
                      ?.filter((a) => a.assignment_type === "technician")
                      .map((a) => getSurname(a.staff?.full_name))
                      .join(", ") || "—";
                    return (
                      <tr key={d.id}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/dispatches/${d.id}`)}>
                        <td className="px-4 py-3 font-mono font-medium text-blue-700">
                          {d.dispatch_number ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-800">{d.company_name ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{d.date_from ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{d.date_to ?? "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge date_from={d.date_from} date_to={d.date_to} />
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {TRANSPORT_LABELS[d.transport_mode ?? ""] ?? d.transport_mode ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{engineers}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{technicians}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(d.created_at).toLocaleDateString()}
                        </td>
                        {role === "admin_scheduler" && (
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => handleDeleteDispatch(e, d)}
                              disabled={!!deletingId}
                              title="Delete Dispatch"
                              className="p-1.5 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-50"
                              style={{ borderColor: "#DC2626", color: "#DC2626" }}>
                              {deletingId === d.id ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
