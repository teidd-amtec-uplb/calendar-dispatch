// app/amats/[id]/edit/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
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

// Convert a DB datetime string to datetime-local input format (YYYY-MM-DDTHH:MM)
function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getSessionSuffix(value: string): string {
  return value.trim().replace(/^TAM\s+/i, "").trim();
}

function formatSessionNumber(value: string): string {
  return `TAM ${getSessionSuffix(value)}`;
}

function buildMachineNameOrCode(machineName: string, brandModel: string, code: string): string | null {
  const parts = [machineName, brandModel, code].map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : null;
}

function parseMachineNameOrCode(value: string | null): { machineName: string; brandModel: string; machineCode: string } {
  if (!value) return { machineName: "", brandModel: "", machineCode: "" };
  const parts = value.split(" / ").map((part) => part.trim());
  return {
    machineName: parts[0] ?? "",
    brandModel: parts[1] ?? "",
    machineCode: parts.slice(2).join(" / "),
  };
}

export default function EditAMaTSSessionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Form state
  const [sessionNumber, setSessionNumber] = useState("");
  const [machine, setMachine] = useState("");
  const [machineName, setMachineName] = useState("");
  const [brandModel, setBrandModel] = useState("");
  const [machineCode, setMachineCode] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [selectedEngineers, setSelectedEngineers] = useState<string[]>([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Data state
  const [engineers, setEngineers] = useState<StaffMember[]>([]);
  const [technicians, setTechnicians] = useState<StaffMember[]>([]);
  const [availableTests, setAvailableTests] = useState<string[]>([]);

  // UI state
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [dynamicMachines, setDynamicMachines] = useState<{machine: string, tests: string[]}[]>([]);

  const machineNames = dynamicMachines.map(m => m.machine);
  const statusOptions = ["Scheduled", "Ongoing", "Done", "Re-scheduled", "Cancelled"];

  // Auth + load existing session + staff
  useEffect(() => {
    const init = async () => {
      const supabase = supabaseBrowser();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { router.push("/login"); return; }

      const profileRes = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: authSession.user.id }),
      });
      const profileData = await profileRes.json();
      if (profileData.profile?.role !== "AMaTS") {
        router.push("/dashboard");
        return;
      }

      setToken(authSession.access_token);

      // Load staff + existing session + machines in parallel
      const [engRes, techRes, sessionRes, machinesRes] = await Promise.all([
        fetch("/api/staff/engineers"),
        fetch("/api/staff/technicians"),
        fetch(`/api/amats/sessions/${id}`, {
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        }),
        fetch("/api/amats/machine-tests"),
      ]);

      const [engData, techData, sessionData, machinesData] = await Promise.all([
        engRes.json(), techRes.json(), sessionRes.json(), machinesRes.json()
      ]);

      setEngineers((engData.staff || []).map((e: StaffMember) => ({ ...e, type: "engineer" })));
      setTechnicians((techData.staff || []).map((t: StaffMember) => ({ ...t, type: "technician" })));
      if (machinesData.detailed) setDynamicMachines(machinesData.detailed);

      const s = sessionData.session;
      if (!s) { router.push("/amats"); return; }

      // Pre-populate form
      setSessionNumber(getSessionSuffix(s.session_number ?? ""));
      setMachine(s.machine ?? "");
      const machineParts = parseMachineNameOrCode(s.machine_name_or_code ?? null);
      setMachineName(machineParts.machineName);
      setBrandModel(machineParts.brandModel);
      setMachineCode(machineParts.machineCode);
      setDateFrom(toDatetimeLocal(s.date_from));
      setDateTo(toDatetimeLocal(s.date_to));
      setStatus(s.status ?? "Scheduled");
      setNotes(s.notes ?? "");
      setSelectedTests((s.amats_session_tests ?? []).map((t: { test_name: string }) => t.test_name));
      setSelectedEngineers(
        (s.amats_session_assignments ?? [])
          .filter((a: { assignment_type: string }) => a.assignment_type === "test_engineer")
          .map((a: { staff: { id: string } }) => a.staff?.id)
          .filter(Boolean)
      );
      setSelectedTechnicians(
        (s.amats_session_assignments ?? [])
          .filter((a: { assignment_type: string }) => a.assignment_type === "test_technician")
          .map((a: { staff: { id: string } }) => a.staff?.id)
          .filter(Boolean)
      );

      setLoaded(true);
    };
    init();
  }, [id, router]);

  // When machine changes, refresh available tests (but keep existing selections if still valid)
  useEffect(() => {
    if (machine) {
      const tests = dynamicMachines.find(m => m.machine === machine)?.tests || [];
      setAvailableTests(tests);
    } else {
      setAvailableTests([]);
    }
  }, [machine, dynamicMachines]);

  // Fetch availability when dates change
  useEffect(() => {
    if (!dateFrom || !dateTo) { setStaffAvailability({}); return; }
    let cancelled = false;
    async function fetchAvailability() {
      setAvailabilityLoading(true);
      try {
        // Exclude this session from conflict checks
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, exclude_session_id: id });
        const res = await fetch(`/api/staff/availability?${params}`);
        const data = await res.json();
        if (!cancelled) setStaffAvailability(data.unavailable ?? {});
      } catch { /* silently ignore */ }
      finally { if (!cancelled) setAvailabilityLoading(false); }
    }
    fetchAvailability();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, id]);

  function getUnavailableLabel(info: UnavailableInfo): string {
    if (info.reason === "conflict") return `Assigned to ${info.dispatch_number}`;
    return `Cooldown until ${info.until} (${info.dispatch_number})`;
  }

  const toggleTest = useCallback((test: string) => {
    setSelectedTests((prev) => prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]);
  }, []);

  const toggleEngineer = useCallback((staffId: string) => {
    if (staffAvailability[staffId]) return;
    setSelectedEngineers((prev) => prev.includes(staffId) ? prev.filter((e) => e !== staffId) : [...prev, staffId]);
  }, [staffAvailability]);

  const toggleTechnician = useCallback((staffId: string) => {
    if (staffAvailability[staffId]) return;
    setSelectedTechnicians((prev) => prev.includes(staffId) ? prev.filter((t) => t !== staffId) : [...prev, staffId]);
  }, [staffAvailability]);

  const handleSelectAllTests = () => {
    setSelectedTests(selectedTests.length === availableTests.length ? [] : [...availableTests]);
  };

  const handleSave = async () => {
    setError(null);
    const sessionNumberSuffix = getSessionSuffix(sessionNumber);
    if (!sessionNumberSuffix) { setError("Session number is required."); return; }
    if (!/^\d{4}-\d{4}$/.test(sessionNumberSuffix)) {
      setError("Session number must follow yyyy-####, for example 2026-0001.");
      return;
    }
    if (!machine) { setError("Machine selection is required."); return; }
    if (!dateFrom || !dateTo) { setError("Date From and Date To are required."); return; }
    if (selectedTests.length === 0) { setError("At least one test must be selected."); return; }
    if (new Date(dateTo) < new Date(dateFrom)) { setError("Date To cannot be before Date From."); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/amats/sessions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_number: formatSessionNumber(sessionNumberSuffix),
          machine,
          machine_name_or_code: buildMachineNameOrCode(machineName, brandModel, machineCode),
          date_from: dateFrom,
          date_to: dateTo,
          status,
          notes: notes.trim() || null,
          selected_tests: selectedTests,
          engineers: selectedEngineers.map((staff_id) => ({ staff_id })),
          technicians: selectedTechnicians.map((staff_id) => ({ staff_id })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update session");

      router.push(`/amats/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-gray-400">Loading session...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push(`/amats/${id}`)}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
            >
              ← Back to Session
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Session</h1>
            <p className="text-sm text-gray-500 mt-1 font-mono">{formatSessionNumber(sessionNumber)}</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* Status */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Status
            </h2>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    status === s
                      ? "bg-red-700 text-white border-red-700"
                      : "bg-white text-gray-600 border-gray-300 hover:border-red-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* Machine */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Session Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Number <span className="text-red-500">*</span>
                </label>
                <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-red-500">
                  <span className="flex items-center border-r border-gray-300 bg-gray-50 px-3 text-sm font-semibold text-gray-700">
                    TAM
                  </span>
                  <input
                    type="text"
                    value={sessionNumber}
                    onChange={(e) => setSessionNumber(getSessionSuffix(e.target.value))}
                    placeholder="2026-0001"
                    className="w-full border-0 px-3 py-2 text-sm text-gray-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Machine */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Machine
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
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
                  Machine Name
                </label>
                <input
                  type="text"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  placeholder="e.g. GOLDEN BOW"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand Model
                </label>
                <input
                  type="text"
                  value={brandModel}
                  onChange={(e) => setBrandModel(e.target.value)}
                  placeholder="e.g. 80DI"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={machineCode}
                  onChange={(e) => setMachineCode(e.target.value)}
                  placeholder="e.g. TAM-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-gray-400"
                />
              </div>
            </div>
          </section>

          {/* Tests */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-1 pb-2 border-b border-gray-100">
              Machine Testing and Studies <span className="text-red-500">*</span>
            </h2>
            {!machine ? (
              <div className="mt-4 text-sm text-gray-400 italic">Select a machine above to see available tests.</div>
            ) : (
              <>
                <div className="flex items-center justify-between mt-4 mb-3">
                  <p className="text-sm text-gray-500">{selectedTests.length} of {availableTests.length} tests selected</p>
                  <button type="button" onClick={handleSelectAllTests} className="text-xs text-red-600 hover:text-red-800 font-medium">
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

          {/* Date and Time */}
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

          {/* Personnel */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Personnel</h2>
            {(!dateFrom || !dateTo) && (
              <p className="text-xs text-amber-500 mb-3">Set testing dates above to see availability.</p>
            )}
            {availabilityLoading && (
              <p className="text-xs text-blue-500 animate-pulse mb-3">Checking staff availability...</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Engineers */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Test Engineers
                  {selectedEngineers.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-red-600">{selectedEngineers.length} selected</span>
                  )}
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {engineers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No engineers found.</p>
                  ) : (
                    engineers.map((eng) => {
                      const unavail = staffAvailability[eng.id];
                      const isSelected = selectedEngineers.includes(eng.id);
                      return (
                        <label
                          key={eng.id}
                          className={`flex items-start gap-3 px-3 py-2 rounded-lg border transition-colors ${
                            unavail
                              ? "opacity-40 cursor-not-allowed pointer-events-none bg-gray-100 border-gray-200"
                              : isSelected
                              ? "bg-red-50 border-red-300 cursor-pointer"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer"
                          }`}
                        >
                          <input type="checkbox" checked={isSelected} disabled={!!unavail}
                            onChange={() => toggleEngineer(eng.id)} className="accent-red-600 w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className={`text-sm font-medium ${unavail ? "text-gray-400 line-through" : "text-gray-800"}`}>
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

              {/* Technicians */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Test Technicians
                  {selectedTechnicians.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-red-600">{selectedTechnicians.length} selected</span>
                  )}
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {technicians.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No technicians found.</p>
                  ) : (
                    technicians.map((tech) => {
                      const unavail = staffAvailability[tech.id];
                      const isSelected = selectedTechnicians.includes(tech.id);
                      return (
                        <label
                          key={tech.id}
                          className={`flex items-start gap-3 px-3 py-2 rounded-lg border transition-colors ${
                            unavail
                              ? "opacity-40 cursor-not-allowed pointer-events-none bg-gray-100 border-gray-200"
                              : isSelected
                              ? "bg-red-50 border-red-300 cursor-pointer"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer"
                          }`}
                        >
                          <input type="checkbox" checked={isSelected} disabled={!!unavail}
                            onChange={() => toggleTechnician(tech.id)} className="accent-red-600 w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className={`text-sm font-medium ${unavail ? "text-gray-400 line-through" : "text-gray-800"}`}>
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

          {/* Notes */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Remarks, observations, or additional notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 resize-y placeholder:text-gray-400"
            />
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-8">
            <button
              onClick={() => router.push(`/amats/${id}`)}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
