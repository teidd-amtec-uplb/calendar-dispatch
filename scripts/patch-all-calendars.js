// scripts/patch-all-calendars.js  (CRLF-safe version)
const fs = require('fs');

function applyPatches(filepath, patches) {
  // Read and normalize to LF for searching/replacing, then restore CRLF
  const raw = fs.readFileSync(filepath, 'utf8');
  let src = raw.replace(/\r\n/g, '\n');
  let misses = 0;
  for (const [from, to] of patches) {
    const normFrom = from.replace(/\r\n/g, '\n');
    if (!src.includes(normFrom)) {
      console.warn(`  MISS [${filepath}]: ...${normFrom.slice(0,70)}...`);
      misses++;
    } else {
      src = src.replace(normFrom, to);
    }
  }
  // Write back with LF (Next.js is fine with this)
  fs.writeFileSync(filepath, src, 'utf8');
  console.log(`Patched ${filepath} (${misses} misses)`);
}

const AMATS_TYPE = `
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

`;

const UNIFIED_DISPATCHMAP_CALLBACK = `  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  }, [dispatches, amatsSessions, filterStatus, filterSource]);`;

const UNIFIED_DISPATCHMAP_MEMO = (extra = '') => `  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  }, [dispatches, amatsSessions, filterSource${extra}]);`;

// ─── calendar-view/page.tsx ──────────────────────────────────────────────────
applyPatches('app/calendar-view/page.tsx', [
  ['// ─── Status styles', AMATS_TYPE + '// ─── Status styles'],

  [`  const [filterStatus, setFilterStatus] = useState<string>("All");`,
   `  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);`],

  [`  useEffect(() => {
    fetch("/api/public/dispatches")
      .then(r => r.json())
      .then(data => { setDispatches(data.dispatches ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);`,
   `  useEffect(() => {
    Promise.all([
      fetch('/api/public/dispatches').then(r => r.json()),
      fetch('/api/public/amats-sessions').then(r => r.json()),
    ]).then(([dd, sa]) => {
      setDispatches(dd.dispatches ?? []);
      setAmatsSessions(sa.sessions ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);`],

  // dispatchMap callback (public calendar uses useCallback)
  [`  const dispatchMap = useCallback((): Record<string, Dispatch[]> => {
    const map: Record<string, Dispatch[]> = {};
    const filtered = filterStatus === "All"
      ? dispatches
      : dispatches.filter(d => d.status === filterStatus);
    for (const d of filtered) {
      if (!d.date_from || !d.date_to) continue;
      for (const key of getDateRange(d.date_from, d.date_to)) {
        if (!map[key]) map[key] = [];
        map[key].push(d);
      }
    }
    return map;
  }, [dispatches, filterStatus]);`, UNIFIED_DISPATCHMAP_CALLBACK],

  // subtitle
  [`{dispatches.length} total dispatch{dispatches.length !== 1 ? "es" : ""}`,
   `{dispatches.length} dispatch{dispatches.length !== 1 ? 'es' : ''} · {amatsSessions.length} AMaTS`],

  // Source filter pills before Workload link
  [`          <a href="/workload-view"`,
   `          <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5">
            {([['all','All'],['dispatch','Dispatches'],['amats','AMaTS']] as const).map(([v,l]) => (
              <button key={v} onClick={()=>setFilterSource(v)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{ background: filterSource===v ? 'white' : 'transparent', color: filterSource===v ? '#0F1A4A' : 'rgba(255,255,255,0.7)' }}>
                {v==='amats' ? '🧪 ' : ''}{l}
              </button>
            ))}
          </div>
          <a href="/workload-view"`],

  // Chip style in grid
  [`                            style={{ background: colors.badge, borderLeft: \`3px solid \${d.created_by_role === "AMaTS" ? "#7B1F2F" : "#1B2A6B"}\`}}>`,
   `                            style={{ background: d._type==='amats'?'rgba(13,148,136,0.15)':colors.badge, borderLeft: \`3px solid \${d._type==='amats'?'#0D9488':'#1B2A6B'}\`}}>`],

  // Chip label in grid
  [`                              {d.company_name ?? d.dispatch_number ?? "Dispatch"}`,
   `                              {d._type==='amats'?('🧪 '+(d.session_number??d.machine??'AMaTS')):(d.company_name??d.dispatch_number??'Dispatch')}`],

  // Side panel header
  [`                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Dispatches on</p>`,
   `                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Schedule on</p>`],
  [`                <p className="text-xs text-gray-400 mt-0.5">{dayDispatches.length} dispatch{dayDispatches.length !== 1 ? "es" : ""}</p>`,
   `                <p className="text-xs text-gray-400 mt-0.5">{dayDispatches.length} item{dayDispatches.length!==1?'s':''}</p>`],

  // Card click
  [`                          onClick={() => setSelectedDispatch(d)}`,
   `                          onClick={() => d._type==='amats'?(window.location.href='/amats/'+d.id):setSelectedDispatch(d)}`],

  // Card title
  [`                               {d.company_name ?? "Untitled"}`,
   `                               {d._type==='amats'?('🧪 '+(d.machine_name_or_code??d.machine??'AMaTS Session')):(d.company_name??'Untitled')}`],

  // Location row
  [`                             <span>📍 {d.type === "in_house" ? "AMTEC" : (d.testing_location ?? d.location ?? "—")}</span>`,
   `                             {d._type!=='amats'&&<span>📍 {d.type==='in_house'?'AMTEC':(d.testing_location??d.location??'—')}</span>}
                             {d._type==='amats'&&<span>🧪 {(d.amats_session_tests||[]).slice(0,2).map((t: {test_name:string})=>t.test_name).join(', ')||'AMaTS Testing'}</span>}`],

  // Tap text
  [`                          <p className="text-xs text-gray-400 mt-2 font-medium">Tap to see details →</p>`,
   `                          <p className="text-xs text-gray-400 mt-2 font-medium">{d._type==='amats'?'View AMaTS Session →':'Tap to see details →'}</p>`],

  // Legend — append AMaTS entry
  [`          </div>

        {/* ── RIGHT`,
   `            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: '#0D9488' }} />
              <span className="text-xs text-gray-500">🧪 AMaTS Session</span>
            </div>
          </div>

        {/* ── RIGHT`],
]);

// ─── calendar/page.tsx ───────────────────────────────────────────────────────
applyPatches('app/calendar/page.tsx', [
  ['const DAYS = ["Sun"', AMATS_TYPE + 'const DAYS = ["Sun"'],

  [`  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [view, setView] = useState<"month" | "week">("month");`,
   `  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');
  const [view, setView] = useState<"month" | "week">("month");`],

  [`      const res = await fetch("/api/dispatches", {
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
      setLoading(false);`],

  [`  const dispatchMap = useMemo(() => {
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
  }, [dispatches]);`, UNIFIED_DISPATCHMAP_MEMO()],

  [`<p className="text-sm text-gray-500 mt-0.5">{dispatches.length} dispatches loaded</p>`,
   `<p className="text-sm text-gray-500 mt-0.5">{dispatches.length} dispatches · {amatsSessions.length} AMaTS sessions</p>`],

  // Source filter pills before Month/Week toggle
  [`              <div className="flex rounded-lg overflow-hidden border border-gray-200 self-start sm:self-auto">`,
   `              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                {([['all','All'],['dispatch','Dispatches'],['amats','AMaTS']] as const).map(([v,l]) => (
                  <button key={v} onClick={()=>setFilterSource(v)}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{ background: filterSource===v?'#1B2A6B':'transparent', color: filterSource===v?'white':'#6B7280' }}>
                    {v==='amats'?'🧪 ':''}{l}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 self-start sm:self-auto">`],

  // Month chip style+label
  [`                          style={{ background: "rgba(27,42,107,0.1)", color: "#1B2A6B" }}
                          title={d.dispatch_number ?? d.company_name ?? "Dispatch"}>
                          {d.dispatch_number ?? d.company_name ?? "Dispatch"}`,
   `                          style={{ background: d._type==='amats'?'rgba(13,148,136,0.15)':'rgba(27,42,107,0.1)', color: d._type==='amats'?'#0D9488':'#1B2A6B' }}
                          title={d._type==='amats'?(d.session_number??'AMaTS'):(d.dispatch_number??d.company_name??'Dispatch')}>
                          {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):(d.dispatch_number??d.company_name??'Dispatch')}`],

  // Week chip style+label
  [`                            style={{ background: "rgba(27,42,107,0.1)", color: "#1B2A6B" }}
                            title={d.dispatch_number ?? d.company_name ?? "Dispatch"}>
                            {d.dispatch_number ?? d.company_name ?? "Dispatch"}`,
   `                            style={{ background: d._type==='amats'?'rgba(13,148,136,0.15)':'rgba(27,42,107,0.1)', color: d._type==='amats'?'#0D9488':'#1B2A6B' }}
                            title={d._type==='amats'?(d.session_number??'AMaTS'):(d.dispatch_number??d.company_name??'Dispatch')}>
                            {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):(d.dispatch_number??d.company_name??'Dispatch')}`],

  [`onClick={e => { e.stopPropagation(); router.push(\`/dispatches/\${d.id}\`); }}`,
   `onClick={e => { e.stopPropagation(); router.push(d._type==='amats'?\`/amats/\${d.id}\`:\`/dispatches/\${d.id}\`); }}`],

  [`                        onClick={() => router.push(\`/dispatches/\${d.id}\`)}`,
   `                        onClick={() => router.push(d._type==='amats'?\`/amats/\${d.id}\`:\`/dispatches/\${d.id}\`)}`],

  [`                        <p className="text-xs font-bold" style={{ color: "#1B2A6B" }}>
                          {d.dispatch_number ?? "No Number"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{d.company_name ?? "—"}</p>`,
   `                        <p className="text-xs font-bold" style={{ color: d._type==='amats'?'#0D9488':'#1B2A6B' }}>
                          {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):(d.dispatch_number??'No Number')}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{d._type==='amats'?(d.machine_name_or_code??d.machine):(d.company_name??'—')}</p>`],

  [`<p className="text-xs text-gray-400 italic">Click a date to see dispatches.</p>`,
   `<p className="text-xs text-gray-400 italic">Click a date to see events.</p>`],
  [`<p className="text-xs text-gray-400 italic">No dispatches on this date.</p>`,
   `<p className="text-xs text-gray-400 italic">No events on this date.</p>`],
]);

// ─── dashboard/page.tsx ──────────────────────────────────────────────────────
applyPatches('app/dashboard/page.tsx', [
  [`const DAYS = ["SUN"`, AMATS_TYPE + `const DAYS = ["SUN"`],

  [`  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);`,
   `  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');
  const [loading, setLoading] = useState(true);`],

  [`        const res = await fetch("/api/dispatches", {
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
        if (json.noAssignments) setNoAssignments(true);`],

  [`  const dispatchMap = useMemo(() => {
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
  }, [dispatches]);`, UNIFIED_DISPATCHMAP_MEMO()],

  // Source filter pills — insert after the calendar header nav row
  [`            </div>

            {/* Day headers */}`,
   `            </div>
            {/* Source filter */}
            <div className="flex items-center gap-1.5 px-5 pb-3">
              {([['all','All'],['dispatch','Dispatches'],['amats','AMaTS']] as const).map(([v,l]) => (
                <button key={v} onClick={()=>setFilterSource(v)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={{ background: filterSource===v?theme.primary:'white', color: filterSource===v?'white':'#6B7280', borderColor: filterSource===v?theme.primary:'#E5E7EB' }}>
                  {v==='amats'?'🧪 ':''}{l}
                </button>
              ))}
            </div>

            {/* Day headers */}`],

  // Chip click
  [`onClick={e => { e.stopPropagation(); router.push(\`/dispatches/\${d.id}\`); }}`,
   `onClick={e => { e.stopPropagation(); router.push(d._type==='amats'?\`/amats/\${d.id}\`:\`/dispatches/\${d.id}\`); }}`],

  // Chip style
  [`                            style={{ background: "rgba(27,42,107,0.1)", color: "#1B2A6B" }}`,
   `                            style={{ background: d._type==='amats'?'rgba(13,148,136,0.15)':'rgba(27,42,107,0.1)', color: d._type==='amats'?'#0D9488':'#1B2A6B' }}`],

  // Chip label
  [`                            title={d.dispatch_number ?? d.company_name ?? "Dispatch"}>
                            {d.dispatch_number ?? d.company_name ?? "Dispatch"}`,
   `                            title={d._type==='amats'?(d.session_number??'AMaTS'):(d.dispatch_number??d.company_name??'Dispatch')}>
                            {d._type==='amats'?('🧪 '+(d.session_number??'AMaTS')):(d.dispatch_number??d.company_name??'Dispatch')}`],
]);

console.log('\nAll done!');
