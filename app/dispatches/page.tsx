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
  const [role, setRole] = useState("");
  const [token, setToken] = useState("");
  const [noAssignments, setNoAssignments] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

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

  async function handleExportPdf(e: React.MouseEvent, d: Dispatch) {
    e.stopPropagation(); // prevent row click navigation
    if (!token || exportingId) return;
    setExportingId(d.id);
    try {
      const res = await fetch(`/api/dispatches/${d.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to generate PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dispatch-${d.dispatch_number ?? d.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setExportingId(null);
    }
  }

  const filtered = dispatches.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch =
      d.dispatch_number?.toLowerCase().includes(q) ||
      d.company_name?.toLowerCase().includes(q) ||
      d.location?.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ||
      getDispatchStatus(d.date_from, d.date_to) === statusFilter;
    return matchesSearch && matchesStatus;
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dispatches</h1>
              <p className="text-sm text-gray-500 mt-1">{dispatches.length} total records</p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard"
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 text-gray-700">
                ← Dashboard
              </Link>
              {(role === "admin_scheduler" || role === "AMaTS") && (
                <Link href="/dispatch/new"
                  className="px-4 py-2 text-sm text-white rounded hover:opacity-90"
                  style={{ background: "#1B2A6B" }}>
                  + New Dispatch
                </Link>
              )}
            </div>
          </div>

          {/* Search + Filter */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Search by dispatch #, company, or location..."
              className="flex-1 border border-gray-300 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
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
                  <th className="px-4 py-3 text-left">PDF</th>
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
                    const isExporting = exportingId === d.id;
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
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => handleExportPdf(e, d)}
                            disabled={!!exportingId}
                            title="Export PDF"
                            className="p-1.5 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50"
                            style={{ borderColor: "#1B2A6B", color: "#1B2A6B" }}>
                            {isExporting ? (
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                  stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                              </svg>
                            )}
                          </button>
                        </td>
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
