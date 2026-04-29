"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getThemeForRole } from "@/lib/theme";
import AppLayout from "../components/AppLayout";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────
type Assignment = {
  id: string;
  staff_id: string;
  assignment_type: string;
  staff: { full_name: string } | null;
};

type Machine = {
  id: string;
  tam_no: string | null;
  machine: string | null;
  brand: string | null;
  model: string | null;
};

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
  status: string;
  testing_location: string | null;
  contact_person: string | null;
  contact_number: string | null;
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

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

const TRANSPORT_LABELS: Record<string, string> = {
  public_conveyance: "Public Conveyance",
  test_applicant_vehicle: "Applicant Vehicle",
  college_vehicle: "College Vehicle",
  other: "Other",
};

// ─── Status styles ───────────────────────────────────────────────────────────
type DispatchStatus = "Pending" | "Scheduled" | "Re-scheduled" | "Ongoing" | "Cancelled" | "Done" | "Unknown";

const STATUS_STYLES: Record<DispatchStatus, { bg: string; color: string; dot: string }> = {
  Pending:        { bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B" },
  Scheduled:      { bg: "#EEF1FB", color: "#1B2A6B", dot: "#1B2A6B" },
  "Re-scheduled": { bg: "#FDE68A", color: "#78350F", dot: "#F59E0B" },
  Ongoing:        { bg: "#DBEAFE", color: "#1E40AF", dot: "#3B82F6" },
  Cancelled:      { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  Done:           { bg: "#D1FAE5", color: "#065F46", dot: "#10B981" },
  Unknown:        { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF" },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[(status || "Unknown") as DispatchStatus] ?? STATUS_STYLES.Unknown;
}

function parseLocalDate(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

// ─── Legend items ────────────────────────────────────────────────────────────
const LEGEND = [
  { label: "Pending", ...STATUS_STYLES.Pending },
  { label: "Scheduled", ...STATUS_STYLES.Scheduled },
  { label: "Re-scheduled", ...STATUS_STYLES["Re-scheduled"] },
  { label: "Ongoing", ...STATUS_STYLES.Ongoing },
  { label: "Cancelled", ...STATUS_STYLES.Cancelled },
  { label: "Done", ...STATUS_STYLES.Done },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [noAssignments, setNoAssignments] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login"); return; }
      setEmail(data.user.email ?? "");

      const meRes = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      });
      const meData = await meRes.json();
      setRole(meData.profile?.role ?? "");
      setFullName(meData.profile?.full_name ?? "");

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        const [res, amatsRes] = await Promise.all([
          fetch("/api/dispatches", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/public/amats-sessions"),
        ]);
        const json = await res.json();
        const amatsJson = await amatsRes.json();
        setDispatches(json.dispatches ?? []);
        setAmatsSessions(amatsJson.sessions ?? []);
        if (json.noAssignments) setNoAssignments(true);
      }
      setLoading(false);
    }
    load();
  }, [router, supabase]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatchMap = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, any[]> = {};
    if (filterSource !== 'amats') {
      for (const d of dispatches) {
        if (!d.date_from || !d.date_to) continue;
        const from = parseLocalDate(d.date_from);
        const to = parseLocalDate(d.date_to);
        const cur = new Date(from);
        while (cur <= to) {
          const key = toKey(cur);
          if (!map[key]) map[key] = [];
          map[key].push({ ...d, _type: 'dispatch' });
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
    if (filterSource !== 'dispatch') {
      for (const s of amatsSessions) {
        if (!s.date_from || !s.date_to) continue;
        const from = parseLocalDate(s.date_from.slice(0,10));
        const to = parseLocalDate(s.date_to.slice(0,10));
        const cur = new Date(from);
        while (cur <= to) {
          const key = toKey(cur);
          if (!map[key]) map[key] = [];
          map[key].push({ ...s, _type: 'amats' });
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
    return map;
  }, [dispatches, amatsSessions, filterSource]);

  // Filter dispatches for the current month (for the table)
  const monthDispatches = useMemo(() => {
    const y = current.getFullYear();
    const m = current.getMonth();
    return dispatches.filter(d => {
      if (!d.date_from && !d.date_to) return false;
      const from = d.date_from ? parseLocalDate(d.date_from) : null;
      const to = d.date_to ? parseLocalDate(d.date_to) : null;
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0);
      if (from && to) return from <= monthEnd && to >= monthStart;
      if (from) return from.getMonth() === m && from.getFullYear() === y;
      return false;
    });
  }, [dispatches, current]);

  function getMonthDays() {
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }

  const todayKey = toKey(new Date());
  const selectedDispatches = selectedDate ? (dispatchMap[selectedDate] ?? []) : [];
  const isScheduler = role === "admin_scheduler" || role === "AMaTS";
  const theme = getThemeForRole(role);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F6FB" }}>
      <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: "#F5A623" }} />
    </div>
  );

  return (
    <AppLayout>
      <div className="p-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.accent }}>
              Dashboard
            </p>
            <h1 className="text-2xl font-black text-gray-900">
              Welcome back, {fullName || (email ? email.split("@")[0] : "")}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">Role: {role || "—"}</p>
          </div>
          {isScheduler && (
            <Link href="/dispatch/new"
              className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 self-start sm:self-auto"
              style={{ background: theme.primary, color: "white" }}>
              + New Dispatch
            </Link>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Dispatches", value: dispatches.length, color: theme.primary },
            { label: "Scheduled", value: dispatches.filter(d => d.status === "Scheduled").length, color: theme.primary },
            { label: "Ongoing", value: dispatches.filter(d => d.status === "Ongoing").length, color: "#1E40AF" },
            { label: "Done", value: dispatches.filter(d => d.status === "Done").length, color: "#065F46" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {noAssignments && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm font-medium"
            style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #F5A623" }}>
            ⚠ No dispatches have been assigned to you yet. Please contact your scheduler.
          </div>
        )}

        {/* ──────────────────── CALENDAR (calendar-view style) ──────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6 mb-6">
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
            {/* Calendar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-900">
                {MONTHS[current.getMonth()]} {current.getFullYear()}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { const d = new Date(current); d.setMonth(d.getMonth()-1); setCurrent(d); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold transition-all">‹</button>
                <button onClick={() => setCurrent(new Date())}
                  className="h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 transition-all">Today</button>
                <button onClick={() => { const d = new Date(current); d.setMonth(d.getMonth()+1); setCurrent(d); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold transition-all">›</button>
              </div>
            </div>
            {/* Source filter */}
            <div className="flex items-center gap-1.5 px-5 pb-3">
              {([['all','All'],['dispatch','Dispatches'],['amats','AMaTS']] as const).map(([v,l]) => (
                <button key={v} onClick={()=>setFilterSource(v)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={{ background: filterSource===v?theme.primary:'white', color: filterSource===v?'white':'#6B7280', borderColor: filterSource===v?theme.primary:'#E5E7EB' }}>
                  {v==='amats'?'🧪 ':v==='dispatch'?'📍 ':''}{l}
                </button>
              ))}
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS.map(d => (
                <div key={d} className="py-2.5 text-center text-xs font-bold uppercase tracking-widest text-gray-400">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {getMonthDays().map((date, idx) => {
                if (!date) return (
                  <div key={`e-${idx}`} className="min-h-[100px] border-b border-r border-gray-50 bg-gray-50/50" />
                );
                const key = toKey(date);
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const chips = dispatchMap[key] ?? [];
                const chipCount = chips.length;
                return (
                  <div key={key} onClick={() => setSelectedDate(isSelected ? null : key)}
                    className="min-h-[100px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-all relative group"
                    style={{
                      background: isSelected ? "#FEF9EC" : isToday ? "#FFFDF5" : isWeekend ? "#F9FAFB" : "white",
                      boxShadow: isSelected ? `inset 0 0 0 2px ${theme.accent}` : "none",
                    }}>
                    {/* Day number + dispatch count badge */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? "text-white" : isWeekend ? "text-gray-400" : "text-gray-600"}`}
                        style={isToday ? { background: theme.primary } : {}}>
                        {date.getDate()}
                      </span>
                      {chipCount > 0 && (
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ background: theme.primary, fontSize: "0.6rem" }}>
                          {chipCount}
                        </span>
                      )}
                    </div>
                    {/* Dispatch chips */}
                    {chips.slice(0, 3).map(d => {
                      const st = getStatusStyle(d.status);
                      return (
                        <div key={d.id}
                          onClick={e => { e.stopPropagation(); router.push(d._type==='amats'?`/amats/${d.id}`:`/dispatches/${d.id}`); }}
                          className="flex items-center gap-1 text-xs rounded-md px-1.5 py-0.5 truncate mb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ background: d._type==='amats'?'rgba(13,148,136,0.15)':st.bg, color: d._type==='amats'?'#0D9488':st.color, borderLeft: `3px solid ${d._type==='amats'?'#0D9488':'#1B2A6B'}` }}
                          title={d._type==='amats'?(d.session_number??'AMaTS'):(d.dispatch_number??d.company_name??'Dispatch')}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: d._type==='amats'?'#0D9488':st.dot }} />
                          <span className="truncate font-medium">
                            {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):('📍 '+(d.company_name??d.dispatch_number??'Dispatch'))}
                          </span>
                        </div>
                      );
                    })}
                    {chipCount > 3 && (
                      <div className="text-xs pl-1 font-semibold" style={{ color: theme.accent }}>+{chipCount - 3} more</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100" style={{ background: "#FAFBFC" }}>
              {LEGEND.map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.dot }} />
                  <span className="text-xs text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Side panel */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
              <div className="px-4 py-3 border-b border-gray-100" style={{ background: "#F8F9FB" }}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  {selectedDate ? (() => {
                    const [y,m,d] = selectedDate.split("-").map(Number);
                    return new Date(y,m-1,d).toLocaleDateString("en-PH", { weekday:"long", month:"long", day:"numeric" });
                  })() : "Select a day"}
                </h2>
              </div>
              <div className="p-4">
                {!selectedDate ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: theme.primaryLight }}>
                      <span className="text-xl">📅</span>
                    </div>
                    <p className="text-sm font-bold text-gray-600">Select a day</p>
                    <p className="text-xs text-gray-400 mt-1">Click any date on the calendar to see the dispatches scheduled for that day.</p>
                  </div>
                ) : selectedDispatches.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-8">No dispatches on this date.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDispatches.map(d => {
                      const st = getStatusStyle(d.status);
                      return (
                        <div key={d.id} onClick={() => router.push(d._type==='amats'?`/amats/${d.id}`:`/dispatches/${d.id}`)}
                          className="p-3 rounded-lg border border-gray-100 hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer transition-all">
                          <p className="text-xs font-mono font-bold" style={{ color: d._type==='amats'?'#0D9488':theme.primary }}>
                            {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):('📍 '+(d.dispatch_number??'No Number'))}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5 font-medium">{d._type==='amats'?(d.machine_name_or_code??d.machine):(d.company_name??'—')}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: st.bg, color: st.color }}>
                              {d.status}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: d.created_by_role === "AMaTS" ? "#FBEEF0" : "#EEF1FB", color: d.created_by_role === "AMaTS" ? "#7B1F2F" : "#1B2A6B" }}>
                              {d.created_by_role === "AMaTS" ? "AMaTS" : "S"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{d.date_from} → {d.date_to}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* This month summary */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">This Month</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Dispatches", value: monthDispatches.length, color: theme.primary },
                      { label: "Done", value: monthDispatches.filter(d => d.status === "Done").length, color: "#10B981" },
                    ].map(s => (
                      <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: "#F8F9FB" }}>
                        <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ──────────────────── DISPATCH LIST (workload-view style) ──────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-auto shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100" style={{ background: "#F8F9FB" }}>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-800">
                📋 Dispatch List — {MONTHS[current.getMonth()]} {current.getFullYear()}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{monthDispatches.length} dispatches</p>
            </div>
            <Link href="/dispatches" className="text-xs font-semibold hover:underline" style={{ color: theme.accent }}>
              View All →
            </Link>
          </div>

          {monthDispatches.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-400">
                {noAssignments ? "You have no dispatches assigned to you yet." : "No dispatches this month."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ fontSize: "0.75rem" }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: "#F8F9FB" }}>
                    {["Dispatch #", "Status", "Departure", "Arrival", "Lead Engr.", "Asst. Engr.", "Technician",
                      "Applicant/s", "Location", "Machinery", "TAM", "Transport", "Contact Person", "Contact No."].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthDispatches.map((d, idx) => {
                    const lead = d.dispatch_assignments?.find(a => a.assignment_type === "lead_engineer");
                    const assistants = d.dispatch_assignments?.filter(a => a.assignment_type === "assistant_engineer") ?? [];
                    const techs = d.dispatch_assignments?.filter(a => a.assignment_type === "technician") ?? [];
                    const st = getStatusStyle(d.status);

                    return (
                      <tr key={d.id} style={{ background: idx % 2 === 0 ? "white" : "#FAFAFA" }}
                        onClick={() => router.push(`/dispatches/${d.id}`)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer">
                        <td className="px-3 py-2 border-b border-gray-100 font-mono font-semibold text-gray-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" title={d.created_by_role === "AMaTS" ? "Created by AMaTS" : "Created by Scheduler"}
                              style={{ background: d.created_by_role === "AMaTS" ? "#7B1F2F" : "#1B2A6B" }} />
                            {d.dispatch_number ?? "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
                            style={{ background: st.bg, color: st.color }}>
                            {d.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600 whitespace-nowrap">{d.date_from ?? "—"}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600 whitespace-nowrap">{d.date_to ?? "—"}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-700 font-medium whitespace-nowrap">
                          {lead?.staff?.full_name ?? "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600">
                          {assistants.length > 0 ? assistants.map(a => a.staff?.full_name).join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600">
                          {techs.length > 0 ? techs.map(a => a.staff?.full_name).join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-700 font-medium">{d.company_name ?? "—"}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600">
                          {d.type === "in_house" ? "AMTEC" : (d.testing_location ?? d.location ?? "—")}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600">
                          {d.dispatch_machines?.length > 0
                            ? d.dispatch_machines.map(m => m.machine).filter(Boolean).join(", ") || "—"
                            : "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600 font-mono">
                          {d.dispatch_machines?.length > 0
                            ? d.dispatch_machines.map(m => m.tam_no).filter(Boolean).join(", ") || "—"
                            : "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600 whitespace-nowrap">
                          {TRANSPORT_LABELS[d.transport_mode ?? ""] ?? d.transport_mode ?? "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{d.contact_person ?? "—"}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-600 font-mono">{d.contact_number ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
