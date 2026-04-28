const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// Patch calendar/page.tsx  (internal scheduler calendar)
// ─────────────────────────────────────────────────────────────────────────────
let c = fs.readFileSync('app/calendar/page.tsx', 'utf8');

// Add AmatsSession type after the Dispatch type
const amatsType = `
type AmatsSession = {
  id: string;
  session_number: string;
  machine: string;
  machine_name_or_code: string | null;
  date_from: string;
  date_to: string;
  status: string;
  amats_session_tests: { id: string; test_name: string }[];
  amats_session_assignments: {
    id: string;
    assignment_type: string;
    staff: { id: string; full_name: string; initials: string } | null;
  }[];
};

type CalendarItem = (Dispatch & { _type: 'dispatch' }) | (AmatsSession & { _type: 'amats' });

`;
c = c.replace(`const DAYS =`, amatsType + `const DAYS =`);

// Add state
c = c.replace(
  `  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);`,
  `  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');`
);

// Add parallel fetch for amats sessions right after the dispatches fetch
c = c.replace(
  `      const res = await fetch("/api/dispatches", {
        headers: { Authorization: \`Bearer \${token}\` },
      });
      const json = await res.json();
      setDispatches(json.dispatches ?? []);
      if (json.noAssignments) setNoAssignments(true);
      setLoading(false);`,
  `      const [res, amatsRes] = await Promise.all([
        fetch("/api/dispatches", { headers: { Authorization: \`Bearer \${token}\` } }),
        fetch("/api/public/amats-sessions"),
      ]);
      const json = await res.json();
      const amatsJson = await amatsRes.json();
      setDispatches(json.dispatches ?? []);
      setAmatsSessions(amatsJson.sessions ?? []);
      if (json.noAssignments) setNoAssignments(true);
      setLoading(false);`
);

// Replace dispatchMap with unified map
c = c.replace(
  `  const dispatchMap = useMemo(() => {
    const map: Record<string, Dispatch[]> = {};
    for (const d of dispatches) {
      if (!d.date_from || !d.date_to) continue;
      const from = parseLocalDate(d.date_from);
      const to = parseLocalDate(d.date_to);
      const cur = new Date(from);
      while (cur <= to) {
        const key = toKey(cur);
        if (!map[key]) map[key] = [];
        map[key].push(d);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [dispatches]);`,
  `  const dispatchMap = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    if (filterSource !== 'amats') {
      for (const d of dispatches) {
        if (!d.date_from || !d.date_to) continue;
        const from = parseLocalDate(d.date_from);
        const to = parseLocalDate(d.date_to);
        const cur = new Date(from);
        while (cur <= to) {
          const key = toKey(cur);
          if (!map[key]) map[key] = [];
          map[key].push({ ...d, _type: 'dispatch' as const });
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
          map[key].push({ ...s, _type: 'amats' as const });
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
    return map;
  }, [dispatches, amatsSessions, filterSource]);`
);

// Update selectedDispatches type
c = c.replace(
  `  const selectedDispatches = selectedDate ? (dispatchMap[selectedDate] ?? []) : [];`,
  `  const selectedItems: CalendarItem[] = selectedDate ? (dispatchMap[selectedDate] ?? []) : [];
  const selectedDispatches = selectedItems;`
);

// Update dispatches loaded subtitle
c = c.replace(
  `<p className="text-sm text-gray-500 mt-0.5">{dispatches.length} dispatches loaded</p>`,
  `<p className="text-sm text-gray-500 mt-0.5">{dispatches.length} dispatches · {amatsSessions.length} AMaTS sessions</p>`
);

// Add source filter pills in the calendar toolbar, after the view buttons div
c = c.replace(
  `              <div className="flex rounded-lg overflow-hidden border border-gray-200 self-start sm:self-auto">`,
  `              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                {([['all','All'],['dispatch','Dispatches'],['amats','AMaTS']] as const).map(([v,l]) => (
                  <button key={v} onClick={()=>setFilterSource(v)}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: filterSource===v ? '#1B2A6B' : 'transparent',
                      color: filterSource===v ? 'white' : '#6B7280',
                    }}>
                    {v==='amats' ? '🧪 ' : ''}{l}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 self-start sm:self-auto">`
);

// Update month chip style + label
c = c.replace(
  `                          style={{ background: "rgba(27,42,107,0.1)", color: "#1B2A6B" }}
                          title={d.dispatch_number ?? d.company_name ?? "Dispatch"}>
                          {d.dispatch_number ?? d.company_name ?? "Dispatch"}`,
  `                          style={{ background: (d as CalendarItem)._type==='amats' ? 'rgba(13,148,136,0.15)' : 'rgba(27,42,107,0.1)', color: (d as CalendarItem)._type==='amats' ? '#0D9488' : '#1B2A6B' }}
                          title={(d as CalendarItem)._type==='amats' ? ('AMaTS: '+((d as AmatsSession).session_number ?? '')) : (d.dispatch_number ?? d.company_name ?? 'Dispatch')}>
                          {(d as CalendarItem)._type==='amats' ? ('🧪 '+((d as AmatsSession).session_number ?? 'AMaTS')) : (d.dispatch_number ?? d.company_name ?? 'Dispatch')}`
);

// Update week view chip style + label
c = c.replace(
  `                            style={{ background: "rgba(27,42,107,0.1)", color: "#1B2A6B" }}
                            title={d.dispatch_number ?? d.company_name ?? "Dispatch"}>
                            {d.dispatch_number ?? d.company_name ?? "Dispatch"}`,
  `                            style={{ background: (d as CalendarItem)._type==='amats' ? 'rgba(13,148,136,0.15)' : 'rgba(27,42,107,0.1)', color: (d as CalendarItem)._type==='amats' ? '#0D9488' : '#1B2A6B' }}
                            title={(d as CalendarItem)._type==='amats' ? ('AMaTS: '+((d as AmatsSession).session_number ?? '')) : (d.dispatch_number ?? d.company_name ?? 'Dispatch')}>
                            {(d as CalendarItem)._type==='amats' ? ('🧪 '+((d as AmatsSession).session_number ?? 'AMaTS')) : (d.dispatch_number ?? d.company_name ?? 'Dispatch')}`
);

// Update side panel dispatch click / label
c = c.replace(
  `                        onClick={() => router.push(\`/dispatches/\${d.id}\`)}`,
  `                        onClick={() => router.push((d as CalendarItem)._type==='amats' ? \`/amats/\${d.id}\` : \`/dispatches/\${d.id}\`)}`
);
c = c.replace(
  `                        <p className="text-xs font-bold" style={{ color: "#1B2A6B" }}>
                          {d.dispatch_number ?? "No Number"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{d.company_name ?? "—"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{d.date_from} → {d.date_to}</p>`,
  `                        <p className="text-xs font-bold" style={{ color: (d as CalendarItem)._type==='amats' ? '#0D9488' : '#1B2A6B' }}>
                          {(d as CalendarItem)._type==='amats' ? ('🧪 '+((d as AmatsSession).session_number ?? 'AMaTS')) : (d.dispatch_number ?? 'No Number')}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{(d as CalendarItem)._type==='amats' ? ((d as AmatsSession).machine_name_or_code ?? (d as AmatsSession).machine) : (d.company_name ?? '—')}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{d.date_from} → {d.date_to}</p>`
);

// Update side panel header
c = c.replace(
  `                  <p className="text-xs text-gray-400 italic">Click a date to see dispatches.</p>`,
  `                  <p className="text-xs text-gray-400 italic">Click a date to see events.</p>`
);
c = c.replace(
  `                  <p className="text-xs text-gray-400 italic">No dispatches on this date.</p>`,
  `                  <p className="text-xs text-gray-400 italic">No events on this date.</p>`
);

fs.writeFileSync('app/calendar/page.tsx', c, 'utf8');
console.log('calendar/page.tsx patched. Length:', c.length);

// ─────────────────────────────────────────────────────────────────────────────
// Patch dashboard/page.tsx  (dashboard calendar)
// ─────────────────────────────────────────────────────────────────────────────
let d = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

// Add AmatsSession type after Machine type
d = d.replace(
  `const DAYS = ["SUN"`,
  amatsType + `const DAYS = ["SUN"`
);

// Add state
d = d.replace(
  `  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);`,
  `  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');
  const [loading, setLoading] = useState(true);`
);

// Add parallel amats fetch
d = d.replace(
  `        const res = await fetch("/api/dispatches", {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        const json = await res.json();
        setDispatches(json.dispatches ?? []);
        if (json.noAssignments) setNoAssignments(true);`,
  `        const [res, amatsRes] = await Promise.all([
          fetch("/api/dispatches", { headers: { Authorization: \`Bearer \${token}\` } }),
          fetch("/api/public/amats-sessions"),
        ]);
        const json = await res.json();
        const amatsJson = await amatsRes.json();
        setDispatches(json.dispatches ?? []);
        setAmatsSessions(amatsJson.sessions ?? []);
        if (json.noAssignments) setNoAssignments(true);`
);

// Replace dispatchMap
d = d.replace(
  `  const dispatchMap = useMemo(() => {
    const map: Record<string, Dispatch[]> = {};
    for (const d of dispatches) {
      if (!d.date_from || !d.date_to) continue;
      const from = parseLocalDate(d.date_from);
      const to = parseLocalDate(d.date_to);
      const cur = new Date(from);
      while (cur <= to) {
        const key = toKey(cur);
        if (!map[key]) map[key] = [];
        map[key].push(d);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [dispatches]);`,
  `  const dispatchMap = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    if (filterSource !== 'amats') {
      for (const d of dispatches) {
        if (!d.date_from || !d.date_to) continue;
        const from = parseLocalDate(d.date_from);
        const to = parseLocalDate(d.date_to);
        const cur = new Date(from);
        while (cur <= to) {
          const key = toKey(cur);
          if (!map[key]) map[key] = [];
          map[key].push({ ...d, _type: 'dispatch' as const });
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
          map[key].push({ ...s, _type: 'amats' as const });
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
    return map;
  }, [dispatches, amatsSessions, filterSource]);`
);

// Fix selectedDispatches
d = d.replace(
  `  const selectedDispatches = selectedDate ? (dispatchMap[selectedDate] ?? []) : [];`,
  `  const selectedItems: CalendarItem[] = selectedDate ? (dispatchMap[selectedDate] ?? []) : [];
  const selectedDispatches = selectedItems;`
);

// Add source filter to calendar toolbar (after the Today button)
d = d.replace(
  `              <button onClick={() => setCurrent(new Date())}
                  className="h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 transition-all">Today</button>
                <button onClick={() => { const d = new Date(current); d.setMonth(d.getMonth()+1); setCurrent(d); }}`,
  `              <button onClick={() => setCurrent(new Date())}
                  className="h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 transition-all">Today</button>
                <button onClick={() => { const d = new Date(current); d.setMonth(d.getMonth()+1); setCurrent(d); }}`
);

// Add source filter after the navigation row — find the closing of the calendar header
d = d.replace(
  `            </div>

            {/* Day headers */}`,
  `            </div>
            {/* Source filter */}
            <div className="flex items-center gap-1 px-5 pb-3">
              {([['all','All'],['dispatch','Dispatches'],['amats','AMaTS']] as const).map(([v,l]) => (
                <button key={v} onClick={()=>setFilterSource(v)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    background: filterSource===v ? theme.primary : 'white',
                    color: filterSource===v ? 'white' : '#6B7280',
                    borderColor: filterSource===v ? theme.primary : '#E5E7EB',
                  }}>
                  {v==='amats' ? '🧪 ' : ''}{l}
                </button>
              ))}
            </div>

            {/* Day headers */}`
);

// Update chip in dashboard calendar grid
d = d.replace(
  `onClick={e => { e.stopPropagation(); router.push(\`/dispatches/\${d.id}\`); }}`,
  `onClick={e => { e.stopPropagation(); router.push((d as CalendarItem)._type==='amats' ? \`/amats/\${d.id}\` : \`/dispatches/\${d.id}\`); }}`
);

// Update chip style in dashboard
d = d.replace(
  `                            style={{ background: "rgba(27,42,107,0.1)", color: "#1B2A6B" }}`,
  `                            style={{ background: (d as CalendarItem)._type==='amats' ? 'rgba(13,148,136,0.15)' : 'rgba(27,42,107,0.1)', color: (d as CalendarItem)._type==='amats' ? '#0D9488' : '#1B2A6B' }}`
);

// Update chip label in dashboard calendar grid
d = d.replace(
  `                            title={d.dispatch_number ?? d.company_name ?? "Dispatch"}>
                            {d.dispatch_number ?? d.company_name ?? "Dispatch"}`,
  `                            title={(d as CalendarItem)._type==='amats' ? ((d as AmatsSession).session_number ?? 'AMaTS') : (d.dispatch_number ?? d.company_name ?? 'Dispatch')}>
                            {(d as CalendarItem)._type==='amats' ? ('🧪 '+((d as AmatsSession).session_number ?? 'AMaTS')) : (d.dispatch_number ?? d.company_name ?? 'Dispatch')}`
);

fs.writeFileSync('app/dashboard/page.tsx', d, 'utf8');
console.log('dashboard/page.tsx patched. Length:', d.length);
