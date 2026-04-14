// app/amats/new/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { getMachineNames, getTestsForMachine } from "@/lib/amats-machine-tests";
import { supabaseBrowser } from "@/lib/supabase/client";

interface StaffMember {
  id: string;
  full_name: string;
  initials: string;
  designation: string;
  type: "engineer" | "technician";
}

type UnavailableInfo = { reason: "conflict" | "cooldown"; dispatch_number: string; until?: string };
type StaffAvailability = Record<string, UnavailableInfo>;


export default function NewAMaTSSessionPage() {
  const router = useRouter();

  // Form state
  const [sessionNumber, setSessionNumber] = useState("");
  const [machine, setMachine] = useState("");
  const [machineNameOrCode, setMachineNameOrCode] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEngineers, setSelectedEngineers] = useState<string[]>([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Data state
  const [engineers, setEngineers] = useState<StaffMember[]>([]);
  const [technicians, setTechnicians] = useState<StaffMember[]>([]);
  const [availableTests, setAvailableTests] = useState<string[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const machineNames = getMachineNames();

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const res = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const data = await res.json();
      if (!data.profile || !["AMaTS", "admin_scheduler"].includes(data.profile.role)) {
        router.push("/dashboard");
        return;
      }
      setUserRole(data.profile.role);
    };
    checkAuth();
  }, [router]);

  // Load staff
  useEffect(() => {
    const loadStaff = async () => {
      const [engRes, techRes] = await Promise.all([
        fetch("/api/staff/engineers"),
        fetch("/api/staff/technicians"),
      ]);
      const [engData, techData] = await Promise.all([engRes.json(), techRes.json()]);
      setEngineers((engData.staff || []).map((e: StaffMember) => ({ ...e, type: "engineer" })));
      setTechnicians((techData.staff || []).map((t: StaffMember) => ({ ...t, type: "technician" })));
    };
    loadStaff();
  }, []);

  // When machine changes, update available tests and clear selection
  useEffect(() => {
    if (machine) {
      const tests = getTestsForMachine(machine);
      setAvailableTests(tests);
      setSelectedTests([]);
    } else {
      setAvailableTests([]);
      setSelectedTests([]);
    }
  }, [machine]);

  // Fetch availability whenever dates change
  useEffect(() => {
    if (!dateFrom || !dateTo) {
      setStaffAvailability({});
      return;
    }
    let cancelled = false;
    async function fetchAvailability() {
      setAvailabilityLoading(true);
      try {
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
        const res = await fetch(`/api/staff/availability?${params}`);
        const data = await res.json();
        if (!cancelled) setStaffAvailability(data.unavailable ?? {});
      } catch { /* silently ignore */ }
      finally { if (!cancelled) setAvailabilityLoading(false); }
    }
    fetchAvailability();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  // Auto-deselect staff that become unavailable when dates change
  useEffect(() => {
    if (Object.keys(staffAvailability).length === 0) return;
    setSelectedEngineers(prev => prev.filter(id => !staffAvailability[id]));
    setSelectedTechnicians(prev => prev.filter(id => !staffAvailability[id]));
  }, [staffAvailability]);

  function getUnavailableLabel(info: UnavailableInfo): string {
    if (info.reason === "conflict") return `Assigned to ${info.dispatch_number}`;
    return `Cooldown until ${info.until} (${info.dispatch_number})`;
  }

  const toggleTest = useCallback((test: string) => {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  }, []);

  const toggleEngineer = useCallback((id: string) => {
    if (staffAvailability[id]) return;
    setSelectedEngineers((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }, [staffAvailability]);

  const toggleTechnician = useCallback((id: string) => {
    if (staffAvailability[id]) return;
    setSelectedTechnicians((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, [staffAvailability]);

  const handleSelectAllTests = () => {
    if (selectedTests.length === availableTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests([...availableTests]);
    }
  };

  const handleSave = async () => {
    setError(null);

    // Basic validation
    if (!sessionNumber.trim()) { setError("Session number is required."); return; }
    if (!machine) { setError("Machine selection is required."); return; }
    if (!dateFrom || !dateTo) { setError("Date From and Date To are required."); return; }
    if (selectedTests.length === 0) { setError("At least one test must be selected."); return; }
    if (new Date(dateTo) < new Date(dateFrom)) {
      setError("Date To cannot be before Date From.");
      return;
    }

    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch("/api/amats/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          session_number: sessionNumber.trim(),
          machine,
          machine_name_or_code: machineNameOrCode.trim() || null,
          date_from: dateFrom,
          date_to: dateTo,
          notes: notes.trim() || null,
          selected_tests: selectedTests,
          engineers: selectedEngineers.map((id) => ({ staff_id: id })),
          technicians: selectedTechnicians.map((id) => ({ staff_id: id })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");

      router.push(`/amats/${data.session.id}`);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (!userRole) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push("/amats")}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
            >
              ← Back to Sessions
            </button>
            <h1 className="text-2xl font-bold text-gray-900">New AMaTS Testing Session</h1>
            <p className="text-sm text-gray-500 mt-1">
              Agricultural Machinery Testing and Studies Laboratory
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* Section: Session Info */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Session Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(e.target.value)}
                  placeholder="AMaTS-2026-0001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </section>

          {/* Section: Machine Selection */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Machine
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Machine Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                >
                  <option value="">— Select a machine —</option>
                  {machineNames.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specific Machine Name or Code
                </label>
                <input
                  type="text"
                  value={machineNameOrCode}
                  onChange={(e) => setMachineNameOrCode(e.target.value)}
                  placeholder="e.g. HTP-200A or Brand Model SN#"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </section>

          {/* Section: Machine Testing and Studies (dynamic) */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-1 pb-2 border-b border-gray-100">
              Machine Testing and Studies <span className="text-red-500">*</span>
            </h2>

            {!machine ? (
              <div className="mt-4 text-sm text-gray-400 italic">
                Select a machine above to see available tests.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mt-4 mb-3">
                  <p className="text-sm text-gray-500">
                    {selectedTests.length} of {availableTests.length} tests selected
                  </p>
                  <button
                    type="button"
                    onClick={handleSelectAllTests}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    {selectedTests.length === availableTests.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableTests.map((test) => (
                    <label
                      key={test}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedTests.includes(test)
                          ? "bg-red-50 border-red-300 text-red-800"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTests.includes(test)}
                        onChange={() => toggleTest(test)}
                        className="accent-red-600 w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-sm">{test}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Section: Date and Time */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Date and Time <span className="text-red-500">*</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="datetime-local"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="datetime-local"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </section>

          {/* Section: Personnel */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Personnel
            </h2>
            {(!dateFrom || !dateTo) && (
              <p className="text-xs text-amber-500 mb-3">Set testing dates above to see availability.</p>
            )}
            {availabilityLoading && (
              <p className="text-xs text-blue-500 animate-pulse mb-3">Checking staff availability...</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Test Engineers */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Test Engineers
                  {selectedEngineers.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-red-600">
                      {selectedEngineers.length} selected
                    </span>
                  )}
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {engineers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No engineers found.</p>
                  ) : (
                    engineers.map((eng) => {
                      const unavail = staffAvailability[eng.id];
                      const isUnavailable = !!unavail;
                      const isSelected = selectedEngineers.includes(eng.id);
                      return (
                        <label
                          key={eng.id}
                          className={`flex items-start gap-3 px-3 py-2 rounded-lg border transition-colors ${
                            isUnavailable
                              ? "opacity-40 cursor-not-allowed pointer-events-none bg-gray-100 border-gray-200"
                              : isSelected
                              ? "bg-red-50 border-red-300 cursor-pointer"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isUnavailable}
                            onChange={() => toggleEngineer(eng.id)}
                            className="accent-red-600 w-4 h-4 flex-shrink-0 mt-0.5"
                          />
                          <div>
                            <div className={`text-sm font-medium ${isUnavailable ? "text-gray-400 line-through" : "text-gray-800"}`}>
                              {eng.full_name}
                            </div>
                            <div className="text-xs text-gray-500">{eng.designation}</div>
                            {unavail && (
                              <div className="text-xs font-semibold text-gray-400 mt-0.5">
                                🚫 Not Available — {getUnavailableLabel(unavail)}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Test Technicians */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Test Technicians
                  {selectedTechnicians.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-red-600">
                      {selectedTechnicians.length} selected
                    </span>
                  )}
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {technicians.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No technicians found.</p>
                  ) : (
                    technicians.map((tech) => {
                      const unavail = staffAvailability[tech.id];
                      const isUnavailable = !!unavail;
                      const isSelected = selectedTechnicians.includes(tech.id);
                      return (
                        <label
                          key={tech.id}
                          className={`flex items-start gap-3 px-3 py-2 rounded-lg border transition-colors ${
                            isUnavailable
                              ? "opacity-40 cursor-not-allowed pointer-events-none bg-gray-100 border-gray-200"
                              : isSelected
                              ? "bg-red-50 border-red-300 cursor-pointer"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isUnavailable}
                            onChange={() => toggleTechnician(tech.id)}
                            className="accent-red-600 w-4 h-4 flex-shrink-0 mt-0.5"
                          />
                          <div>
                            <div className={`text-sm font-medium ${isUnavailable ? "text-gray-400 line-through" : "text-gray-800"}`}>
                              {tech.full_name}
                            </div>
                            <div className="text-xs text-gray-500">{tech.designation}</div>
                            {unavail && (
                              <div className="text-xs font-semibold text-gray-400 mt-0.5">
                                🚫 Not Available — {getUnavailableLabel(unavail)}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section: Notes */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Remarks, observations, or additional notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
            />
          </section>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pb-8">
            <button
              onClick={() => router.push("/amats")}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Create Session"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
