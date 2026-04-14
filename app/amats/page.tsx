// app/amats/page.tsx
"use client";

import { useState, useEffect } from "react";
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

export default function AMaTSSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AmatsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const init = async () => {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

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

  const isManager = userRole === "AMaTS" || userRole === "admin_scheduler";

  const filtered = sessions.filter(
    (s) =>
      s.session_number.toLowerCase().includes(search.toLowerCase()) ||
      s.machine.toLowerCase().includes(search.toLowerCase()) ||
      (s.machine_name_or_code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AMaTS Testing Sessions</h1>
            <p className="text-sm text-gray-500 mt-1">
              Agricultural Machinery Testing and Studies Laboratory
            </p>
          </div>
          {isManager && (
            <button
              onClick={() => router.push("/amats/new")}
              className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors"
            >
              + New Session
            </button>
          )}
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by session number or machine..."
            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading sessions...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {search ? "No sessions match your search." : "No sessions yet."}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
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

                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/amats/${s.id}`)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                        i % 2 === 0 ? "" : "bg-gray-50/30"
                      }`}
                    >
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
                        {sessionEngineers.length > 0 ? sessionEngineers.join(", ") : "—"}
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
