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
    staff: { full_name: string; initials: string } | null;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
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

  let filtered = dispatches.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch =
      d.dispatch_number?.toLowerCase().includes(q) ||
      d.company_name?.toLowerCase().includes(q) ||
      d.location?.toLowerCase().includes(q);
      
    const matchesStatus =
      statusFilter === "all" ||
      getDispatchStatus(d.date_from, d.date_to) === statusFilter;
      
    const matchesMonth = 
      monthFilter === "all" || 
      (d.date_from && parseInt(d.date_from.split("-")[1], 10).toString() === monthFilter);
      
    const matchesCreator = 
      creatorFilter === "all" || 
      d.created_by_role === creatorFilter;
      
    const matchesPersonnel = 
      personnelFilter === "all" || 
      d.dispatch_assignments?.some(a => a.staff?.full_name === personnelFilter);

    return matchesSearch && matchesStatus && matchesMonth && matchesCreator && matchesPersonnel;
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
        <div className="max-w-6xl mx-auto px-6 py-10">

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
              {(role === "admin_scheduler" || role === "AMaTS") && (
                <Link href={role === "AMaTS" ? "/amats/new" : "/dispatch/new"}
                  className="px-4 py-2 text-sm text-white rounded hover:opacity-90"
                  style={{ background: "#1B2A6B" }}>
                  {role === "AMaTS" ? "+ New Testing Form" : "+ New Dispatch"}
                </Link>
              )}
            </div>
          </div>

          {/* Filters & Sorting */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search by dispatch #, company, or location..."
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}>
                <option value="date_desc">Sort: Date (Newest First)</option>
                <option value="date_asc">Sort: Date (Oldest First)</option>
                <option value="dispatch_asc">Sort: Dispatch # (A-Z)</option>
                <option value="dispatch_desc">Sort: Dispatch # (Z-A)</option>
                <option value="engineers_asc">Sort: Engineers (A-Z)</option>
                <option value="technicians_asc">Sort: Technicians (A-Z)</option>
              </select>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <select
                className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Status: All</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>

              <select
                className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}>
                <option value="all">Month: All</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>

              <select
                className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={creatorFilter}
                onChange={e => setCreatorFilter(e.target.value)}>
                <option value="all">Created By: All</option>
                <option value="AMaTS">AMaTS</option>
                <option value="admin_scheduler">Scheduler</option>
              </select>

              <select
                className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={personnelFilter}
                onChange={e => setPersonnelFilter(e.target.value)}>
                <option value="all">Personnel: All</option>
                {uniquePersonnel.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
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
                  {(role === "admin_scheduler" || role === "AMaTS") && (
                    <th className="px-4 py-3 text-left">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
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
                      .map((a) => a.staff?.initials ?? "?")
                      .join(", ") || "—";
                    const technicians = d.dispatch_assignments
                      ?.filter((a) => a.assignment_type === "technician")
                      .map((a) => a.staff?.initials ?? "?")
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
                        {(role === "admin_scheduler" || role === "AMaTS") && (
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
