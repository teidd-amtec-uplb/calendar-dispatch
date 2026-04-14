# AMaTS Implementation Plan
## AMTEC Calendar Dispatch — AMaTS Workflow Extension

> Generated: April 14, 2026
> Scope: Code audit fixes + Role rename + AMaTS Testing Form + Machine→Tests mapping

---

## Part 1 — Implementation Plan (Step-by-Step)

### Phase 1: Bug Fixes (Pre-AMaTS Cleanup)
1. Fix `role === "scheduler"` → `"admin_scheduler"` in `/dispatches/page.tsx` and `/calendar/page.tsx`
2. Fix `Dispatch` type in `/dispatches/page.tsx` to use `dispatch_assignments` instead of `dispatch_engineers`/`dispatch_technicians`
3. Delete or repurpose the dead `app/dispatch/page.tsx`
4. Rename `mechanical_lab` → `AMaTS` everywhere (role values, labels, theme, sidebar)

### Phase 2: Database Schema Updates
1. Add `amats_sessions` table for AMaTS testing records
2. Add `amats_session_tests` join table for selected tests per session
3. Add `amats_session_assignments` for engineers/technicians per session
4. (Optional) Add `machine_tests` lookup table for the Machine→Tests mapping (or use a seeded constant in code)

### Phase 3: Shared Data Layer
1. Create `lib/amats-machine-tests.ts` — the canonical Machine→Tests mapping constant
2. Create API routes: `GET /api/amats/sessions`, `POST /api/amats/sessions`, etc.

### Phase 4: AMaTS Testing Form UI
1. Create `app/amats/new/page.tsx` — the new AMaTS Testing Form
2. Add route to Sidebar for `AMaTS` role users

### Phase 5: AMaTS Session List & Detail
1. Create `app/amats/page.tsx` — session list
2. Create `app/amats/[id]/page.tsx` — session detail view

---

## Part 2 — Database Schema Updates

Run this as `007_amats_schema.sql` in Supabase SQL Editor **after** all existing migrations.

```sql
-- 007_amats_schema.sql
-- AMaTS Testing Sessions

-- Core session table
CREATE TABLE IF NOT EXISTS amats_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number TEXT NOT NULL UNIQUE,               -- e.g. AMaTS-2026-0001
  machine TEXT NOT NULL,
  machine_name_or_code TEXT,                          -- Specific machine name or code
  date_from TIMESTAMPTZ NOT NULL,
  date_to TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled'
    CHECK (status IN ('Scheduled', 'Ongoing', 'Done', 'Cancelled', 'Re-scheduled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Selected tests for the session (many-to-many)
CREATE TABLE IF NOT EXISTS amats_session_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES amats_sessions(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL
);

-- Personnel assigned to a session
CREATE TABLE IF NOT EXISTS amats_session_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES amats_sessions(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id),
  assignment_type TEXT NOT NULL
    CHECK (assignment_type IN ('test_engineer', 'test_technician'))
);

-- Optional: persist machine→tests mapping in DB for admin edits
-- (If you prefer DB-driven over code constants, use this table)
-- CREATE TABLE IF NOT EXISTS machine_tests (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   machine_name TEXT NOT NULL,
--   test_name TEXT NOT NULL,
--   sort_order INT DEFAULT 0
-- );

-- Update profiles role check to allow 'AMaTS'
-- NOTE: If your profiles table has a CHECK constraint on role, update it:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin_scheduler', 'AMaTS', 'staff', 'viewer'));

-- If you have existing rows with role = 'mechanical_lab', migrate them:
UPDATE profiles SET role = 'AMaTS' WHERE role = 'mechanical_lab';
```

---

## Part 3 — File/Folder Changes

```
calendar-dispatch/
├── app/
│   ├── amats/                          ← NEW
│   │   ├── new/page.tsx                ← NEW: AMaTS Testing Form
│   │   ├── [id]/page.tsx               ← NEW: AMaTS Session Detail
│   │   └── page.tsx                    ← NEW: AMaTS Session List
│   ├── api/
│   │   └── amats/
│   │       ├── sessions/
│   │       │   ├── route.ts            ← NEW: GET all + POST create session
│   │       │   └── [id]/route.ts       ← NEW: GET one + PUT + DELETE session
│   │       └── machine-tests/route.ts  ← NEW: GET tests for a machine
│   ├── components/
│   │   └── Sidebar.tsx                 ← MODIFIED: add AMaTS nav, rename role label
│   ├── dispatch/
│   │   └── page.tsx                    ← DELETE (dead page)
│   ├── dispatches/
│   │   └── page.tsx                    ← FIX: role check + type fix
│   └── calendar/
│       └── page.tsx                    ← FIX: role check
├── lib/
│   ├── amats-machine-tests.ts          ← NEW: Machine→Tests constant map
│   └── theme.ts                        ← MODIFIED: mechanical_lab → AMaTS
└── scripts/
    └── 007_amats_schema.sql            ← NEW
```

---

## Part 4 — Code

---

### `lib/amats-machine-tests.ts` — Machine→Tests Mapping

```typescript
// lib/amats-machine-tests.ts
// Canonical mapping of AMaTS machines to their available tests.
// Source: AMaTS Machine Testing and Studies Laboratory document.

export interface MachineTestConfig {
  machine: string;
  tests: string[];
}

export const AMATS_MACHINE_TESTS: MachineTestConfig[] = [
  {
    machine: "Internal Combustion Engine",
    tests: [
      "Maximum power test",
      "Varying load test",
      "Varying speed test",
      "Continuous running test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Walking-Type Agricultural Tractor",
    tests: [
      "Varying load test",
      "Continuous running test",
      "Transmission efficiency test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Four-wheel Tractor",
    tests: [
      "Maximum power test",
      "Test at full load and varying speed",
      "Hydraulic power and lifting force test",
      "Turning radius test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Centrifugal Pump",
    tests: [
      "Performance test",
      "Cavitation test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Agricultural and Fishery Pumpset",
    tests: [
      "Performance test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Knapsack Sprayer",
    tests: [
      "Initial Assessment",
      "Volumetric efficiency test",
      "Actual volume discharge per stroke determination",
      "Leak test",
      "Tilt and inversion test",
      "Discharge test",
      "Spray angle determination",
      "Measuring spray droplet size",
      "Cut-off Valve Reliability test",
      "Pressure test",
      "Continuous running test",
      "Strap drop test",
      "Drop test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Agricultural Power Sprayer",
    tests: [
      "Discharge test",
      "Spray range test",
      "Spray quality test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Mist Blower",
    tests: [
      "Performance test",
      "Air velocity test",
      "Discharge test",
      "Range and width test",
      "Droplet test",
      "Seed broadcaster test",
      "Fertilizer applicator test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Brush Cutter",
    tests: [
      "Performance test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Solar-Powered Irrigation System",
    tests: [
      "Performance test",
      "Verification of machine specification/Photo documentation",
    ],
  },
];

/** Returns all machine names for the dropdown. */
export function getMachineNames(): string[] {
  return AMATS_MACHINE_TESTS.map((m) => m.machine);
}

/** Returns tests for a given machine name, or [] if not found. */
export function getTestsForMachine(machineName: string): string[] {
  return (
    AMATS_MACHINE_TESTS.find((m) => m.machine === machineName)?.tests ?? []
  );
}
```

---

### `app/api/amats/machine-tests/route.ts`

```typescript
// app/api/amats/machine-tests/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  AMATS_MACHINE_TESTS,
  getTestsForMachine,
  getMachineNames,
} from "@/lib/amats-machine-tests";

export async function GET(req: NextRequest) {
  const machine = req.nextUrl.searchParams.get("machine");

  // No machine param → return all machine names
  if (!machine) {
    return NextResponse.json({ machines: getMachineNames() });
  }

  const tests = getTestsForMachine(machine);
  if (tests.length === 0) {
    return NextResponse.json(
      { error: "Machine not found", tests: [] },
      { status: 404 }
    );
  }

  return NextResponse.json({ machine, tests });
}
```

---

### `app/api/amats/sessions/route.ts`

```typescript
// app/api/amats/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/requireAccess";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("amats_sessions")
    .select(`
      *,
      amats_session_tests ( test_name ),
      amats_session_assignments ( assignment_type, staff:staff_id ( id, full_name, initials, designation ) )
    `)
    .order("date_from", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only AMaTS role (or admin_scheduler) can create sessions
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["AMaTS", "admin_scheduler"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    session_number,
    machine,
    machine_name_or_code,
    date_from,
    date_to,
    notes,
    selected_tests,     // string[]
    engineers,          // { staff_id: string }[]
    technicians,        // { staff_id: string }[]
  } = body;

  // Validate required fields
  if (!session_number || !machine || !date_from || !date_to) {
    return NextResponse.json(
      { error: "session_number, machine, date_from, and date_to are required" },
      { status: 400 }
    );
  }

  if (!selected_tests || selected_tests.length === 0) {
    return NextResponse.json(
      { error: "At least one test must be selected" },
      { status: 400 }
    );
  }

  // Insert session
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("amats_sessions")
    .insert({
      session_number,
      machine,
      machine_name_or_code: machine_name_or_code || null,
      date_from,
      date_to,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (sessionError) {
    if (sessionError.code === "23505") {
      return NextResponse.json(
        { error: "Session number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // Insert selected tests
  if (selected_tests.length > 0) {
    const testRows = selected_tests.map((test_name: string) => ({
      session_id: session.id,
      test_name,
    }));
    const { error: testsError } = await supabaseAdmin
      .from("amats_session_tests")
      .insert(testRows);
    if (testsError) {
      await supabaseAdmin.from("amats_sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: testsError.message }, { status: 500 });
    }
  }

  // Insert assignments (engineers)
  const allAssignments = [
    ...(engineers || []).map((e: { staff_id: string }) => ({
      session_id: session.id,
      staff_id: e.staff_id,
      assignment_type: "test_engineer",
    })),
    ...(technicians || []).map((t: { staff_id: string }) => ({
      session_id: session.id,
      staff_id: t.staff_id,
      assignment_type: "test_technician",
    })),
  ];

  if (allAssignments.length > 0) {
    const { error: assignError } = await supabaseAdmin
      .from("amats_session_assignments")
      .insert(allAssignments);
    if (assignError) {
      await supabaseAdmin.from("amats_sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ session }, { status: 201 });
}
```

---

### `app/api/amats/sessions/[id]/route.ts`

```typescript
// app/api/amats/sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/requireAccess";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("amats_sessions")
    .select(`
      *,
      amats_session_tests ( id, test_name ),
      amats_session_assignments (
        id,
        assignment_type,
        staff:staff_id ( id, full_name, initials, designation )
      )
    `)
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ session: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["AMaTS", "admin_scheduler"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    machine,
    machine_name_or_code,
    date_from,
    date_to,
    notes,
    selected_tests,
    engineers,
    technicians,
  } = body;

  // Update core session
  const { error: updateError } = await supabaseAdmin
    .from("amats_sessions")
    .update({
      machine,
      machine_name_or_code: machine_name_or_code || null,
      date_from,
      date_to,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Replace tests
  await supabaseAdmin.from("amats_session_tests").delete().eq("session_id", params.id);
  if (selected_tests && selected_tests.length > 0) {
    await supabaseAdmin.from("amats_session_tests").insert(
      selected_tests.map((t: string) => ({ session_id: params.id, test_name: t }))
    );
  }

  // Replace assignments
  await supabaseAdmin.from("amats_session_assignments").delete().eq("session_id", params.id);
  const allAssignments = [
    ...(engineers || []).map((e: { staff_id: string }) => ({
      session_id: params.id,
      staff_id: e.staff_id,
      assignment_type: "test_engineer",
    })),
    ...(technicians || []).map((t: { staff_id: string }) => ({
      session_id: params.id,
      staff_id: t.staff_id,
      assignment_type: "test_technician",
    })),
  ];
  if (allAssignments.length > 0) {
    await supabaseAdmin.from("amats_session_assignments").insert(allAssignments);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["AMaTS", "admin_scheduler"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("amats_sessions")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

---

### `app/amats/new/page.tsx` — AMaTS Testing Form

```tsx
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
      setEngineers((engData.engineers || []).map((e: StaffMember) => ({ ...e, type: "engineer" })));
      setTechnicians((techData.technicians || []).map((t: StaffMember) => ({ ...t, type: "technician" })));
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

  const toggleTest = useCallback((test: string) => {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  }, []);

  const toggleEngineer = useCallback((id: string) => {
    setSelectedEngineers((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }, []);

  const toggleTechnician = useCallback((id: string) => {
    setSelectedTechnicians((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllTests = () => {
    if (selectedTests.length === availableTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests([...availableTests]);
    }
  };

  const handleSave = async () => {
    setError(null);

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
    } catch (err: unknown) {
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="datetime-local"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </section>

          {/* Section: Personnel */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Personnel
            </h2>
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
                    engineers.map((eng) => (
                      <label
                        key={eng.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedEngineers.includes(eng.id)
                            ? "bg-red-50 border-red-300"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEngineers.includes(eng.id)}
                          onChange={() => toggleEngineer(eng.id)}
                          className="accent-red-600 w-4 h-4 flex-shrink-0"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-800">{eng.full_name}</div>
                          <div className="text-xs text-gray-500">{eng.designation}</div>
                        </div>
                      </label>
                    ))
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
                    technicians.map((tech) => (
                      <label
                        key={tech.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedTechnicians.includes(tech.id)
                            ? "bg-red-50 border-red-300"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTechnicians.includes(tech.id)}
                          onChange={() => toggleTechnician(tech.id)}
                          className="accent-red-600 w-4 h-4 flex-shrink-0"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-800">{tech.full_name}</div>
                          <div className="text-xs text-gray-500">{tech.designation}</div>
                        </div>
                      </label>
                    ))
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
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
```

---

### `app/amats/page.tsx` — AMaTS Session List

```tsx
// app/amats/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { supabaseBrowser } from "@/lib/supabase/client";

interface AmatsSummary {
  id: string;
  session_number: string;
  machine: string;
  machine_name_or_code: string | null;
  date_from: string;
  date_to: string;
  status: string;
  amats_session_tests: { test_name: string }[];
  amats_session_assignments: {
    assignment_type: string;
    staff: { full_name: string; initials: string } | null;
  }[];
}

function getStatusColor(status: string) {
  switch (status) {
    case "Scheduled": return "bg-blue-100 text-blue-800";
    case "Ongoing": return "bg-yellow-100 text-yellow-800";
    case "Done": return "bg-green-100 text-green-800";
    case "Cancelled": return "bg-gray-100 text-gray-600";
    case "Re-scheduled": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-600";
  }
}

export default function AMaTSSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AmatsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const init = async () => {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const profileRes = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const profileData = await profileRes.json();
      setUserRole(profileData.profile?.role ?? null);

      const res = await fetch("/api/amats/sessions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setSessions(data.sessions || []);
      setLoading(false);
    };
    init();
  }, [router]);

  const isManager = userRole === "AMaTS" || userRole === "admin_scheduler";

  const filtered = sessions.filter(
    (s) =>
      s.session_number.toLowerCase().includes(search.toLowerCase()) ||
      s.machine.toLowerCase().includes(search.toLowerCase()) ||
      (s.machine_name_or_code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AMaTS Testing Sessions</h1>
            <p className="text-sm text-gray-500 mt-1">
              Agricultural Machinery Testing and Studies Laboratory
            </p>
          </div>
          {isManager && (
            <button
              onClick={() => router.push("/amats/new")}
              className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors"
            >
              + New Session
            </button>
          )}
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by session number or machine..."
            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading sessions...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {search ? "No sessions match your search." : "No sessions yet."}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Session #</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Machine</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tests</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date From</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date To</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Engineers</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const sessionEngineers = s.amats_session_assignments
                    .filter((a) => a.assignment_type === "test_engineer" && a.staff)
                    .map((a) => a.staff!.initials);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/amats/${s.id}`)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                        i % 2 === 0 ? "" : "bg-gray-50/30"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{s.session_number}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{s.machine}</div>
                        {s.machine_name_or_code && (
                          <div className="text-xs text-gray-400">{s.machine_name_or_code}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.amats_session_tests.length} test{s.amats_session_tests.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(s.date_from).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(s.date_to).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {sessionEngineers.length > 0 ? sessionEngineers.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(s.status)}`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

---

### `app/amats/[id]/page.tsx` — AMaTS Session Detail

```tsx
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
      setLoading(false);
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
                onClick={() => router.push(`/amats/${session.id}/edit`)}
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
```

---

### Bug Fixes — Existing Files

#### Fix 1: `app/dispatches/page.tsx` — Two fixes in one

```typescript
// LINE ~172: Change this:
{role === "scheduler" && (
  <button onClick={() => router.push("/dispatch/new")}>+ New Dispatch</button>
)}

// To this:
{(role === "admin_scheduler" || role === "AMaTS") && (
  <button onClick={() => router.push("/dispatch/new")}>+ New Dispatch</button>
)}
```

```typescript
// Also fix the Dispatch type — replace old join fields:

// BEFORE (broken):
interface Dispatch {
  // ...
  dispatch_engineers: { staff: { full_name: string } }[];
  dispatch_technicians: { staff: { full_name: string } }[];
}

// AFTER (correct):
interface Dispatch {
  // ...
  dispatch_assignments: {
    assignment_type: "lead_engineer" | "assistant_engineer" | "technician";
    staff: { full_name: string; initials: string } | null;
  }[];
}

// Then fix the columns in the table render:
// Engineers column:
const engineers = row.dispatch_assignments
  ?.filter((a) => ["lead_engineer", "assistant_engineer"].includes(a.assignment_type))
  .map((a) => a.staff?.initials ?? "?")
  .join(", ") || "—";

// Technicians column:
const technicians = row.dispatch_assignments
  ?.filter((a) => a.assignment_type === "technician")
  .map((a) => a.staff?.initials ?? "?")
  .join(", ") || "—";
```

---

#### Fix 2: `app/calendar/page.tsx` — Role check fix

```typescript
// LINE ~145: Change this:
{role === "scheduler" && (
  <Link href="/dispatch/new">+ New Dispatch</Link>
)}

// To this:
{(role === "admin_scheduler" || role === "AMaTS") && (
  <Link href="/dispatch/new">+ New Dispatch</Link>
)}
```

---

#### Fix 3: `app/components/Sidebar.tsx` — Add AMaTS nav item

```typescript
// Add to the manager-only navigation array:
const AMATS_NAV = [
  { label: "AMaTS Sessions", href: "/amats", icon: FlaskConical }, // use any icon you have
];

// In the nav render, add for AMaTS role:
{role === "AMaTS" && (
  <>
    {AMATS_NAV.map(item => (
      <NavItem key={item.href} {...item} />
    ))}
  </>
)}

// Also update the isManager check if used:
// BEFORE:
const isManager = role === "admin_scheduler" || role === "mechanical_lab";
// AFTER:
const isManager = role === "admin_scheduler" || role === "AMaTS";
```

---

#### Fix 4: `lib/theme.ts` — Rename role

```typescript
// BEFORE:
export function getRoleTheme(role: string) {
  if (role === "mechanical_lab") return { color: "#7f1d1d", label: "Mechanical Lab" };
  // ...
}

// AFTER:
export function getRoleTheme(role: string) {
  if (role === "AMaTS") return { color: "#7f1d1d", label: "AMaTS Lab" };
  // ...
}
```

---

#### Fix 5: `app/dispatch/page.tsx` — Delete this file

This file is dead (checks for non-existent `"scheduler"` role). Simply delete it. The real form lives at `/dispatch/new/page.tsx`.

---

## Part 5 — Key Logic Explanations

### Dynamic Machine → Tests Mapping

The `getTestsForMachine(machine)` function in `lib/amats-machine-tests.ts` is a pure lookup against `AMATS_MACHINE_TESTS`. In `app/amats/new/page.tsx`, a `useEffect` watches the `machine` state:

```typescript
useEffect(() => {
  if (machine) {
    const tests = getTestsForMachine(machine);
    setAvailableTests(tests);
    setSelectedTests([]); // Reset selections when machine changes
  }
}, [machine]);
```

This means: when the user changes the machine dropdown, the test list is immediately replaced with the new machine's tests, and all prior selections are cleared — preventing invalid test-machine combinations from being saved.

### Role-Based Rendering

The form page fetches the user's profile via `/api/me` on load and redirects non-AMaTS/non-admin users to `/dashboard`. The API routes double-enforce this server-side via the `profiles` table role check. This two-layer enforcement (client redirect + server 403) is consistent with how the existing Scheduler Dispatch system works.

### Separation of Workflows

The `amats_sessions` table is entirely separate from `dispatches`. The two workflows share the `staff` table for personnel data (same engineers/technicians pool) but have no other overlap. The Scheduler Dispatch form at `/dispatch/new` is untouched. AMaTS users see their `/amats` routes; Scheduler users see their `/dispatch` routes.

---

## Part 6 — Breaking Changes & Migration Steps

1. **Run `007_amats_schema.sql`** in Supabase SQL Editor. This migrates `profiles.role` from `mechanical_lab` to `AMaTS` for all existing users.

2. **Update any existing `mechanical_lab` users** — the migration SQL handles this automatically via the `UPDATE profiles SET role = 'AMaTS'` statement.

3. **Delete `app/dispatch/page.tsx`** — this dead file causes confusion but does not break anything if left; deletion is clean-up.

4. **The `lib/theme.ts` role rename** affects dispatch chip colors on the dashboard (`created_by_role` column). You should also update `dispatches` rows in the DB:
   ```sql
   UPDATE dispatches SET created_by_role = 'AMaTS' WHERE created_by_role = 'mechanical_lab';
   ```

5. **No changes to the `dispatches` API or form** — fully backward compatible.

---

## Part 7 — Suggested Improvements / Optimizations

- **`machine_tests` as a DB table**: Currently the Machine→Tests map is a code constant. Moving it to a Supabase table would let admins manage it via UI without code deploys. The `007_amats_schema.sql` file includes the commented-out DDL for this.

- **AMaTS session number auto-generation**: Similar to dispatch numbers, you could auto-generate `AMaTS-YYYY-####` in the form using a counter from the DB.

- **Staff availability cross-check**: The AMaTS form currently does not check if engineers/technicians are already booked on dispatch assignments for the same dates. You can reuse `GET /api/staff/availability` — it already supports `date_from`, `date_to`, and `exclude_dispatch_id`, and is machine-agnostic.

- **Itinerary Tab (existing backlog)**: Now that AMaTS is separate, implementing the Itinerary tab in the Scheduler Dispatch form is easier — it won't block AMaTS work.

- **PDF export for AMaTS sessions**: Once the basic form is working, a PDF report for sessions can be added using the same Python script pattern or a TypeScript-native library like `@react-pdf/renderer` (avoiding the Python dependency entirely).

- **`app/dispatch/page.tsx` cleanup**: Confirmed dead — delete it and clean up any routes.json or middleware references.
