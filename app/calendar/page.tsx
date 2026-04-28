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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

function parseLocalDate(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');
  const [view, setView] = useState<"month" | "week">("month");
  const [current, setCurrent] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [noAssignments, setNoAssignments] = useState(false);
  const [role, setRole] = useState("");

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
      const token = session.session?.access_token;
      if (!token) { router.push("/login"); return; }

      const [res, amatsRes] = await Promise.all([
        fetch("/api/dispatches", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/public/amats-sessions"),
      ]);
      const json = await res.json();
      const amatsJson = await amatsRes.json();
      setDispatches(json.dispatches ?? []);
      setAmatsSessions(amatsJson.sessions ?? []);
      if (json.noAssignments) setNoAssignments(true);
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

  function getWeekDays() {
    const day = current.getDay();
    const start = new Date(current);
    start.setDate(current.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  function navigate(dir: -1 | 1) {
    const d = new Date(current);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCurrent(d);
  }

  const todayKey = toKey(new Date());
  const selectedDispatches = selectedDate ? (dispatchMap[selectedDate] ?? []) : [];
  const days = view === "month" ? getMonthDays() : getWeekDays();
  const headerLabel = view === "month"
    ? `${MONTHS[current.getMonth()]} ${current.getFullYear()}`
    : (() => {
        const week = getWeekDays();
        return `${MONTHS[week[0].getMonth()]} ${week[0].getDate()} – ${MONTHS[week[6].getMonth()]} ${week[6].getDate()}, ${week[6].getFullYear()}`;
      })();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F6FB" }}>
      <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: "#F5A623" }} />
    </div>
  );

  return (
    <AppLayout>
      <div className="p-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#F5A623" }}>
              Schedule
            </p>
            <h1 className="text-2xl font-black text-gray-900">Calendar</h1>
            <p className="text-sm text-gray-500 mt-0.5">{dispatches.length} dispatches · {amatsSessions.length} AMaTS sessions</p>
          </div>
          {(role === "admin_scheduler" || role === "AMaTS") && (
            <Link href="/dispatch/new"
              className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 self-start sm:self-auto"
              style={{ background: "#1B2A6B", color: "white" }}>
              + New Dispatch
            </Link>
          )}
        </div>

        {/* No assignments banner */}
        {noAssignments && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm font-medium"
            style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #F5A623" }}>
            ⚠ No dispatches have been assigned to you yet. Please contact your scheduler.
          </div>
        )}

        {/* Calendar + Side panel */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Calendar */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">

            {/* Calendar toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(-1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 text-sm">‹</button>
                <button onClick={() => setCurrent(new Date())}
                  className="px-3 py-1 rounded-lg text-xs font-semibold hover:bg-gray-100 text-gray-600">Today</button>
                <button onClick={() => navigate(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 text-sm">›</button>
                <span className="text-sm font-bold text-gray-800 ml-1 whitespace-nowrap">{headerLabel}</span>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                {([['all','All'],['dispatch','Dispatches'],['amats','AMaTS']] as const).map(([v,l]) => (
                  <button key={v} onClick={()=>setFilterSource(v)}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{ background: filterSource===v?'#1B2A6B':'transparent', color: filterSource===v?'white':'#6B7280' }}>
                    {v==='amats'?'🧪 ':''}{l}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 self-start sm:self-auto">
                <button onClick={() => setView("month")}
                  className="px-4 py-1.5 text-xs font-semibold transition-all"
                  style={view === "month" ? { background: "#1B2A6B", color: "white" } : { background: "white", color: "#6B7280" }}>
                  Month
                </button>
                <button onClick={() => setView("week")}
                  className="px-4 py-1.5 text-xs font-semibold transition-all"
                  style={view === "week" ? { background: "#1B2A6B", color: "white" } : { background: "white", color: "#6B7280" }}>
                  Week
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
              ))}
            </div>

            {/* Month view */}
            {view === "month" && (
              <div className="grid grid-cols-7">
                {(days as (Date | null)[]).map((date, idx) => {
                  if (!date) return (
                    <div key={`e-${idx}`} className="min-h-[110px] border-b border-r border-gray-50 bg-gray-50/50" />
                  );
                  const key = toKey(date);
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDate;
                  const chips = dispatchMap[key] ?? [];
                  return (
                    <div key={key}
                      onClick={() => setSelectedDate(isSelected ? null : key)}
                      className={`min-h-[110px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors
                        ${isSelected ? "bg-amber-50 ring-2 ring-inset ring-amber-400" : "hover:bg-gray-50"}`}>
                      <div className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1"
                        style={isToday ? { background: "#1B2A6B", color: "white" } : { color: "#374151" }}>
                        {date.getDate()}
                      </div>
                      {chips.slice(0, 2).map(d => (
                        <div key={d.id}
                          onClick={e => { e.stopPropagation(); router.push(d._type==='amats'?`/amats/${d.id}`:`/dispatches/${d.id}`); }}
                          className="text-xs rounded px-1.5 py-0.5 truncate mb-0.5 cursor-pointer hover:opacity-80"
                          style={{ background: d._type==='amats'?'rgba(13,148,136,0.15)':'rgba(27,42,107,0.1)', color: d._type==='amats'?'#0D9488':'#1B2A6B' }}
                          title={d._type==='amats'?(d.session_number??'AMaTS'):(d.dispatch_number??d.company_name??'Dispatch')}>
                          {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):(d.dispatch_number??d.company_name??'Dispatch')}
                        </div>
                      ))}
                      {chips.length > 2 && (
                        <div className="text-xs pl-1" style={{ color: "#F5A623" }}>+{chips.length - 2} more</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Week view */}
            {view === "week" && (
              <div className="grid grid-cols-7 divide-x divide-gray-100">
                {(days as Date[]).map(date => {
                  const key = toKey(date);
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDate;
                  const chips = dispatchMap[key] ?? [];
                  return (
                    <div key={key}
                      onClick={() => setSelectedDate(isSelected ? null : key)}
                      className={`min-h-[400px] p-2 cursor-pointer transition-colors
                        ${isSelected ? "bg-amber-50 ring-2 ring-inset ring-amber-400" : "hover:bg-gray-50"}`}>
                      <div className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-2"
                        style={isToday ? { background: "#1B2A6B", color: "white" } : { color: "#374151" }}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {chips.map(d => (
                          <div key={d.id}
                            onClick={e => { e.stopPropagation(); router.push(`/dispatches/${d.id}`); }}
                            className="text-xs rounded px-1.5 py-1 truncate cursor-pointer hover:opacity-80"
                            style={{ background: d._type==='amats'?'rgba(13,148,136,0.15)':'rgba(27,42,107,0.1)', color: d._type==='amats'?'#0D9488':'#1B2A6B' }}
                            title={d._type==='amats'?(d.session_number??'AMaTS'):(d.dispatch_number??d.company_name??'Dispatch')}>
                            {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):(d.dispatch_number??d.company_name??'Dispatch')}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
              <div className="px-4 py-3 border-b border-gray-100" style={{ background: "#F8F9FB" }}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  {selectedDate ? (() => {
                    const [y,m,d] = selectedDate.split("-").map(Number);
                    return new Date(y,m-1,d).toLocaleDateString("en-PH", {
                      weekday: "short", month: "long", day: "numeric"
                    });
                  })() : "Select a date"}
                </h2>
              </div>
              <div className="p-4">
                {!selectedDate ? (
                  <p className="text-xs text-gray-400 italic">Click a date to see events.</p>
                ) : selectedDispatches.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No events on this date.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDispatches.map(d => (
                      <div key={d.id}
                        onClick={() => router.push(d._type==='amats'?`/amats/${d.id}`:`/dispatches/${d.id}`)}
                        className="p-3 rounded-lg border border-gray-100 hover:border-amber-300 hover:bg-amber-50 cursor-pointer transition-colors">
                        <p className="text-xs font-bold" style={{ color: d._type==='amats'?'#0D9488':'#1B2A6B' }}>
                          {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):(d.dispatch_number??'No Number')}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{d._type==='amats'?(d.machine_name_or_code??d.machine):(d.company_name??'—')}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{d.date_from} → {d.date_to}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}