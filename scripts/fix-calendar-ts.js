// Fix TypeScript errors in all three calendar files
const fs = require('fs');

// ── helpers ──────────────────────────────────────────────────────────────────
function fix(path, replacements) {
  let c = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!c.includes(from)) { console.warn('MISS in', path, ':', from.slice(0,60)); continue; }
    c = c.replace(from, to);
  }
  fs.writeFileSync(path, c, 'utf8');
  console.log('Fixed:', path);
}

// ── calendar-view/page.tsx ───────────────────────────────────────────────────
fix('app/calendar-view/page.tsx', [
  // Fix 'a' implicit any in personnel mapping
  [
    `.filter(a => ["engineer", "lead_engineer", "assistant_engineer"].includes(a.assignment_type));`,
    `.filter((a: {assignment_type: string}) => ["engineer", "lead_engineer", "assistant_engineer"].includes(a.assignment_type));`
  ],
  [
    `.filter(a => a.assignment_type === "technician");`,
    `.filter((a: {assignment_type: string}) => a.assignment_type === "technician");`
  ],
  // Fix .location and .testing_location on CalendarItem union
  [
    `{(d as CalendarItem)._type==='dispatch' && <span>📍 {d.type === 'in_house' ? 'AMTEC' : (d.testing_location ?? d.location ?? '—')}</span>}`,
    `{(d as CalendarItem)._type==='dispatch' && <span>📍 {(d as Dispatch & {_type:'dispatch'}).type === 'in_house' ? 'AMTEC' : ((d as Dispatch & {_type:'dispatch'}).testing_location ?? (d as Dispatch & {_type:'dispatch'}).location ?? '—')}</span>}`
  ],
]);

// ── calendar/page.tsx ────────────────────────────────────────────────────────
// Read and apply surgical fixes
let c = fs.readFileSync('app/calendar/page.tsx', 'utf8');

// Fix state declarations - the patch may have missed due to wrong surrounding text
// Add state variables if not present
if (!c.includes('filterSource')) {
  c = c.replace(
    `  const [loading, setLoading] = useState(true);`,
    `  const [loading, setLoading] = useState(true);
  const [amatsSessions, setAmatsSessions] = useState<AmatsSession[]>([]);
  const [filterSource, setFilterSource] = useState<'all'|'dispatch'|'amats'>('all');`
  );
}

// Fix monthDispatches if it exists (dashboard only needs it, not calendar)
// Fix noAssignments reference
c = c.replace(
  `      if (json.noAssignments) setNoAssignments(true);`,
  `      if (json.noAssignments) setNoAssignments(true);
      const amatsJson = amatsRes ? await amatsRes.json() : { sessions: [] };
      setAmatsSessions(amatsJson.sessions ?? []);`
);

// Remove the duplicate amats fetch assignment (it may be double)
while (c.includes('const amatsJson = amatsRes ? await amatsRes.json()') &&
       c.includes('const amatsJson = await amatsRes.json()')) {
  c = c.replace('const amatsJson = await amatsRes.json();\n      setAmatsSessions(amatsJson.sessions ?? []);\n', '');
}

// Fix the side panel "no dispatches" text - check for old text
// Fix chips: dispatch_number and company_name accessed directly on CalendarItem
c = c.replace(
  `{d.dispatch_number ?? d.company_name ?? "Dispatch"}`,
  `{(d as CalendarItem)._type==='amats' ? ('🧪 '+((d as AmatsSession).session_number ?? 'AMaTS')) : ((d as Dispatch & {_type:'dispatch'}).dispatch_number ?? (d as Dispatch & {_type:'dispatch'}).company_name ?? 'Dispatch')}`
);

// Fix side panel dispatch_number / company_name references
c = c.replace(
  `{d.dispatch_number ?? "No Number"}`,
  `{(d as CalendarItem)._type==='amats' ? ((d as AmatsSession).session_number ?? 'AMaTS') : ((d as Dispatch & {_type:'dispatch'}).dispatch_number ?? 'No Number')}`
);
c = c.replace(
  `{d.company_name ?? "—"}`,
  `{(d as CalendarItem)._type==='amats' ? ((d as AmatsSession).machine_name_or_code ?? (d as AmatsSession).machine) : ((d as Dispatch & {_type:'dispatch'}).company_name ?? '—')}`
);

// Fix monthDispatches filter (dashboard): dispatches.filter works on Dispatch[], keep as-is using `as`
fs.writeFileSync('app/calendar/page.tsx', c, 'utf8');
console.log('Fixed: app/calendar/page.tsx');

// ── dashboard/page.tsx ───────────────────────────────────────────────────────
let dsh = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

// Fix dispatch_number / company_name accessed on CalendarItem in dashboard chip
dsh = dsh.replace(
  `{(d as CalendarItem)._type==='amats' ? ('🧪 '+((d as AmatsSession).session_number ?? 'AMaTS')) : (d.dispatch_number ?? d.company_name ?? 'Dispatch')}`,
  `{(d as CalendarItem)._type==='amats' ? ('🧪 '+((d as AmatsSession).session_number ?? 'AMaTS')) : ((d as Dispatch & {_type:'dispatch'}).dispatch_number ?? (d as Dispatch & {_type:'dispatch'}).company_name ?? 'Dispatch')}`
);
dsh = dsh.replace(
  `title={(d as CalendarItem)._type==='amats' ? ((d as AmatsSession).session_number ?? 'AMaTS') : (d.dispatch_number ?? d.company_name ?? 'Dispatch')}`,
  `title={(d as CalendarItem)._type==='amats' ? ((d as AmatsSession).session_number ?? 'AMaTS') : ((d as Dispatch & {_type:'dispatch'}).dispatch_number ?? (d as Dispatch & {_type:'dispatch'}).company_name ?? 'Dispatch')}`
);

// Fix created_by_role references - these only exist on Dispatch, not AmatsSession
dsh = dsh.replace(
  /\{d\.created_by_role[^}]+\}/g,
  `{(d as CalendarItem)._type === 'dispatch' ? (d as Dispatch & {_type:'dispatch'}).created_by_role : 'AMaTS'}`
);

// Fix monthDispatches which filters Dispatch[] but now dispatchMap is CalendarItem[]
// monthDispatches should still use raw dispatches array which is fine
// Fix selectedDispatches type issue — selectedItems is now the typed one
fs.writeFileSync('app/dashboard/page.tsx', dsh, 'utf8');
console.log('Fixed: app/dashboard/page.tsx');
