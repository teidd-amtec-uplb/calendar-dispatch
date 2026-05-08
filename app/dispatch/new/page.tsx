"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import AppLayout from "../../components/AppLayout";

type TransportMode =
  | "public_conveyance"
  | "test_applicant_vehicle"
  | "college_vehicle"
  | "other";

type Tab = "basic" | "machines" | "instruments";

type InstrumentOption = {
  id: string;
  instrument_name: string;
  type: string | null;
  brand: string | null;
  model: string | null;
  instrument_code: string | null;
};

type SelectedInstrument = {
  rowId: string;
  instrument_id: string;
  instrument_name: string;
  code_brand_model: string;
  before_travel: string;
  remarks: string;
  auto_added?: boolean;
};

type Machine = {
  id: string;
  tam_no: string;
  machine: string;
  brand: string;
  model: string;
  serial_no: string;
  date_of_test: string;
};

function newMachine(): Machine {
  return { id: crypto.randomUUID(), tam_no: "", machine: "", brand: "", model: "", serial_no: "", date_of_test: "" };
}

function newSelectedInstrument(auto_added = false): SelectedInstrument {
  return { rowId: crypto.randomUUID(), instrument_id: "", instrument_name: "", code_brand_model: "", before_travel: "", remarks: "", auto_added };
}

export default function NewDispatchPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  // Basic Info
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [transportMode, setTransportMode] = useState<TransportMode>("public_conveyance");
  const [transportOther, setTransportOther] = useState("");
  const [notes, setNotes] = useState("");
  const [remarks, setRemarks] = useState("");
  const [testingLocation, setTestingLocation] = useState("");
  const [locationType, setLocationType] = useState<"amtec" | "clients_place">("amtec");
  const [engineers, setEngineers] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedEngineerIds, setSelectedEngineerIds] = useState<string[]>([]);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);

  // Instruments
  const [instrumentOptions, setInstrumentOptions] = useState<InstrumentOption[]>([]);
  const [selectedInstruments, setSelectedInstruments] = useState<SelectedInstrument[]>([newSelectedInstrument()]);
  const [instrumentSearch, setInstrumentSearch] = useState<Record<string, string>>({});
  const [instrumentDropdownOpen, setInstrumentDropdownOpen] = useState<Record<string, boolean>>({});

  // Machines
  const [machineOptions, setMachineOptions] = useState<string[]>([]);
  const [machineSearch, setMachineSearch] = useState<Record<string, string>>({});
  const [machineDropdownOpen, setMachineDropdownOpen] = useState<Record<string, boolean>>({});
  const [machines, setMachines] = useState<Machine[]>([newMachine()]);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("error");

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login"); return; }
      if (cancelled) return;

      const meRes = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      });
      const meData = await meRes.json();
      if (meData.profile?.role !== "admin_scheduler") { router.push("/dashboard"); return; }

      setUserId(data.user.id);

      const [engRes, techRes, instRes, machRes] = await Promise.all([
        fetch("/api/staff/engineers"),
        fetch("/api/staff/technicians"),
        fetch("/api/instruments"),
        fetch("/api/machines"),
      ]);
      const engData = await engRes.json();
      const techData = await techRes.json();
      const instData = await instRes.json();
      const machData = await machRes.json();
      if (cancelled) return;
      setEngineers(engData.staff ?? []);
      setTechnicians(techData.staff ?? []);
      setInstrumentOptions(instData.instruments ?? []);
      setMachineOptions(machData.machines ?? []);
      setLoading(false);
    }
    loadAll();
    return () => { cancelled = true; };
  }, [router, supabase]);

  // ── Personnel checkbox helpers ──────────────────────────────────────────────
  function toggleEngineer(id: string) {
    setSelectedEngineerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }
  function toggleTechnician(id: string) {
    setSelectedTechnicianIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // ── Instrument helpers ──────────────────────────────────────────────────────
  function getFilteredOptions(rowId: string): InstrumentOption[] {
    const search = (instrumentSearch[rowId] ?? "").toLowerCase();
    if (!search) return instrumentOptions;
    return instrumentOptions.filter(o =>
      o.instrument_name.toLowerCase().includes(search) ||
      (o.instrument_code ?? "").toLowerCase().includes(search) ||
      (o.brand ?? "").toLowerCase().includes(search) ||
      (o.type ?? "").toLowerCase().includes(search)
    );
  }

  function selectInstrumentOption(rowId: string, option: InstrumentOption) {
    const codeBrandModel = [option.instrument_code, option.brand, option.model]
      .filter(Boolean).join(" / ");
    setSelectedInstruments(prev => prev.map(i =>
      i.rowId === rowId
        ? { ...i, instrument_id: option.id, instrument_name: option.instrument_name, code_brand_model: codeBrandModel }
        : i
    ));
    setInstrumentSearch(prev => ({ ...prev, [rowId]: option.instrument_name }));
    setInstrumentDropdownOpen(prev => ({ ...prev, [rowId]: false }));
  }

  function updateInstrument(rowId: string, field: keyof SelectedInstrument, value: string) {
    setSelectedInstruments(prev => prev.map(i => i.rowId === rowId ? { ...i, [field]: value } : i));
  }

  function addInstrumentRow() {
    setSelectedInstruments(prev => [...prev, newSelectedInstrument()]);
  }

  function removeInstrumentRow(rowId: string) {
    setSelectedInstruments(prev => prev.length > 1 ? prev.filter(i => i.rowId !== rowId) : prev);
  }

  // ── Machine helpers ─────────────────────────────────────────────────────────
  function getFilteredMachineOptions(rowId: string): string[] {
    const q = (machineSearch[rowId] ?? "").toLowerCase();
    if (!q) return machineOptions;
    return machineOptions.filter(m => m.toLowerCase().includes(q));
  }

  const rebuildInstrumentsFromMachines = useCallback(async (currentMachines: Machine[]) => {
    const machineNames = currentMachines.map(m => m.machine).filter(Boolean);
    if (machineNames.length === 0) {
      setSelectedInstruments([newSelectedInstrument()]);
      setInstrumentSearch({});
      return;
    }
    try {
      const results = await Promise.all(
        machineNames.map(async name => {
          const res = await fetch(`/api/machine-instruments?machine=${encodeURIComponent(name)}`);
          const data = await res.json();
          const rawNames: string[] = data.instrument_names ?? [];
          return rawNames.flatMap(n =>
            n === 'Graduated Cylinder / Power Meter' ? ['Graduated Cylinder', 'Power Meter'] : [n]
          );
        })
      );
      const allInstrumentNames = results.flat();
      const uniqueNames = [...new Set(allInstrumentNames.map(n => n.toLowerCase()))]
        .map(lower => allInstrumentNames.find(n => n.toLowerCase() === lower)!);
      if (uniqueNames.length === 0) {
        setSelectedInstruments([newSelectedInstrument()]);
        setInstrumentSearch({});
        return;
      }
      const usedCodes = new Set<string>();
      const autoInstruments: SelectedInstrument[] = uniqueNames.map(name => {
        const allMatches = instrumentOptions.filter(o => o.instrument_name.toLowerCase() === name.toLowerCase());
        let bestMatch = allMatches.find(o => {
          const code = [o.instrument_code, o.brand, o.model].filter(Boolean).join(" / ");
          return code && !usedCodes.has(code);
        });
        if (!bestMatch && allMatches.length > 0) bestMatch = allMatches[0];
        const code = bestMatch ? [bestMatch.instrument_code, bestMatch.brand, bestMatch.model].filter(Boolean).join(" / ") : "";
        if (code) usedCodes.add(code);
        return { rowId: crypto.randomUUID(), instrument_id: bestMatch?.id ?? "", instrument_name: name, code_brand_model: code, before_travel: "", remarks: "", auto_added: true };
      });
      const searchMap: Record<string, string> = {};
      autoInstruments.forEach(i => { searchMap[i.rowId] = i.instrument_name; });
      setSelectedInstruments(autoInstruments);
      setInstrumentSearch(searchMap);
    } catch { /* silently ignore */ }
  }, [instrumentOptions]);

  function selectMachineOption(rowId: string, machineName: string) {
    setMachines(prev => {
      const updated = prev.map(m => m.id === rowId ? { ...m, machine: machineName } : m);
      rebuildInstrumentsFromMachines(updated);
      return updated;
    });
    setMachineSearch(prev => ({ ...prev, [rowId]: machineName }));
    setMachineDropdownOpen(prev => ({ ...prev, [rowId]: false }));
  }

  function updateMachine(id: string, field: keyof Machine, value: string) {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  }
  function addMachine() { setMachines(prev => [...prev, newMachine()]); }
  function removeMachine(id: string) {
    setMachines(prev => {
      const updated = prev.filter(m => m.id !== id);
      const remaining = updated.length > 0 ? updated : [newMachine()];
      rebuildInstrumentsFromMachines(remaining);
      return remaining;
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function saveDispatch() {
    setMsg("Saving...");
    setMsgType("error");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setMsg("Error: Not authenticated"); return; }

    const cleanInstruments = selectedInstruments
      .filter(i => i.instrument_id !== "")
      .map(({ rowId, auto_added, ...rest }) => rest);

    const cleanMachines = machines
      .filter(m => m.machine.trim() !== "")
      .map(({ id, ...rest }) => rest);

    const res = await fetch("/api/dispatches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        userId,
        date_from: dateFrom,
        date_to: dateTo,
        company_name: companyName,
        contact_info: contactInfo,
        testing_location: locationType === "clients_place" ? testingLocation : "AMTEC",
        type: locationType === "amtec" ? "in_house" : "on_field",
        transport_mode: transportMode,
        transport_other_text: transportMode === "other" ? transportOther : null,
        notes,
        remarks_observation: remarks,
        engineer_ids: selectedEngineerIds,
        technician_ids: selectedTechnicianIds,
        instruments: cleanInstruments,
        itinerary: [],
        machines: cleanMachines,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setMsg(`Error: ${data.error ?? "Unknown error"}`); return; }
    setMsgType("success");
    setMsg("Dispatch created! Redirecting...");
    setTimeout(() => router.push("/dashboard"), 1000);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F6FB" }}>
      <p className="text-gray-400 text-sm">Loading form...</p>
    </div>
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "basic", label: "Basic Info" },
    { key: "machines", label: `Machines${machines.some(m => m.machine) ? ` (${machines.filter(m => m.machine).length})` : ""}` },
    { key: "instruments", label: `Instruments${selectedInstruments.some(i => i.instrument_id) ? ` (${selectedInstruments.filter(i => i.instrument_id).length})` : ""}` },
  ];

  const inputClass = "w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-100";
  const inputStyle = { borderColor: "#D1D5DB", color: "#111827" };
  const labelClass = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5";

  return (
    <AppLayout>
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#F5A623" }}>
            Dispatch Management
          </p>
          <h1 className="text-2xl font-black text-gray-900">Create New Dispatch</h1>
          <p className="text-sm text-gray-500 mt-1">Fill in the details below to create a dispatch record.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Tab Bar */}
          <div className="flex border-b border-gray-200" style={{ background: "#F8F9FB" }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-6 py-3.5 text-xs font-bold uppercase tracking-widest transition-all"
                style={{
                  color: activeTab === tab.key ? "#1B2A6B" : "#9CA3AF",
                  borderBottom: activeTab === tab.key ? "2px solid #1B2A6B" : "2px solid transparent",
                  background: "transparent",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB: Basic Info ─────────────────────────────────────────────── */}
          {activeTab === "basic" && (
            <>
              {/* Schedule */}
              <div className="px-6 py-4 border-b border-gray-100" style={{ background: "#F8F9FB" }}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Schedule</h2>
              </div>
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100">
                <div>
                  <label className={labelClass}>Date From</label>
                  <input type="date" className={inputClass} style={inputStyle}
                    value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Date To</label>
                  <input type="date" className={inputClass} style={inputStyle}
                    value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>

              {/* Personnel — Checkboxes */}
              <div className="px-6 py-4 border-b border-gray-100" style={{ background: "#F8F9FB" }}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Personnel Assignment</h2>
              </div>
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-100">
                {/* Engineers */}
                <div>
                  <label className={labelClass}>
                    Engineers
                    {selectedEngineerIds.length > 0 && (
                      <span className="ml-2 normal-case font-normal text-blue-500">
                        {selectedEngineerIds.length} selected
                      </span>
                    )}
                  </label>
                  {engineers.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No engineers available.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {engineers.map(p => (
                        <label key={p.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all"
                          style={{
                            borderColor: selectedEngineerIds.includes(p.id) ? "#1B2A6B" : "#E5E7EB",
                            background: selectedEngineerIds.includes(p.id) ? "#EEF1FB" : "white",
                          }}>
                          <input
                            type="checkbox"
                            checked={selectedEngineerIds.includes(p.id)}
                            onChange={() => toggleEngineer(p.id)}
                            className="rounded"
                            style={{ accentColor: "#1B2A6B" }}
                          />
                          <span className="text-sm text-gray-800">{p.full_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Technicians */}
                <div>
                  <label className={labelClass}>
                    Technicians
                    {selectedTechnicianIds.length > 0 && (
                      <span className="ml-2 normal-case font-normal text-blue-500">
                        {selectedTechnicianIds.length} selected
                      </span>
                    )}
                  </label>
                  {technicians.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No technicians available.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {technicians.map(p => (
                        <label key={p.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all"
                          style={{
                            borderColor: selectedTechnicianIds.includes(p.id) ? "#1B2A6B" : "#E5E7EB",
                            background: selectedTechnicianIds.includes(p.id) ? "#EEF1FB" : "white",
                          }}>
                          <input
                            type="checkbox"
                            checked={selectedTechnicianIds.includes(p.id)}
                            onChange={() => toggleTechnician(p.id)}
                            className="rounded"
                            style={{ accentColor: "#1B2A6B" }}
                          />
                          <span className="text-sm text-gray-800">{p.full_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Company & Transport */}
              <div className="px-6 py-4 border-b border-gray-100" style={{ background: "#F8F9FB" }}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Company & Transport</h2>
              </div>
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100">
                <div>
                  <label className={labelClass}>Company Name</label>
                  <input className={inputClass} style={inputStyle}
                    value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Sample Company" />
                </div>
                <div>
                  <label className={labelClass}>Contact Person / Info</label>
                  <input className={inputClass} style={inputStyle}
                    value={contactInfo} onChange={e => setContactInfo(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz - 0912..." />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Location of Testing</label>
                  <div className="flex gap-6 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input type="radio" name="locationType" value="amtec"
                        checked={locationType === "amtec"}
                        onChange={() => { setLocationType("amtec"); setTestingLocation(""); }} />
                      AMTEC
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input type="radio" name="locationType" value="clients_place"
                        checked={locationType === "clients_place"}
                        onChange={() => setLocationType("clients_place")} />
                      Client's Place
                    </label>
                  </div>
                  {locationType === "clients_place" && (
                    <input className={inputClass} style={inputStyle}
                      value={testingLocation} onChange={e => setTestingLocation(e.target.value)}
                      placeholder="e.g. Brgy. Pulo, Cabuyao, Laguna" />
                  )}
                </div>
                <div>
                  <label className={labelClass}>Mode of Transportation</label>
                  <select className={inputClass} style={inputStyle}
                    value={transportMode} onChange={e => setTransportMode(e.target.value as TransportMode)}>
                    <option value="public_conveyance">Public Conveyance</option>
                    <option value="test_applicant_vehicle">Test Applicant Vehicle</option>
                    <option value="college_vehicle">College Vehicle</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {transportMode === "other" && (
                  <div>
                    <label className={labelClass}>Specify Transport</label>
                    <input className={inputClass} style={inputStyle}
                      value={transportOther} onChange={e => setTransportOther(e.target.value)}
                      placeholder="Enter transport mode" />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="px-6 py-4 border-b border-gray-100" style={{ background: "#F8F9FB" }}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Additional Information</h2>
              </div>
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Remarks / Observation</label>
                  <textarea rows={4} className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none resize-none"
                    style={inputStyle}
                    value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea rows={4} className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none resize-none"
                    style={inputStyle}
                    value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── TAB: Instruments ────────────────────────────────────────────── */}
          {activeTab === "instruments" && (
            <div className="px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Instruments for Dispatch</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Search and select instruments to include in this dispatch.</p>
                </div>
                <button onClick={addInstrumentRow}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: "#1B2A6B", color: "white" }}>
                  + Add Instrument
                </button>
              </div>

              <div className="space-y-3">
                {selectedInstruments.map((inst, idx) => {
                  const filtered = getFilteredOptions(inst.rowId);
                  const isOpen = instrumentDropdownOpen[inst.rowId] ?? false;

                  return (
                    <div key={inst.rowId} className="rounded-lg border p-4"
                      style={{ background: inst.auto_added ? "#F0F7FF" : "#F8F9FB", borderColor: inst.auto_added ? "#BFDBFE" : "#E5E7EB" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Instrument {idx + 1}</span>
                          {inst.auto_added && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#DBEAFE", color: "#1E40AF" }}>Auto</span>
                          )}
                        </div>
                        {selectedInstruments.length > 1 && (
                          <button onClick={() => removeInstrumentRow(inst.rowId)}
                            className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Searchable instrument picker */}
                        <div className="md:col-span-2 relative">
                          <label className={labelClass}>Instrument Name</label>
                          <input
                            className={inputClass}
                            style={{ ...inputStyle, background: "white" }}
                            placeholder="Search by name, code, or brand..."
                            value={instrumentSearch[inst.rowId] ?? ""}
                            onChange={e => {
                              setInstrumentSearch(prev => ({ ...prev, [inst.rowId]: e.target.value }));
                              setInstrumentDropdownOpen(prev => ({ ...prev, [inst.rowId]: true }));
                              if (inst.instrument_id) {
                                updateInstrument(inst.rowId, "instrument_id", "");
                                updateInstrument(inst.rowId, "instrument_name", "");
                                updateInstrument(inst.rowId, "code_brand_model", "");
                              }
                            }}
                            onFocus={() => setInstrumentDropdownOpen(prev => ({ ...prev, [inst.rowId]: true }))}
                            onBlur={() => setTimeout(() => setInstrumentDropdownOpen(prev => ({ ...prev, [inst.rowId]: false })), 150)}
                          />
                          {isOpen && filtered.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {filtered.slice(0, 50).map(option => (
                                <button
                                  key={option.id}
                                  type="button"
                                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                                  onMouseDown={() => selectInstrumentOption(inst.rowId, option)}
                                >
                                  <span className="text-sm font-medium text-gray-800">{option.instrument_name}</span>
                                  {option.type && <span className="text-xs text-gray-400 ml-1">({option.type})</span>}
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {[option.instrument_code, option.brand, option.model].filter(Boolean).join(" · ")}
                                  </div>
                                </button>
                              ))}
                              {filtered.length > 50 && (
                                <p className="px-4 py-2 text-xs text-gray-400 text-center">
                                  Showing 50 of {filtered.length} — type to narrow results
                                </p>
                              )}
                            </div>
                          )}
                          {isOpen && filtered.length === 0 && (instrumentSearch[inst.rowId] ?? "").length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                              <p className="px-4 py-3 text-xs text-gray-400 text-center">No instruments found</p>
                            </div>
                          )}
                        </div>

                        {/* Code / Brand / Model — auto-filled */}
                        <div>
                          <label className={labelClass}>Code / Brand / Model</label>
                          <input
                            className={inputClass}
                            style={{ ...inputStyle, background: inst.instrument_id ? "#F3F4F6" : "white" }}
                            value={inst.code_brand_model}
                            readOnly={!!inst.instrument_id}
                            onChange={e => updateInstrument(inst.rowId, "code_brand_model", e.target.value)}
                            placeholder="Auto-filled on selection"
                          />
                        </div>

                        {/* Before Travel — radio buttons */}
                        <div>
                          <label className={labelClass}>Before Travel</label>
                          <div className="flex gap-4 mt-1">
                            {["Good Condition", "Not Good Condition"].map(option => (
                              <label key={option}
                                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm"
                                style={{
                                  borderColor: inst.before_travel === option ? "#1B2A6B" : "#E5E7EB",
                                  background: inst.before_travel === option ? "#EEF1FB" : "white",
                                  color: inst.before_travel === option ? "#1B2A6B" : "#6B7280",
                                  fontWeight: inst.before_travel === option ? 600 : 400,
                                }}>
                                <input
                                  type="radio"
                                  name={`before_travel_${inst.rowId}`}
                                  value={option}
                                  checked={inst.before_travel === option}
                                  onChange={() => updateInstrument(inst.rowId, "before_travel", option)}
                                  style={{ accentColor: "#1B2A6B" }}
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Remarks */}
                        <div className="md:col-span-2">
                          <label className={labelClass}>Remarks</label>
                          <input
                            className={inputClass}
                            style={{ ...inputStyle, background: "white" }}
                            value={inst.remarks}
                            onChange={e => updateInstrument(inst.rowId, "remarks", e.target.value)}
                            placeholder="e.g. Handle with care"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}



          {/* ── TAB: Machines ───────────────────────────────────────────────── */}
          {activeTab === "machines" && (
            <div className="px-6 py-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Machines for Testing</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Select a machine to auto-populate its instruments.</p>
                </div>
                <button onClick={addMachine}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: "#1B2A6B", color: "white" }}>
                  + Add Machine
                </button>
              </div>

              <div className="space-y-3 mt-4">
                {machines.map((machine, idx) => (
                  <div key={machine.id} className="rounded-lg border border-gray-200 p-4" style={{ background: "#F8F9FB" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Machine {idx + 1}</span>
                      {machines.length > 1 && (
                        <button onClick={() => removeMachine(machine.id)}
                          className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>TAM No.</label>
                        <input className={inputClass} style={{ ...inputStyle, background: "white" }}
                          value={machine.tam_no}
                          onChange={e => updateMachine(machine.id, "tam_no", e.target.value)}
                          placeholder="e.g. 2026-001" />
                      </div>
                      <div className="relative md:col-span-2">
                        <label className={labelClass}>Machine</label>
                        <input className={inputClass} style={{ ...inputStyle, background: "white" }}
                          placeholder="Search or type machine name..."
                          value={machineSearch[machine.id] ?? machine.machine}
                          onChange={e => {
                            const val = e.target.value;
                            setMachineSearch(prev => ({ ...prev, [machine.id]: val }));
                            updateMachine(machine.id, "machine", val);
                            setMachineDropdownOpen(prev => ({ ...prev, [machine.id]: true }));
                          }}
                          onFocus={() => setMachineDropdownOpen(prev => ({ ...prev, [machine.id]: true }))}
                          onBlur={() => setTimeout(() => setMachineDropdownOpen(prev => ({ ...prev, [machine.id]: false })), 150)} />
                        {(machineDropdownOpen[machine.id] ?? false) && (
                          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                            {getFilteredMachineOptions(machine.id).length > 0
                              ? getFilteredMachineOptions(machine.id).map(name => (
                                <button key={name} type="button"
                                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                                  onMouseDown={() => selectMachineOption(machine.id, name)}>
                                  <span className="text-sm text-gray-800">{name}</span>
                                </button>
                              ))
                              : <div className="px-4 py-3 text-xs text-gray-400 text-center">
                                {(machineSearch[machine.id] ?? "").length > 0
                                  ? `"${machineSearch[machine.id]}" — will be used as entered`
                                  : "Start typing to search machines..."}
                              </div>}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={labelClass}>Brand</label>
                        <input className={inputClass} style={{ ...inputStyle, background: "white" }}
                          value={machine.brand}
                          onChange={e => updateMachine(machine.id, "brand", e.target.value)}
                          placeholder="e.g. Kubota" />
                      </div>
                      <div>
                        <label className={labelClass}>Model</label>
                        <input className={inputClass} style={{ ...inputStyle, background: "white" }}
                          value={machine.model}
                          onChange={e => updateMachine(machine.id, "model", e.target.value)}
                          placeholder="e.g. SPU-68C" />
                      </div>
                      <div>
                        <label className={labelClass}>Serial No.</label>
                        <input className={inputClass} style={{ ...inputStyle, background: "white" }}
                          value={machine.serial_no}
                          onChange={e => updateMachine(machine.id, "serial_no", e.target.value)}
                          placeholder="e.g. SN-20260001" />
                      </div>
                      <div>
                        <label className={labelClass}>Date of Test</label>
                        <input type="date" className={inputClass} style={{ ...inputStyle, background: "white" }}
                          value={machine.date_of_test}
                          onChange={e => updateMachine(machine.id, "date_of_test", e.target.value)} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 italic">
                      Machine status (Passed / Failed) will be filled in after testing via the dispatch detail page.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-4" style={{ background: "#F8F9FB" }}>
            <button onClick={saveDispatch}
              className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "#1B2A6B", color: "white" }}>
              Save Dispatch
            </button>
            <button onClick={() => router.push("/dispatches")}
              className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: "white", color: "#6B7280", border: "1px solid #D1D5DB" }}>
              Cancel
            </button>
            {msg && (
              <p className="text-sm font-medium ml-2"
                style={{ color: msgType === "success" ? "#16A34A" : "#DC2626" }}>
                {msg}
              </p>
            )}
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
