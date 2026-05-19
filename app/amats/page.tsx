"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { supabaseBrowser } from "@/lib/supabase/client";

interface AmatsSummary {
  id: string;
  session_number: string;
  machine: string;
  machine_name_or_code: string | null;
  date_from: string;
  date_to: string;
  status: string;
  amats_session_tests: { test_name: string }[];
  amats_session_assignments: {
    assignment_type: string;
    staff: { full_name: string; initials: string } | null;
  }[];
}

function getStatusColor(status: string) {
  switch (status) {
    case "Scheduled": return "bg-blue-100 text-blue-800";
    case "Ongoing": return "bg-yellow-100 text-yellow-800";
    case "Done": return "bg-green-100 text-green-800";
    case "Cancelled": return "bg-gray-100 text-gray-600";
    case "Re-scheduled": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-600";
  }
}

function IconCheck() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6" />
    </svg>
  );
}

export default function AMaTSSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AmatsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [search, setSearch] = useState("");
  const [sessionNumberFilter, setSessionNumberFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("all");
  const [engineerFilter, setEngineerFilter] = useState("all");
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [copiedSelected, setCopiedSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setAuthToken(session.access_token);

      const profileRes = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const profileData = await profileRes.json();
      setUserRole(profileData.profile?.role ?? null);

      const res = await fetch("/api/amats/sessions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const isManager = userRole === "AMaTS";

  const machineOptions = useMemo(() => {
    return Array.from(new Set(sessions.map((s) => s.machine).filter(Boolean))).sort();
  }, [sessions]);

  const engineerOptions = useMemo(() => {
    const engineers = new Set<string>();
    sessions.forEach((s) => {
      s.amats_session_assignments
        .filter((a) => a.assignment_type === "test_engineer" && a.staff)
        .forEach((a) => engineers.add(a.staff!.initials || a.staff!.full_name));
    });
    return Array.from(engineers).sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    const textQuery = search.trim().toLowerCase();
    const sessionQuery = sessionNumberFilter.trim().toLowerCase();

    return sessions.filter((s) => {
      const engineerLabels = s.amats_session_assignments
        .filter((a) => a.assignment_type === "test_engineer" && a.staff)
        .map((a) => [a.staff!.initials, a.staff!.full_name].filter(Boolean).join(" ").toLowerCase());

      const matchesText =
        !textQuery ||
        s.session_number.toLowerCase().includes(textQuery) ||
        s.machine.toLowerCase().includes(textQuery) ||
        (s.machine_name_or_code || "").toLowerCase().includes(textQuery) ||
        engineerLabels.some((name) => name.includes(textQuery));

      const matchesSessionNumber =
        !sessionQuery || s.session_number.toLowerCase().includes(sessionQuery);

      const sessionStart = s.date_from.slice(0, 10);
      const sessionEnd = s.date_to.slice(0, 10);
      const matchesDateFrom = !dateFromFilter || sessionEnd >= dateFromFilter;
      const matchesDateTo = !dateToFilter || sessionStart <= dateToFilter;

      const matchesMachine = machineFilter === "all" || s.machine === machineFilter;
      const matchesEngineer =
        engineerFilter === "all" ||
        s.amats_session_assignments.some(
          (a) =>
            a.assignment_type === "test_engineer" &&
            a.staff &&
            (a.staff.initials === engineerFilter || a.staff.full_name === engineerFilter)
        );

      return (
        matchesText &&
        matchesSessionNumber &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesMachine &&
        matchesEngineer
      );
    });
  }, [dateFromFilter, dateToFilter, engineerFilter, machineFilter, search, sessionNumberFilter, sessions]);

  const selectedSessions = useMemo(() => {
    return sessions.filter((s) => selectedSessionIds.has(s.id));
  }, [selectedSessionIds, sessions]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedSessionIds.has(s.id));

  function toggleSessionSelection(id: string) {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((s) => next.delete(s.id));
      } else {
        filtered.forEach((s) => next.add(s.id));
      }
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setSessionNumberFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setMachineFilter("all");
    setEngineerFilter("all");
  }

  function buildCopyText(sessionsToCopy: AmatsSummary[]): string {
    // Use today's date — the date the copy action is performed
    const today = new Date();
    const dateLabel = today.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const lines: string[] = [];
    lines.push(`Mechanical Laboratory Tests for ${dateLabel}`);
    lines.push("");

    sessionsToCopy.forEach((s, index) => {
      const machineHeader = [s.machine_name_or_code, s.machine]
        .filter(Boolean)
        .join(" ");

      const engineers = s.amats_session_assignments
        .filter((a) => a.assignment_type === "test_engineer" && a.staff)
        .map((a) => a.staff!.initials)
        .join(", ");
      const technicians = s.amats_session_assignments
        .filter((a) => a.assignment_type === "test_technician" && a.staff)
        .map((a) => a.staff!.initials)
        .join(", ");

      const testNames = s.amats_session_tests.map((t) => t.test_name).join(", ");

      lines.push(`${index + 1}. ${machineHeader}`);
      lines.push(testNames || "(no tests listed)");
      lines.push(`Time: ${new Date(s.date_from).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} - ${new Date(s.date_to).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`);
      lines.push(`Engineer/s: ${engineers || "-"}`);
      lines.push(`Technician/s – ${technicians || "-"}`);
      lines.push("");
    });

    return lines.join("\n").trimEnd();
  }

  async function handleCopySelected() {
    if (selectedSessions.length === 0) return;

    try {
      await navigator.clipboard.writeText(buildCopyText(selectedSessions));
      setCopiedSelected(true);
      setTimeout(() => setCopiedSelected(false), 2500);
    } catch {
      alert("Could not copy. Please try manually.");
    }
  }

  async function handleDeleteSelected() {
    if (!authToken || selectedSessions.length === 0 || deletingSelected) return;

    const label = selectedSessions.length === 1 ? "session" : "sessions";
    if (!confirm(`Delete ${selectedSessions.length} selected ${label}? This action cannot be undone.`)) {
      return;
    }

    setDeletingSelected(true);
    try {
      const results = await Promise.all(
        selectedSessions.map(async (s) => {
          const res = await fetch(`/api/amats/sessions/${s.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          });
          return { id: s.id, ok: res.ok };
        })
      );

      const failed = results.filter((result) => !result.ok);
      if (failed.length > 0) {
        alert(`Failed to delete ${failed.length} selected ${failed.length === 1 ? "session" : "sessions"}.`);
      }

      const deletedIds = new Set(results.filter((result) => result.ok).map((result) => result.id));
      setSessions((prev) => prev.filter((s) => !deletedIds.has(s.id)));
      setSelectedSessionIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch {
      alert("Failed to delete selected sessions. Please try again.");
    } finally {
      setDeletingSelected(false);
    }
  }

  return (
    <AppLayout>
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AMaTS Testing Sessions</h1>
            <p className="text-sm text-gray-500 mt-1">
              Agricultural Machinery Testing and Studies Laboratory
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isManager && selectedSessions.length > 0 && (
              <>
                <button
                  onClick={handleCopySelected}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all"
                  style={{
                    borderColor: copiedSelected ? "#16a34a" : "#6B7280",
                    color: copiedSelected ? "#16a34a" : "#374151",
                    background: copiedSelected ? "#f0fdf4" : "white",
                  }}
                >
                  {copiedSelected ? <IconCheck /> : <IconCopy />}
                  {copiedSelected ? "Copied!" : `Copy Selected (${selectedSessions.length})`}
                </button>
                {isManager && (
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deletingSelected}
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconTrash />
                    {deletingSelected ? "Deleting..." : `Delete Selected (${selectedSessions.length})`}
                  </button>
                )}
              </>
            )}
            {isManager && (
              <button
                onClick={() => router.push("/amats/new")}
                className="flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800"
              >
                <IconPlus />
                New Session
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 xl:col-span-2"
            />
            <input
              type="text"
              value={sessionNumberFilter}
              onChange={(e) => setSessionNumberFilter(e.target.value)}
              placeholder="Session number"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All machines</option>
              {machineOptions.map((machine) => (
                <option key={machine} value={machine}>{machine}</option>
              ))}
            </select>
            <select
              value={engineerFilter}
              onChange={(e) => setEngineerFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All engineers</option>
              {engineerOptions.map((engineer) => (
                <option key={engineer} value={engineer}>{engineer}</option>
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
              <span className="w-16 shrink-0">From</span>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-10 shrink-0">To</span>
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </label>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Showing {filtered.length} of {sessions.length} sessions
            {isManager && selectedSessions.length > 0 ? `, ${selectedSessions.length} selected` : ""}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading sessions...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {sessions.length > 0 ? "No sessions match your filters." : "No sessions yet."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {isManager && (
                    <th className="w-12 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        aria-label="Select all visible AMaTS sessions"
                        className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-500"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Session #</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Machine</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tests</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date From</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date To</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Engineers</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const sessionEngineers = s.amats_session_assignments
                    .filter((a) => a.assignment_type === "test_engineer" && a.staff)
                    .map((a) => a.staff!.initials);
                  const isSelected = selectedSessionIds.has(s.id);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/amats/${s.id}`)}
                      className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                        isSelected ? "bg-red-50/60" : i % 2 === 0 ? "" : "bg-gray-50/30"
                      }`}
                    >
                      {isManager && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSessionSelection(s.id)}
                            aria-label={`Select session ${s.session_number}`}
                            className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-gray-900">{s.session_number}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{s.machine}</div>
                        {s.machine_name_or_code && (
                          <div className="text-xs text-gray-400">{s.machine_name_or_code}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.amats_session_tests.length} test{s.amats_session_tests.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(s.date_from).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(s.date_to).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {sessionEngineers.length > 0 ? sessionEngineers.join(", ") : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(s.status)}`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
