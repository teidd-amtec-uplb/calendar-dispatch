// app/amats/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { supabaseBrowser } from "@/lib/supabase/client";

interface AmatsSession {
  id: string;
  session_number: string;
  machine: string;
  machine_name_or_code: string | null;
  date_from: string;
  date_to: string;
  status: string;
  notes: string | null;
  created_at: string;
  amats_session_tests: { id: string; test_name: string }[];
  amats_session_assignments: {
    id: string;
    assignment_type: string;
    staff: { id: string; full_name: string; initials: string; designation: string } | null;
  }[];
}

function getStatusColor(status: string) {
  switch (status) {
    case "Scheduled": return "bg-blue-100 text-blue-800 border-blue-200";
    case "Ongoing": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Done": return "bg-green-100 text-green-800 border-green-200";
    case "Cancelled": return "bg-gray-100 text-gray-600 border-gray-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export default function AMaTSSessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [session, setSession] = useState<AmatsSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = supabaseBrowser();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { router.push("/login"); return; }

      try {
        const [profileRes, sessionRes] = await Promise.all([
          fetch("/api/me", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: authSession.user.id }),
          }),
          fetch(`/api/amats/sessions/${id}`, {
            headers: { Authorization: `Bearer ${authSession.access_token}` },
          }),
        ]);

        const profileData = await profileRes.json();
        setUserRole(profileData.profile?.role ?? null);

        const sessionData = await sessionRes.json();
        setSession(sessionData.session ?? null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, router]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-gray-400">Session not found.</div>
      </AppLayout>
    );
  }

  const isManager = userRole === "AMaTS" || userRole === "admin_scheduler";
  const testEngineers = session.amats_session_assignments.filter(
    (a) => a.assignment_type === "test_engineer"
  );
  const testTechnicians = session.amats_session_assignments.filter(
    (a) => a.assignment_type === "test_technician"
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button
              onClick={() => router.push("/amats")}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
            >
              ← Back to Sessions
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{session.session_number}</h1>
            <p className="text-sm text-gray-500 mt-1">
              AMaTS Testing Session — created {new Date(session.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(session.status)}`}>
              {session.status}
            </span>
            {isManager && (
              <button
                onClick={() => alert("Edit session is not implemented yet.")}
                className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors"
              >
                Edit Session
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Machine Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Machine</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Machine Type</p>
                <p className="text-sm font-medium text-gray-900">{session.machine}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Machine Name / Code</p>
                <p className="text-sm font-medium text-gray-900">
                  {session.machine_name_or_code || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Date and Time
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date From</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(session.date_from).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date To</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(session.date_to).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Tests */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Machine Testing and Studies
              <span className="ml-2 text-xs text-gray-400 normal-case font-normal">
                ({session.amats_session_tests.length} test{session.amats_session_tests.length !== 1 ? "s" : ""})
              </span>
            </h2>
            {session.amats_session_tests.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No tests recorded.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {session.amats_session_tests.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-800">{t.test_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personnel */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Personnel
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Test Engineers</h3>
                {testEngineers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">None assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {testEngineers.map((a) => (
                      <div key={a.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {a.staff?.initials ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {a.staff?.full_name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-gray-400">{a.staff?.designation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Test Technicians</h3>
                {testTechnicians.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">None assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {testTechnicians.map((a) => (
                      <div key={a.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {a.staff?.initials ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {a.staff?.full_name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-gray-400">{a.staff?.designation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {session.notes && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{session.notes}</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
