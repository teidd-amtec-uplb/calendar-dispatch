# AMTEC Calendar Dispatch — Architecture & System Overview

> Last updated: April 14, 2026
> Status: **Active Development** — Several known issues documented below.

---

## 1. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend & API Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS v3 |
| **Database & Auth** | Supabase (PostgreSQL + GoTrue Auth) |
| **UI Components** | Custom-built React components (no external UI library) |
| **Calendar Logic** | Custom date-key grid mapping (`YYYY-MM-DD` keys) |
| **PDF Generation** | Python script (`generate_dispatch_pdf.py`) spawned via Node.js `child_process` |

---

## 2. Directory Structure

```text
calendar-dispatch/
├── app/                          # Next.js App Router Root
│   ├── admin/                    # Admin Panel page (staff directory)
│   │   └── page.tsx
│   ├── api/                      # Backend API Route Handlers (server-side only)
│   │   ├── admin/
│   │   │   └── users/route.ts    # GET all profiles (for admin management) + PUT activate user
│   │   ├── companies/route.ts    # GET company list
│   │   ├── dispatches/
│   │   │   ├── route.ts          # GET all dispatches, POST create dispatch
│   │   │   ├── [id]/route.ts     # GET one dispatch, PUT update, DELETE dispatch
│   │   │   ├── [id]/pdf/route.ts # GET generate PDF via Python subprocess
│   │   │   └── check-conflicts/route.ts  # POST conflict checker (staff + instrument overlap)
│   │   ├── ensure-profile/       # POST auto-create profile for new auth user
│   │   ├── instruments/          # GET all instruments, GET availability
│   │   ├── machine-instruments/  # GET instruments for a given machine
│   │   ├── machines/             # GET machine names list
│   │   ├── me/route.ts           # POST {userId} → returns profile (role, active)
│   │   ├── public/               # GET read-only public dispatch list (no auth required)
│   │   ├── signup/               # POST create auth + profile for new user
│   │   ├── staff/
│   │   │   ├── availability/route.ts   # GET staff conflict + cooldown status
│   │   │   ├── engineers/route.ts      # GET engineers list from staff table
│   │   │   └── technicians/route.ts    # GET technicians list from staff table
│   │   └── staff-events/         # GET staff calendar events (legacy)
│   ├── calendar/                 # "My Calendar" — auth-required, role-filtered calendar
│   │   └── page.tsx
│   ├── calendar-view/            # Public calendar — no auth required
│   ├── components/               # Shared UI components
│   │   ├── AppLayout.tsx         # Layout wrapper with Sidebar
│   │   └── Sidebar.tsx           # Navigation + pending user activations
│   ├── dashboard/                # Main landing page after login
│   │   └── page.tsx
│   ├── dispatch/
│   │   ├── new/page.tsx          # Create New Dispatch form (multi-tab)
│   │   └── page.tsx              # ⚠️ DEAD PAGE — old legacy form, checks for role "scheduler" (no longer exists)
│   ├── dispatches/
│   │   ├── page.tsx              # Dispatch list with search + filter + PDF export
│   │   └── [id]/
│   │       ├── page.tsx          # Dispatch detail view (read-only)
│   │       └── edit/page.tsx     # Edit Dispatch form (multi-tab, mirrors New Dispatch)
│   ├── login/                    # Login page
│   ├── signup/                   # Signup page
│   ├── workload-view/            # Gantt-style workload view (public-accessible)
│   ├── globals.css               # Minimal global styles
│   ├── layout.tsx                # Root layout (no sidebar here — AppLayout handles it)
│   └── page.tsx                  # Root page (redirects to /dashboard or /login)
├── lib/
│   ├── auth/
│   │   ├── ensureProfile.ts      # Auto-creates profile row for new Supabase auth user
│   │   └── requireAccess.ts      # getAuthUser(), requireRole() helpers for API routes
│   ├── supabase/
│   │   ├── client.ts             # Browser-side Supabase client (supabaseBrowser)
│   │   └── admin.ts              # Server-side admin client using SERVICE_ROLE_KEY
│   └── theme.ts                  # Role-based color themes (admin_scheduler vs AMaTS)
├── scripts/                      # Database migrations + tooling
│   ├── 001_phase1_schema.sql     # Consolidated schema migration (assignments, status, lab, roles)
│   ├── 002_phase2c_schema.sql    # Additional phase 2 alterations
│   ├── 002_staff_and_enhancements.sql  # Staff table, instrument catalog, machine defaults
│   ├── 003_machine_instrument_seeds.sql # Default machine→instrument mappings (seed data)
│   ├── 003_staff_calendar_events.sql   # Legacy staff event table (possibly unused now)
│   ├── 004_companies_seed.sql    # ~800+ companies seed data
│   ├── 004_profiles_surname_designation.sql  # Adds surname + designation to profiles
│   ├── 005_dispatches_created_by_role.sql    # Adds created_by_role column to dispatches
│   ├── 005_fix_instrument_splits.sql         # Fixes old "Graduated Cylinder / Power Meter" combined instruments
│   ├── 006_reset_machine_instruments.sql     # Full reset/reload of machine-instrument mappings
│   └── generate_dispatch_pdf.py  # Python script: reads dispatch JSON from stdin → outputs PDF bytes
├── middleware.ts                 # Route guard: unauthenticated users → /login
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Database Schema (Supabase / PostgreSQL)

### Core Lookup Tables

| Table | Purpose |
|---|---|
| `profiles` | 1-to-1 with Supabase `auth.users`. Stores `role`, `full_name`, `surname`, `initials`, `designation`, `lab`, `active` flag. |
| `staff` | Master personnel list (Engineers and Technicians). Separate from `profiles` — `profiles` = app users; `staff` = AMTEC field personnel. |
| `companies` | Client/manufacturer directory (~800+ entries via seed). Has `name`, `contact_person`, `contact_number`. |
| `instruments` | Catalog of physical test instruments. Has `instrument_name`, `instrument_code`, `brand`, `model`, `type`. |
| `machine_instrument_defaults` | Lookup table: `machine_name` → `instrument_name` (many-to-many). Used to auto-populate instruments when a machine is selected. |

### Transactional Tables

| Table | Purpose |
|---|---|
| `dispatches` | Core dispatch record. Fields include: `dispatch_number`, `date_from`, `date_to`, `company_name`, `contact_person`, `contact_number`, `contact_info`, `testing_location`, `type` (on_field/in_house), `transport_mode`, `transport_other_text`, `status`, `lab`, `notes`, `remarks_observation`, `created_by`, `created_by_role`. |
| `dispatch_assignments` | Staff assigned to a dispatch. Fields: `dispatch_id`, `staff_id`, `profile_id`, `assignment_type` (lead_engineer / assistant_engineer / technician), `is_override`, `override_reason`. |
| `dispatch_instruments` | Instruments assigned to a dispatch. Fields: `dispatch_id`, `instrument_name`, `code_brand_model`, `before_travel`, `remarks`. |
| `dispatch_machines` | Machines being tested in a dispatch. Fields: `dispatch_id`, `tam_no`, `machine`, `brand`, `model`, `serial_no`, `date_of_test`, `status` (Passed/Failed). |
| `dispatch_itinerary` | Per-day itinerary for the dispatch. Fields: `travel_date`, `per_diem_accommodation`, `per_diem_b/l/d`, `time_of_travel`, `working_hours`, `overtime_offset`, `overtime_billing`. |
| `dispatch_status_history` | Audit trail of all status changes. Fields: `dispatch_id`, `old_status`, `new_status`, `changed_by`, `remarks`, `changed_at`. |

### Role Values (profiles.role)

| Role | Description |
|---|---|
| `admin_scheduler` | Full access: create/edit dispatches, manage users, see all calendars |
| `AMaTS` | Same elevated access as admin_scheduler but branded differently (AMaTS color theme) |
| `staff` | Default for new signups — redirected to dashboard or pending activation |
| `pending_verification` | *(Legacy — not used in current code. New signups get `staff` role and `active: false`)* |
| `engineer` | Staff-table role, not a profile role |
| `technician` | Staff-table role, not a profile role |
| `viewer` | Referenced in schema constraint but not used in UI routing |

---

## 4. User Roles & Access Control

### Auth Flow

1. User visits any non-public route → `middleware.ts` checks Supabase session cookie.
2. If no session → redirect to `/login`.
3. If authenticated → allow through. Role checking happens at the page level, not in middleware.

### Public Routes (no auth required)
- `/login`, `/signup`
- `/calendar-view` — public dispatch calendar
- `/workload-view` — public Gantt-style workload view

### Role-Based Navigation (Sidebar.tsx)

| Role | Navigation Items |
|---|---|
| `admin_scheduler` or `AMaTS` (isManager) | Dashboard, Dispatches, Workload, **New Dispatch**, **Admin Panel** |
| All others (`staff`, etc.) | Dashboard, Dispatches, My Calendar, Public Calendar, Workload |

### Account Activation

New signups (via `/signup`) get `active: false` and the `staff` role by default. Managers see a **🔔 Pending Signups** notification in the sidebar. They can click "Activate" which calls `PUT /api/admin/users/:id` to set `active = true`. Inactive users are rejected by `requireAccess.ts` with a 403 even if they have a valid session.

---

## 5. Core Workflows

### A. Dispatch Creation (`/dispatch/new`)

The most complex workflow. Multi-tab form with: **Basic Info**, **Instruments**, **Itinerary**, **Machines**.

**Step-by-step:**
1. Page loads and fetches: engineers, technicians, instruments, companies, machines from their respective `/api/` endpoints.
2. User sets **Date From / Date To** → triggers automatic availability check against `/api/staff/availability` and `/api/instruments/availability`. Available staff appear normally; unavailable ones are greyed out and blocked.
3. **Lead Engineer** (required, radio select), **Assistant Engineers** (optional, checkbox), **Technicians** (optional, checkbox) are selected from the personnel lists.
4. **Company / Client** field is a searchable dropdown reading from the `companies` table. Selecting a company auto-fills Contact Person & Contact Number.
5. **Location of Testing**: toggle between "AMTEC" (sets `type = in_house`) or "Client's Place" (sets `type = on_field`, shows address input).
6. **Transport Mode**: dropdown (Public Conveyance, Test Applicant Vehicle, College Vehicle, Other). If "Other" → shows text input.
7. On the **Machines tab**: selecting a machine name triggers `/api/machine-instruments` → returns required instrument names → auto-populates the Instruments tab. Deduplication logic prevents the same instrument appearing twice.
8. On **Save**, a conflict check is posted to `/api/dispatches/check-conflicts`. If instrument conflicts exist, user sees a confirm dialog to override or cancel. Staff conflicts are shown visually (greyed out) but are not re-checked on save.
9. `POST /api/dispatches` creates: the dispatch row → assignments → instruments → machines → initial status_history entry. Includes a rollback that deletes the dispatch row if any sub-insert fails.

### B. Dispatch Editing (`/dispatches/[id]/edit`)

Nearly identical to Create. Key differences:
- Pre-populates all fields from the existing dispatch via `GET /api/dispatches/[id]`.
- Availability check uses `exclude_dispatch_id` so the dispatch's own staff/instruments don't show as conflicts.
- Submits `PUT /api/dispatches/[id]` which does a full replacement of assignments, instruments, and machines.
- If `date_from` or `date_to` changes from the original while status was "Scheduled" → status becomes "Re-scheduled" automatically.

### C. Status System

Statuses are **live-computed from dates** on every GET request, with exceptions for manual statuses:

- `Scheduled` — today is before `date_from`
- `Ongoing` — today is between `date_from` and `date_to` (inclusive)
- `Done` — today is after `date_to`
- `Re-scheduled` — manually set when dates change on an already-Scheduled dispatch
- `Cancelled` — manual (edit form, not yet implemented as a button in UI)
- `Pending` — no dates set

Manual statuses (`Re-scheduled`, `Cancelled`) are preserved and not overridden by date-based logic.

### D. Staff Availability & Cooldown System

`GET /api/staff/availability?date_from=&date_to=&exclude_dispatch_id=`

Two-tier unavailability logic:
1. **Conflict** — staff is already assigned to an overlapping dispatch (not Cancelled/Done)
2. **Cooldown** — staff appears in a dispatch that ended in the 7 days prior to `date_from` (rest period)

This is consumed by both the New Dispatch and Edit Dispatch forms to visually grey-out unavailable staff. The check-conflicts API also enforces this on save.

### E. Instrument Availability

`GET /api/instruments/availability?date_from=&date_to=&exclude_dispatch_id=`

Returns `booked` codes — specific instrument units (by `code_brand_model`) already assigned to a dispatch on overlapping dates. Booked instruments appear with a red "Booked" label and cannot be selected.

### F. Dashboard (`/dashboard`)

- Full-page calendar widget showing dispatches as colored chips per day.
- Clicking a day opens a side panel showing dispatches on that day.
- Below the calendar: a detailed monthly table with Lead Engineer, Assistants, Technicians, Machinery, TAM No., Transport, Contact info.
- Managers see all dispatches; staff see only their own assigned dispatches.
- Dispatch chips show a left-border color coded by `created_by_role` (dark blue = Scheduler, dark red = AMaTS).

### G. PDF Export

- Available from the Dispatch List and Dispatch Detail pages.
- Calls `GET /api/dispatches/[id]/pdf` which spawns a Python3 subprocess (`generate_dispatch_pdf.py`).
- The dispatch JSON is passed via stdin; PDF bytes are returned via stdout.
- **Fragile** — requires Python3 to be installed on the server. Will fail with a 500 error if not available.

### H. Admin Panel (`/admin`)

- Read-only staff directory showing engineers and technicians from the `staff` table.
- Stats: total staff, engineers count, technicians count.
- Search + filter by role.
- **Does not** manage the `profiles` table (auth users). Managing auth users is done via the Sidebar pending-activations widget.

---

## 6. API Route Summary

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/me` | POST | Public* | Returns profile by userId. Used by pages to get current role. |
| `/api/dispatches` | GET | Bearer token | Returns all dispatches (managers) or assigned-only (staff) |
| `/api/dispatches` | POST | Bearer (admin_scheduler / AMaTS) | Creates new dispatch |
| `/api/dispatches/[id]` | GET | Bearer token | Returns full dispatch with assignments, instruments, machines, itinerary |
| `/api/dispatches/[id]` | PUT | Bearer (admin_scheduler / AMaTS) | Updates dispatch (full replace of sub-tables) |
| `/api/dispatches/[id]` | DELETE | Bearer (admin_scheduler / AMaTS) | Deletes dispatch |
| `/api/dispatches/[id]/pdf` | GET | Bearer token | Generates and returns PDF via Python |
| `/api/dispatches/check-conflicts` | POST | None | Checks staff + instrument conflicts for a date range |
| `/api/staff/engineers` | GET | None | Returns engineers from `staff` table |
| `/api/staff/technicians` | GET | None | Returns technicians from `staff` table |
| `/api/staff/availability` | GET | None | Returns unavailable staff IDs with reason/dispatch |
| `/api/instruments` | GET | None | Returns instrument catalog |
| `/api/instruments/availability` | GET | None | Returns booked instrument codes for a date range |
| `/api/companies` | GET | None | Returns companies list |
| `/api/machines` | GET | None | Returns machine names list |
| `/api/machine-instruments` | GET | None | Returns required instruments for a given machine |
| `/api/admin/users` | GET | Bearer (admin_scheduler / AMaTS) | Returns all profiles + emails merged |
| `/api/admin/users/[id]` | PUT | Bearer (admin_scheduler / AMaTS) | Activate/update a user profile |
| `/api/signup` | POST | None | Creates auth user + profile (new registration) |
| `/api/ensure-profile` | POST | None | Auto-creates profile if missing |
| `/api/public` | GET | None | Public read-only dispatch list |

---

## 7. Security Design

- **Middleware**: Blocks unauthenticated access to all non-public routes. Does NOT check roles — that is done inside each page.
- **Route Handlers**: Most API routes call `getAuthUser()` or `requireRole()` from `lib/auth/requireAccess.ts` which validates the `Authorization: Bearer <token>` header.
- **`/api/me`**: Uses userId from POST body, no token validation — technically open but non-sensitive (returns profile only, no writes).
- **`/api/dispatches/check-conflicts`**: Also has no auth — accepts anonymous requests. This is intentional to simplify the conflict-check call from the form.
- **Supabase Admin Client**: `lib/supabase/admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS. All database writes go through this to ensure atomic operations.
- **RLS**: Row Level Security is NOT the primary enforcement mechanism. All security relies on server-side token validation in Route Handlers.

---

## 8. Known Issues & Bugs

### 🔴 Critical / Breaking

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | **`/dispatch/page.tsx` is a dead, broken page** | `app/dispatch/page.tsx` | This old page checks for role `"scheduler"` which no longer exists (current role is `"admin_scheduler"`), so it will always redirect managers to `/dashboard`. The actual create form at `/dispatch/new` works correctly. This dead file should be deleted. |
| 2 | **Staff filtering is by `staff_id` but staff availability queries by `profile_id`** | `api/staff/availability`, `api/dispatches/route.ts` | The `dispatch_assignments` table has both `staff_id` and `profile_id` columns. The availability API tries `a.staff_id ?? a.profile_id` as a fallback, but if both are populated differently, the match may fail silently — staff who should be flagged as unavailable may appear available. |
| 3 | **PDF generation requires `python3` on the server** | `app/api/dispatches/[id]/pdf/route.ts` | Will produce a 500 error if `python3` is not in PATH on the deployment machine. No fallback or user-friendly error is shown. The error is only visible in server logs. |
| 4 | **SUPABASE_SERVICE_ROLE_KEY env variable** | `.env.local` | Was previously noted as malformed/truncated. Correct formatting is critical for all admin operations. If broken, all API routes using `supabaseAdmin` will fail silently or throw 500 errors. |

### 🟡 Logic / Data Integrity Issues

| # | Issue | Location | Impact |
|---|---|---|---|
| 5 | **Contact info stored redundantly** | `api/dispatches/route.ts` (POST) | `contact_info` is saved as `"${contact_person} - ${contact_number}"` combined, but `contact_person` and `contact_number` are also saved separately. The separate fields are used in the edit form; `contact_info` is used in the detail view display. They can become inconsistent. |
| 6 | **`location` column duplicates `company_name`** | `api/dispatches/route.ts` | The dispatch is created with `location: company_name`. This is a legacy column that is no longer accurately representing "testing location". |
| 7 | **Conflict check only shows instrument conflicts at save-time; staff conflicts are not re-checked** | `app/dispatch/new/page.tsx` (saveDispatch) | The availability check on date change greys out unavailable staff. But at save-time, only instrument conflicts trigger a user-facing warning. Staff who were manually typed or whose availability changed after selection could still be saved without a warning. |
| 8 | **Itinerary tab exists but does nothing** | `app/dispatch/new/page.tsx`, `app/dispatches/[id]/edit/page.tsx` | The "Itinerary" tab is in the tab bar but contains no functional input form. The detail page can display itinerary if it exists in the database, but there is no UI to create or edit it. |
| 9 | **`dispatch_status_history` is not surfaced in the UI** | Status history table | Status changes are tracked in the DB but the dispatch detail page has no section to show status history. The data is collected but invisible to users. |

### 🟠 UI / UX Issues

| # | Issue | Location | Impact |
|---|---|---|---|
| 10 | **Dispatch list page shows `dispatch_engineers` and `dispatch_technicians`** | `app/dispatches/page.tsx` | The `Dispatch` type still references old `dispatch_engineers` and `dispatch_technicians` join fields, which no longer exist in the API response. The table will show "—" for Engineers and Technicians columns. The Dashboard page correctly reads `dispatch_assignments` instead. |
| 11 | **`/calendar` page shows a "New Dispatch" link for role `"scheduler"`** | `app/calendar/page.tsx` line 145 | Used the old role name `"scheduler"` — should be `"admin_scheduler"`. As a result, the button never shows for any logged-in user on the Calendar page. |
| 12 | **Sidebar "New Dispatch" link not shown for `AMaTS` in some edge cases** | `app/components/Sidebar.tsx` | The MANAGER_NAV and SCHEDULER_ONLY arrays are combined for both `admin_scheduler` and `AMaTS`. This is correct. But the calendar page (issue #11) still hard-codes `"scheduler"` and misses both roles. |
| 13 | **`/dispatches` page "New Dispatch" button checks for `role === "scheduler"`** | `app/dispatches/page.tsx` line 172 | Same old role name bug. The button is never shown for `admin_scheduler` or `AMaTS` users on the dispatches list page. |
| 14 | **Admin panel does not manage auth users** | `app/admin/page.tsx` | Shows the `staff` table (AMTEC personnel), but not the `profiles` table (app users). There is no way to change a user's role from the Admin Panel — this must be done directly in Supabase or via the sidebar activation widget. |
| 15 | **No status-change UI (Cancel, Re-schedule buttons)** | Dispatch detail page | To cancel or manually re-schedule a dispatch, the user must edit the dispatch. There are no dedicated action buttons on the detail page for status transitions. |
| 16 | **Calendar page (`/calendar`) does not distinguish between staff-only and all-dispatch views** | `app/calendar/page.tsx` | For managers it shows their own assigned dispatches (same as staff). The workload-view and calendar-view pages show all dispatches. The intended "My Calendar" vs "All Calendar" differentiation is not clearly implemented for managers. |

### 🔵 Missing / Incomplete Features

| # | Feature | Status |
|---|---|---|
| 17 | **Itinerary editor** | Not implemented. DB table exists, view panel exists, but no form to create/edit entries. |
| 18 | **Delete dispatch button** | API endpoint exists (`DELETE /api/dispatches/[id]`) but no delete button in the UI. |
| 19 | **Role management from Admin Panel** | Admin panel is read-only for staff. Role changes must be done in Supabase dashboard or via the activation widget (which only sets `active = true`). |
| 20 | **Notifications / Email alerts** | No email or push notification system implemented. |
| 21 | **Workload view for managers to see own dispatches** | The `/calendar` page is supposed to be "My Calendar" but managers see all dispatches. |
| 22 | **Staff (non-admin) login experience** | Staff can log in but the `staff` role is not a profile role used in dispatch assignment. AMTEC field personnel in the `staff` table are not linked to auth accounts. |

---

## 9. Migration Script Execution Order

Run these in Supabase SQL Editor **in order**:

```
001_phase1_schema.sql               ← roles, status, lab, initials, assignment migration
002_staff_and_enhancements.sql      ← staff table, instrument catalog
002_phase2c_schema.sql              ← additional phase 2 columns (run after 002 above)
003_machine_instrument_seeds.sql    ← base machine-instrument mappings
003_staff_calendar_events.sql       ← legacy staff events table (optional)
004_companies_seed.sql              ← company directory (~800 companies)
004_profiles_surname_designation.sql ← adds surname + designation to profiles
005_dispatches_created_by_role.sql  ← adds created_by_role column
005_fix_instrument_splits.sql       ← splits "Graduated Cylinder / Power Meter" in DB
006_reset_machine_instruments.sql   ← full reset + reload of machine-instrument mappings
```

> ⚠️ **Do not run 006 unless you want to wipe and reload all machine-instrument defaults.** It is a destructive reset.

---

## 10. How to Run Locally

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
   > ⚠️ Ensure `SUPABASE_SERVICE_ROLE_KEY` is the **full, untruncated** key. A broken key causes all admin/write operations to silently fail.

3. Run migrations in Supabase SQL Editor (see Section 9).

4. Start development server:
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:3000`.

5. For PDF export to work, install Python3 and the required packages:
   ```bash
   pip install reportlab
   ```

---

## 11. What the App CAN Do Right Now

- ✅ User registration and login via email/password (Supabase Auth)
- ✅ Admin can activate pending user accounts from the sidebar
- ✅ Create new dispatches with full details: company, personnel, dates, instruments, machines, notes
- ✅ Edit existing dispatches (all same fields as create)
- ✅ Real-time staff availability checking (conflict + 7-day cooldown) during dispatch creation/editing
- ✅ Real-time instrument availability checking (booked unit detection)
- ✅ Machine → instrument auto-population (from `machine_instrument_defaults` table)
- ✅ Live status computation (Scheduled / Ongoing / Done) based on today's date
- ✅ Manual status tracking (Re-scheduled, Cancelled) preserved across edits
- ✅ Status history audit trail (in DB, not visible in UI)
- ✅ Instrument conflict check + override prompt on save
- ✅ Role-based sidebar navigation (managers vs staff)
- ✅ Dashboard with calendar widget + monthly dispatch table
- ✅ Dispatch list view with search, status filter, and PDF export button
- ✅ Dispatch detail view (read-only, all sections)
- ✅ PDF export of any dispatch (requires Python3)
- ✅ Public calendar view (no login required)
- ✅ Public workload Gantt view (no login required)
- ✅ Admin panel: read-only AMTEC staff directory (engineers + technicians)
- ✅ Company searchable dropdown with contact auto-fill
- ✅ Instrument deduplication in the dispatch form

## 12. What the App CANNOT Do (Yet)

- ❌ Itinerary entry/editing (tab exists but is non-functional)
- ❌ Delete a dispatch from the UI
- ❌ Change a user's role from the Admin Panel
- ❌ Cancel or force-reschedule a dispatch with a dedicated button
- ❌ View status change history in the UI
- ❌ Send notifications or email alerts
- ❌ Staff (field personnel) cannot log in as themselves — they are only data in the `staff` table
- ❌ PDF export in cloud deployments without Python3 configured
- ❌ "New Dispatch" button on `/calendar` and `/dispatches` pages (wrong role name bug)
- ❌ Engineers/Technicians columns on the Dispatch List page (stale type definition)
