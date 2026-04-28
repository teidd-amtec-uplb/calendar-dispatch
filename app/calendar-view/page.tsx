"use client";
import { useEffect, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type AssignmentType = "engineer" | "lead_engineer" | "assistant_engineer" | "technician";

type Assignment = {
  id: string;
  assignment_type: AssignmentType;
  staff: { id: string; full_name: string; initials: string | null } | null;
};

type Machine = {
  id: string;
  tam_no: string | null;
  machine: string | null;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  date_of_test: string | null;
  status: string | null;
};

type Dispatch = {
  id: string;
  dispatch_number: string | null;
  company_name: string | null;
  location: string | null;
  date_from: string | null;
  date_to: string | null;
  type: string;
  status: string;
  transport_mode: string | null;
  testing_location: string | null;
  notes: string | null;
  created_by_role: string | null;
  dispatch_assignments: Assignment[];
  dispatch_machines: Machine[];
};


type AmatsSession = {
  id: string;
  session_number: string;
  machine: string;
  machine_name_or_code: string | null;
  date_from: string;
  date_to: string;
  status: string;
  amats_session_tests: { id: string; test_name: string }[];
  amats_session_assignments: { id: string; assignment_type: string; staff: { id: string; full_name: string; initials: string } | null }[];
  _type?: 'amats';
};

// ─── Status styles ───────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string; badge: string; badgeText: string }> = {
  Pending:        { bg: "#FFFBEB", dot: "#F59E0B", text: "#92400E", badge: "#FEF3C7", badgeText: "#92400E" },
  Scheduled:      { bg: "#EEF1FB", dot: "#1B2A6B", text: "#1B2A6B", badge: "#EEF1FB", badgeText: "#1B2A6B" },
  "Re-scheduled": { bg: "#FFFBEB", dot: "#D97706", text: "#78350F", badge: "#FDE68A", badgeText: "#78350F" },
  Ongoing:        { bg: "#EFF6FF", dot: "#3B82F6", text: "#1E40AF", badge: "#DBEAFE", badgeText: "#1E40AF" },
  Cancelled:      { bg: "#FEF2F2", dot: "#EF4444", text: "#991B1B", badge: "#FEE2E2", badgeText: "#991B1B" },
  Done:           { bg: "#F0FDF4", dot: "#22C55E", text: "#065F46", badge: "#D1FAE5", badgeText: "#065F46" },
};

const TRANSPORT_LABELS: Record<string, string> = {
  public_conveyance: "Public Conveyance",
  test_applicant_vehicle: "Test Applicant Vehicle",
  college_vehicle: "College Vehicle",
  other: "Other",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June",
                 "July","August","September","October","November","December"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(toKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function CalendarViewPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [selectedAmatsSession, setSelectedAmatsSession] = useState<AmatsSession | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);

  // Build map: { "YYYY-MM-DD": Dispatch[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatchMap = useCallback((): Record<string, any[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, any[]> = {};
    if (filterSource !== 'amats') {
      const filtered = filterStatus === 'All' ? dispatches : dispatches.filter(d => d.status === filterStatus);
      for (const d of filtered) {
        if (!d.date_from || !d.date_to) continue;
        for (const key of getDateRange(d.date_from, d.date_to)) {
          if (!map[key]) map[key] = [];
          map[key].push({ ...d, _type: 'dispatch' });
        }
      }
    }
    if (filterSource !== 'dispatch') {
      const filtered = filterStatus === 'All' ? amatsSessions : amatsSessions.filter(s => s.status === filterStatus);
      for (const s of filtered) {
        if (!s.date_from || !s.date_to) continue;
        const from = s.date_from.slice(0, 10);
        const to = s.date_to.slice(0, 10);
        for (const key of getDateRange(from, to)) {
          if (!map[key]) map[key] = [];
          map[key].push({ ...s, _type: 'amats' });
        }
      }
    }
    return map;
  }, [dispatches, amatsSessions, filterStatus, filterSource]);

  useEffect(() => {
    Promise.all([
      fetch('/api/public/dispatches').then(r => r.json()),
      fetch('/api/public/amats-sessions').then(r => r.json()),
    ]).then(([dd, sa]) => {
      setDispatches(dd.dispatches ?? []);
      setAmatsSessions(sa.sessions ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toKey(today);
  const map = dispatchMap();

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
    setSelectedDispatch(null);
    setSelectedAmatsSession(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
    setSelectedDispatch(null);
    setSelectedAmatsSession(null);
  }

  const dayDispatches = selectedDay ? (map[selectedDay] ?? []) : [];

  return (
    <div className="min-h-screen" style={{ background: "#F4F6FB", fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 shadow-sm"
        style={{ background: "linear-gradient(90deg, #0F1A4A 0%, #1B2A6B 100%)" }}>
        <div className="flex items-center gap-3">
          <img src="/amtec-logo.png" alt="AMTEC" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-white font-black text-sm leading-none">AMTEC UPLB</p>
            <p className="text-xs" style={{ color: "#F5A623" }}>Dispatch Calendar</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {["All", "Scheduled", "Ongoing", "Done", "Pending", "Re-scheduled", "Cancelled"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: filterStatus === s
                    ? (STATUS_COLORS[s]?.badge ?? "white")
                    : "rgba(255,255,255,0.1)",
                  color: filterStatus === s
                    ? (STATUS_COLORS[s]?.badgeText ?? "#111")
                    : "rgba(255,255,255,0.7)",
                  border: filterStatus === s ? "none" : "1px solid rgba(255,255,255,0.2)",
                }}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5">
            {([['all','All'],['dispatch','Dispatches'],['amats','AMaTS']] as const).map(([v,l]) => (
              <button key={v} onClick={()=>setFilterSource(v)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{ background: filterSource===v ? 'white' : 'transparent', color: filterSource===v ? '#0F1A4A' : 'rgba(255,255,255,0.7)' }}>
                {v==='amats' ? '🧪 ' : ''}{l}
              </button>
            ))}
          </div>
          <a href="/workload-view"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border border-white/20 hover:bg-white/10 transition-all">
            📊 Workload
          </a>
          <a href="/login"
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
            style={{ background: "#F5A623", color: "#0F1A4A" }}>
            Staff Login
          </a>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)] overflow-hidden">
        {/* ── LEFT: Calendar ─────────────────────────────────────────────────── */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Month nav */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900">
                {MONTHS[month]} {year}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {dispatches.length} dispatch{dispatches.length !== 1 ? 'es' : ''} · {amatsSessions.length} AMaTS
                {filterStatus !== "All" && ` · ${filterStatus}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={prevMonth}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all text-gray-600 font-bold">
                ‹
              </button>
              <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
                className="px-3 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-600 transition-all">
                Today
              </button>
              <button onClick={nextMonth}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all text-gray-600 font-bold">
                ›
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-bold uppercase tracking-widest py-2"
                style={{ color: d === "Sun" || d === "Sat" ? "#9CA3AF" : "#6B7280" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading schedule...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[90px] rounded-xl" />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const dayItems = map[key] ?? [];
                const isToday = key === todayKey;
                const isSelected = key === selectedDay;
                const isWeekend = new Date(year, month, day).getDay() % 6 === 0;

                return (
                  <div key={key}
                    onClick={() => { setSelectedDay(key); setSelectedDispatch(null); }}
                    className="min-h-[90px] rounded-xl p-2 cursor-pointer transition-all"
                    style={{
                      background: isSelected ? "#EEF1FB" : isToday ? "#FFFBEB" : "white",
                      border: isSelected ? "2px solid #1B2A6B" : isToday ? "2px solid #F5A623" : "1px solid #E5E7EB",
                      boxShadow: dayItems.length > 0 ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                    }}>
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold"
                        style={{ color: isToday ? "#F5A623" : isWeekend ? "#9CA3AF" : "#374151" }}>
                        {day}
                      </span>
                      {dayItems.length > 0 && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "#1B2A6B", color: "white", fontSize: "0.6rem" }}>
                          {dayItems.length}
                        </span>
                      )}
                    </div>
                    {/* Dispatch chips (max 3 visible) */}
                    <div className="space-y-0.5">
                      {dayItems.slice(0, 3).map(d => {
                        const colors = STATUS_COLORS[d.status] ?? STATUS_COLORS.Pending;
                        return (
                          <div key={d.id}
                            onClick={e => { e.stopPropagation(); setSelectedDay(key); setSelectedDispatch(d); }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ background: d._type==='amats'?'rgba(13,148,136,0.15)':colors.badge, borderLeft: `3px solid ${d._type==='amats'?'#0D9488':'#1B2A6B'}` }}>

                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: colors.dot }} />
                            <span className="text-xs font-medium truncate"
                              style={{ color: colors.text, maxWidth: "100%" }}>
                              {d._type==='amats'?('🧪 '+(d.session_number??d.machine??'AMaTS')):(d.company_name??d.dispatch_number??'Dispatch')}
                            </span>
                          </div>
                        );
                      })}
                      {dayItems.length > 3 && (
                        <p className="text-xs text-gray-400 pl-1">+{dayItems.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {Object.entries(STATUS_COLORS).map(([status, colors]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: colors.dot }} />
                <span className="text-xs text-gray-500">{status}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: '#0D9488' }} />
              <span className="text-xs text-gray-500">🧪 AMaTS Session</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Detail panel ─────────────────────────────────────────────── */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col flex-shrink-0 lg:h-full h-1/2 lg:min-h-0"
          style={{ background: "white" }}>
          {selectedDispatch ? (
            // ── Dispatch detail ──────────────────────────────────────────────
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between"
                style={{ background: "#F8F9FB" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-gray-400">{selectedDispatch.dispatch_number ?? "—"}</p>
                  <h2 className="text-base font-black text-gray-900 mt-0.5 leading-tight">
                    {selectedDispatch.company_name ?? "Untitled Dispatch"}
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                    {(() => {
                      const colors = STATUS_COLORS[selectedDispatch.status] ?? STATUS_COLORS.Pending;
                      return (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{ background: colors.badge, color: colors.badgeText }}>
                          {selectedDispatch.status}
                        </span>
                      );
                    })()}
                    <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: selectedDispatch.created_by_role === "AMaTS" ? "#FBEEF0" : "#EEF1FB", color: selectedDispatch.created_by_role === "AMaTS" ? "#7B1F2F" : "#1B2A6B" }}>
                      {selectedDispatch.created_by_role === "AMaTS" ? "AMaTS" : "Scheduler"}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedDispatch(null)}
                  className="ml-2 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 text-lg transition-colors">
                  ×
                </button>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5">
                {/* Dates */}
                <Section title="Schedule">
                  <Row label="Date From" value={selectedDispatch.date_from ?? "—"} />
                  <Row label="Date To" value={selectedDispatch.date_to ?? "—"} />
                </Section>

                {/* Location */}
                <Section title="Location">
                  <Row label="Type" value={selectedDispatch.type === "in_house" ? "In-house (AMTEC)" : "On-field"} />
                  {selectedDispatch.testing_location && (
                    <Row label="Address" value={selectedDispatch.testing_location} />
                  )}
                  <Row label="Transport" value={TRANSPORT_LABELS[selectedDispatch.transport_mode ?? ""] ?? selectedDispatch.transport_mode ?? "—"} />
                </Section>

                {/* Personnel */}
                {(() => {
                  const engineers = selectedDispatch.dispatch_assignments.filter(a => ["engineer", "lead_engineer", "assistant_engineer"].includes(a.assignment_type));
                  const technicians = selectedDispatch.dispatch_assignments.filter(a => a.assignment_type === "technician");
                  return (
                    <Section title="Assigned Personnel">
                      {engineers.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Engineers</p>
                          {engineers.map(a => (
                            <div key={a.id} className="flex items-center gap-2 py-1">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: "#1B2A6B" }}>
                                {a.staff?.initials ?? a.staff?.full_name?.charAt(0) ?? "?"}
                              </div>
                              <span className="text-sm text-gray-700">{a.staff?.full_name ?? "Unknown"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {technicians.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Technicians</p>
                          {technicians.map(a => (
                            <div key={a.id} className="flex items-center gap-2 py-1">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: "#059669" }}>
                                {a.staff?.initials ?? a.staff?.full_name?.charAt(0) ?? "?"}
                              </div>
                              <span className="text-sm text-gray-700">{a.staff?.full_name ?? "Unknown"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {engineers.length === 0 && technicians.length === 0 && (
                        <p className="text-sm text-gray-400 italic">No personnel assigned.</p>
                      )}
                    </Section>
                  );
                })()}

                {/* Machines */}
                {selectedDispatch.dispatch_machines.length > 0 && (
                  <Section title={`Machines (${selectedDispatch.dispatch_machines.length})`}>
                    <div className="space-y-2">
                      {selectedDispatch.dispatch_machines.map((m, idx) => (
                        <div key={m.id} className="rounded-lg p-3" style={{ background: "#F8F9FB" }}>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Machine {idx + 1}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{m.machine ?? "—"}</p>
                          {m.brand && <p className="text-xs text-gray-500">{m.brand} {m.model}</p>}
                          {m.tam_no && <p className="text-xs text-gray-400 mt-0.5">TAM: {m.tam_no}</p>}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Notes */}
                {selectedDispatch.notes && (
                  <Section title="Notes">
                    <p className="text-sm text-gray-600 leading-relaxed">{selectedDispatch.notes}</p>
                  </Section>
                )}
              </div>

              {/* Back button */}
              <div className="px-5 py-3 border-t border-gray-100">
                <button onClick={() => setSelectedDispatch(null)}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200">
                  ← Back to day
                </button>
              </div>
            </div>
          ) : selectedAmatsSession ? (
            // ── AMaTS Session detail ─────────────────────────────────────────
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between"
                style={{ background: '#F0FDFA' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono" style={{ color: '#0D9488' }}>🧪 {selectedAmatsSession.session_number}</p>
                  <h2 className="text-base font-black text-gray-900 mt-0.5 leading-tight">
                    {selectedAmatsSession.machine_name_or_code ?? selectedAmatsSession.machine}
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                    {(() => {
                      const colors = STATUS_COLORS[selectedAmatsSession.status] ?? STATUS_COLORS.Scheduled;
                      return (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{ background: colors.badge, color: colors.badgeText }}>
                          {selectedAmatsSession.status}
                        </span>
                      );
                    })()}
                    <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(13,148,136,0.12)', color: '#0D9488' }}>
                      AMaTS Testing
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedAmatsSession(null)}
                  className="ml-2 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-teal-100 text-gray-400 text-lg transition-colors">×</button>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5">
                {/* Schedule */}
                <Section title="Schedule">
                  <Row label="Date From" value={selectedAmatsSession.date_from?.slice(0,16).replace('T',' ') ?? '—'} />
                  <Row label="Date To" value={selectedAmatsSession.date_to?.slice(0,16).replace('T',' ') ?? '—'} />
                </Section>

                {/* Machine */}
                <Section title="Machine">
                  <Row label="Type" value={selectedAmatsSession.machine} />
                  {selectedAmatsSession.machine_name_or_code && (
                    <Row label="Name / Code" value={selectedAmatsSession.machine_name_or_code} />
                  )}
                </Section>

                {/* Tests */}
                {selectedAmatsSession.amats_session_tests?.length > 0 && (
                  <Section title={`Tests (${selectedAmatsSession.amats_session_tests.length})`}>
                    <div className="space-y-1">
                      {selectedAmatsSession.amats_session_tests.map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0D9488' }} />
                          <span className="text-xs text-gray-700">{t.test_name}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Personnel */}
                {selectedAmatsSession.amats_session_assignments?.length > 0 && (() => {
                  const engineers = selectedAmatsSession.amats_session_assignments.filter(a => a.assignment_type === 'test_engineer');
                  const technicians = selectedAmatsSession.amats_session_assignments.filter(a => a.assignment_type === 'test_technician');
                  return (
                    <Section title="Assigned Personnel">
                      {engineers.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Test Engineers</p>
                          {engineers.map(a => (
                            <div key={a.id} className="flex items-center gap-2 py-1">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: '#0D9488' }}>
                                {a.staff?.initials ?? a.staff?.full_name?.charAt(0) ?? '?'}
                              </div>
                              <span className="text-sm text-gray-700">{a.staff?.full_name ?? 'Unknown'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {technicians.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Test Technicians</p>
                          {technicians.map(a => (
                            <div key={a.id} className="flex items-center gap-2 py-1">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: '#059669' }}>
                                {a.staff?.initials ?? a.staff?.full_name?.charAt(0) ?? '?'}
                              </div>
                              <span className="text-sm text-gray-700">{a.staff?.full_name ?? 'Unknown'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {engineers.length === 0 && technicians.length === 0 && (
                        <p className="text-sm text-gray-400 italic">No personnel assigned.</p>
                      )}
                    </Section>
                  );
                })()}
              </div>

              {/* Back button */}
              <div className="px-5 py-3 border-t border-gray-100">
                <button onClick={() => setSelectedAmatsSession(null)}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200">
                  ← Back to day
                </button>
              </div>
            </div>
          ) : selectedDay ? (
            // ── Day dispatches list ──────────────────────────────────────────
            <div className="flex flex-col h-full">
              <div className="px-5 py-4 border-b border-gray-100" style={{ background: "#F8F9FB" }}>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Schedule on</p>
                <h2 className="text-base font-black text-gray-900 mt-0.5">{selectedDay}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{dayDispatches.length} item{dayDispatches.length!==1?'s':''}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {dayDispatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                      style={{ background: "#F4F6FB" }}>
                      <span className="text-lg">📅</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-500">No dispatches this day</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayDispatches.map(d => {
                      const colors = STATUS_COLORS[d.status] ?? STATUS_COLORS.Pending;
                      const engineers = d._type==='amats' ? [] : (d.dispatch_assignments||[]).filter((a: {assignment_type:string}) => ["engineer", "lead_engineer", "assistant_engineer"].includes(a.assignment_type));
                      const technicians = d._type==='amats' ? [] : (d.dispatch_assignments||[]).filter((a: {assignment_type:string}) => a.assignment_type === "technician");
                      return (
                        <div key={d.id}
                          onClick={() => {
                            if (d._type === 'amats') {
                              setSelectedAmatsSession(d as AmatsSession);
                              setSelectedDispatch(null);
                            } else {
                              setSelectedDispatch(d as Dispatch);
                              setSelectedAmatsSession(null);
                            }
                          }}
                          className="rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all"
                          style={{ borderColor: colors.dot + "40", background: colors.bg }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-gray-400">{d.dispatch_number ?? "—"}</p>
                              <p className="text-sm font-bold text-gray-900 truncate mt-0.5">
                                {d._type==='amats'?('🧪 '+(d.machine_name_or_code??d.machine??'AMaTS Session')):(d.company_name??'Untitled')}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                              style={{ background: colors.badge, color: colors.badgeText }}>
                              {d.status}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                            {d._type!=='amats'&&<span>📍 {d.type === 'in_house' ? 'AMTEC' : (d.testing_location ?? d.location ?? '—')}</span>}
                            {d._type==='amats'&&<span>🧪 {(d.amats_session_tests||[]).slice(0,2).map((t: {test_name:string})=>t.test_name).join(', ')||'AMaTS Testing'}</span>}
                          </div>
                          {(engineers.length > 0 || technicians.length > 0) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(engineers as {id:string; staff?: {full_name?:string}}[]).map(a => (
                                <span key={a.id}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: "#EEF1FB", color: "#1B2A6B" }}>
                                  {a.staff?.full_name?.split(" ")[0] ?? "Eng"}
                                </span>
                              ))}
                              {(technicians as {id:string; staff?: {full_name?:string}}[]).map(a => (
                                <span key={a.id}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: "#ECFDF5", color: "#065F46" }}>
                                  {a.staff?.full_name?.split(" ")[0] ?? "Tech"}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-2 font-medium">{d._type==='amats'?'Tap to see AMaTS details →':'Tap to see details →'}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // ── Empty state ──────────────────────────────────────────────────
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "#EEF1FB" }}>
                <span className="text-2xl">📅</span>
              </div>
              <p className="text-base font-bold text-gray-700">Select a day</p>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                Click any date on the calendar to see the dispatches scheduled for that day.
              </p>
              <div className="mt-6 w-full">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">This month</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(STATUS_COLORS).map(([status, colors]) => {
                    const count = dispatches.filter(d => d.status === status).length;
                    if (count === 0) return null;
                    return (
                      <div key={status} className="rounded-lg p-2.5 text-center"
                        style={{ background: colors.badge }}>
                        <p className="text-lg font-black" style={{ color: colors.badgeText }}>{count}</p>
                        <p className="text-xs font-semibold" style={{ color: colors.text }}>{status}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-700 font-medium text-right">{value}</span>
    </div>
  );
}
