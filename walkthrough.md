# AMTEC Calendar Dispatch — Feature Walkthrough

> Last updated: April 14, 2026

This document walks through every screen and feature of the AMTEC Calendar Dispatch system, including what works, what is broken, and what is pending.

---

## Screen 1: Login Page (`/login`)

**What it does:**
- Email + password login via Supabase GoTrue Auth.
- On success: redirected to `/dashboard`.
- If already logged in and you visit `/login`: middleware redirects you to `/dashboard`.

**What works:** ✅ Fully functional.

**Known issues:** None.

---

## Screen 2: Signup Page (`/signup`)

**What it does:**
- Creates a new Supabase auth user.
- Automatically creates a `profiles` row via `ensureProfile()` with `role = "staff"` and `active = false`.
- User sees a message to wait for admin activation.

**What works:** ✅ Fully functional.

**Known issues:**
- The new user's account is immediately locked (`active = false`). They cannot access any protected pages until an admin activates them from the Sidebar notification.

---

## Screen 3: Dashboard (`/dashboard`)

**What it does:**
- Displays a **monthly calendar** with dispatch chips (colored dots) for each day.
- Clicking a day shows a side panel listing all dispatches on that date.
- Below the calendar: a **detailed monthly table** showing dispatch number, status, dates, lead engineer, assistant engineers, technicians, company, location, machinery, TAM no., transport, and contact info.
- Stats row at top: Total Dispatches, Scheduled, Ongoing, Done.
- Managers (admin_scheduler, AMaTS) see all dispatches. Staff see only their own assigned ones.
- Dispatch chips are left-border color-coded: **dark blue** = created by Scheduler; **dark red** = created by AMaTS.

**What works:** ✅ Fully functional. This is the most feature-complete page.

**Known issues:**
- None critical. The "This Month" summary in the side panel only shows total dispatches and Done count — not Ongoing or Scheduled.

---

## Screen 4: Create New Dispatch (`/dispatch/new`)

**What it does:**
Multi-tab form (Basic Info | Instruments | Itinerary | Machines).

### Tab: Basic Info

- **Dispatch Number** (required) — manual entry, format `DIS-YYYY-####`. Checked for uniqueness at save.
- **Date From / Date To** — once set, automatically triggers real-time availability checks.
- **Personnel Assignment** — three columns:
  - **Lead Engineer** (radio, required) — one engineer from the `staff` table. Greyed-out with a 🚫 label if unavailable (conflict or cooldown).
  - **Assistant Engineers** (checkboxes, optional) — any engineers not already selected as Lead.
  - **Technicians** (checkboxes, optional) — from the technician list.
  - Available personnel are sorted to the top; unavailable are pushed to the bottom and blocked.
- **Company / Client** — searchable dropdown reading from the `companies` table. Selecting from the list auto-fills Contact Person and Contact Number.
- **Location of Testing** — radio: "AMTEC" (in_house) or "Client's Place" (on_field). Choosing Client's Place shows a text input for the address.
- **Mode of Transportation** — dropdown. If "Other", shows a text field to specify.
- **Remarks / Observation** and **Notes** — freeform textareas.

### Tab: Instruments

- Each row has: Instrument Name (searchable dropdown), Code/Brand/Model (auto-filled from selection, read-only), Before Travel (radio: Good/Not Good Condition), Remarks.
- Instrument names search against the `instruments` catalog.
- Instruments already booked for the selected date range are shown as **red "Booked"** and cannot be selected.
- Selected codes are deduplicated — selecting the same code in a second row is blocked.
- "+ Add Instrument" button appends a new row.
- Instruments auto-populate when machines are selected (see Machines tab).

### Tab: Itinerary

- ⚠️ **TAB IS EMPTY — NOT IMPLEMENTED.** The tab is in the bar, but clicking it shows a blank space. No itinerary entry form exists.

### Tab: Machines

- Each row has: Machine (searchable dropdown, from `/api/machines`), TAM No., Brand, Model, Serial No., Date of Test, Status.
- Selecting a machine name triggers a fetch to `/api/machine-instruments` which auto-populates the Instruments tab.
- If multiple machines need the same instrument, deduplication runs — the second machine adds a new blank row for that instrument type.

### Save Button

1. Validates: dispatch number (required + format check), lead engineer (required).
2. Checks for instrument conflicts via `/api/dispatches/check-conflicts`. If found → prompts user to override or cancel.
3. POSTs to `/api/dispatches` to create the dispatch.
4. On success: redirects to the dispatch detail page.

**What works:** ✅ Mostly fully functional.

**Known issues:**
- Itinerary tab has no content.
- Staff conflict warnings are shown visually (greyed out) but NOT re-validated on save. If a user's availability changes after selection, they can still be saved.
- `useEffect` for availability fetching references `id` which is undefined on New Dispatch (no linting error catches this currently — a minor code smell, not a crash).

---

## Screen 5: Dispatch List (`/dispatches`)

**What it does:**
- Table of all dispatches (or only assigned ones for staff).
- Columns: Dispatch #, Company, Date From, Date To, Status, Transport, Engineers, Technicians, Created, PDF.
- Search by dispatch number, company, or location.
- Filter by status (All / Scheduled / Ongoing / Completed).
- Clicking a row navigates to the dispatch detail page.
- PDF export button on each row.

**What works:** ✅ Mostly functional.

**Known issues:**
- **Engineers and Technicians columns always show "—"** — the `Dispatch` type in this file still references the old `dispatch_engineers` and `dispatch_technicians` join fields. The API no longer returns these; it returns `dispatch_assignments`. The table columns are effectively broken for all rows.
- **"+ New Dispatch" button checks for `role === "scheduler"`** (line 172) — this role no longer exists. The button will never show for `admin_scheduler` or `AMaTS` users on this page.
- Status computed locally using `getDispatchStatus()` function may not match the server-stored `status` (e.g., manual `Re-scheduled` or `Cancelled` would be overridden by the local computation for display).

---

## Screen 6: Dispatch Detail View (`/dispatches/[id]`)

**What it does:**
- Full read-only view of a dispatch record.
- Sections: Dispatch Information, Engineers, Technicians, Instruments, Itinerary, Machines.
- Status badge at top (reads from API's live-computed status).
- Header buttons: ← Back to List, Export PDF, Edit Dispatch (admin/AMaTS only).

**What works:** ✅ Fully functional.

**Known issues:**
- **Is Extended** / **Extended Days** fields are displayed but there is no way to set these from the Edit form.
- Contact Info shown as combined `contact_info` field. If `contact_info` is null (data inconsistency), it will show "—" even when `contact_person` and `contact_number` exist separately.
- Itinerary section correctly shows "No itinerary recorded" (because no entries can be created yet).
- Status change history (from `dispatch_status_history`) is not shown.

---

## Screen 7: Edit Dispatch (`/dispatches/[id]/edit`)

**What it does:**
- Same multi-tab form as Create Dispatch, but pre-populated with existing dispatch data.
- Availability check excludes the current dispatch's own assignments.
- On save: `PUT /api/dispatches/[id]` replaces assignments, instruments, and machines.

**What works:** ✅ Mostly functional. UI is at parity with New Dispatch form.

**Known issues:**
- Same Itinerary tab issue — blank tab, no form.
- Dispatch number format validation uses regex `DIS-\d{4}-\d+` which is good, but the create form has no format validation — users can type anything.
- If saving with a duplicate dispatch number (someone else took it), the error message from the API is surfaced correctly.
- Machine-triggered instrument rebuild on the Edit page **wipes existing instruments** (even manually added ones). If you open Edit and change a machine, all current instruments are replaced. This is intentional by design but could surprise users.

---

## Screen 8: Calendar — My Calendar (`/calendar`)

**What it does:**
- Month/Week view calendar.
- Shows dispatch chips on dates.
- Side panel shows dispatches for a clicked day.
- Toggling between Month and Week view.

**What works:** ✅ Functionally works.

**Known issues:**
- **"+ New Dispatch" link checks for `role === "scheduler"`** (line 145) — button never appears for any user.
- For managers: shows only their assigned dispatches (same as staff), not all dispatches. The distinction between "My Calendar" (staff-assigned) and viewing all dispatches is inconsistent — managers expect to see all.
- Dispatch chips don't show status color coding (all use the same blue tint). The Dashboard calendar has better chip styling.

---

## Screen 9: Public Calendar (`/calendar-view`)

**What it does:**
- No authentication required.
- Reads from `/api/public` — returns dispatches without auth.
- The same month/week calendar display but without the side panel interactivity.
- Intended for shared viewing on a display screen or for engineers checking without logging in.

**What works:** ✅ Functional (depends on `/api/public` being implemented).

**Known issues:**
- Route exists but exact implementation of `/api/public` was not deeply verified.

---

## Screen 10: Workload View (`/workload-view`)

**What it does:**
- Gantt-style timeline showing which staff member is assigned to which dispatch on which dates.
- Accessible without login.
- Useful for managers to check resource allocation at a glance.

**What works:** ✅ Functional.

**Known issues:**
- No filtering or searching within the view.

---

## Screen 11: Admin Panel (`/admin`)

**What it does:**
- Staff directory showing all engineers and technicians from the `staff` table.
- Stats: total, engineers, technicians.
- Search by name, initials, email.
- Filter by All / Engineers / Technicians.
- Table shows: initials avatar, full name, surname, designation, email, role badge.

**What works:** ✅ Fully functional for what it does.

**What it CANNOT do:**
- It does NOT manage app users (`profiles` table). Role changes, name edits, or deactivation of auth users must be done in Supabase directly.
- No way to add/edit/delete AMTEC staff from within the app.

---

## Screen 12: Sidebar — Pending Activations

**Where:** Visible in the sidebar when the user is an admin_scheduler or AMaTS.

**What it does:**
- Polls `/api/admin/users` on load to find users with `active = false`.
- Displays a 🔔 bell icon with a count badge.
- Expanding it shows each pending user's name and role with an "Activate" button.
- Clicking Activate calls `PUT /api/admin/users/:id` with `{ active: true }`.

**What works:** ✅ Fully functional.

**Known issues:**
- The pending count is only fetched once on load — if a new signup comes in while an admin is logged in, the count won't update without a page refresh.
- Only activates (`active = true`). Cannot deactivate, change role, or remove users from this widget.

---

## PDF Export Feature

**Where accessible:** Dispatch List page (PDF icon on each row) + Dispatch Detail page (Export PDF button).

**What it does:**
- Calls `GET /api/dispatches/[id]/pdf`.
- Server spawns `python3 scripts/generate_dispatch_pdf.py`.
- Passes full dispatch JSON via stdin.
- Python renders a formatted PDF and returns bytes via stdout.
- Browser triggers a file download.

**What works:** ✅ Works when Python3 and `reportlab` are installed.

**Known issues:**
- **Will fail in any deployment where `python3` is not installed** (Vercel, Railway, most serverless hosts). Produces a 500 error.
- No informative error is shown to the user — just a generic alert.
- The PDF query still uses the old `profiles` join in `dispatch_assignments` — may show undefined names for staff assigned via the `staff_id` column instead of `profile_id`.

---

## Summary Table

| Feature | Status | Notes |
|---|---|---|
| Login / Signup | ✅ Working | — |
| User Activation | ✅ Working | Admin-only via sidebar |
| Create Dispatch | ✅ Working | Itinerary tab missing |
| Edit Dispatch | ✅ Working | Itinerary tab missing |
| Staff Availability Check | ✅ Working | Cooldown + conflict detection |
| Instrument Availability | ✅ Working | Booked unit detection |
| Machine → Instrument Auto-fill | ✅ Working | — |
| Conflict Check on Save | ✅ Working (instruments only) | Staff not re-checked at save |
| Dashboard Calendar | ✅ Working | Best-polished page |
| Dispatch List | ⚠️ Partial | Engineers/Technicians columns broken |
| "New Dispatch" button (list+calendar) | ❌ Broken | Wrong role name `"scheduler"` |
| Dispatch Detail View | ✅ Working | — |
| Itinerary Tab | ❌ Not Implemented | Tab exists, no form |
| Delete Dispatch (UI) | ❌ Not Implemented | API exists, no button |
| Admin Panel | ✅ Working (read-only) | No role management UI |
| PDF Export | ⚠️ Fragile | Requires Python3 on server |
| Public Calendar | ✅ Working | — |
| Workload View | ✅ Working | — |
| Status History (UI) | ❌ Not Shown | Tracked in DB, no UI |
| Cancel / Re-schedule buttons | ❌ Not Implemented | Status changes via edit only |
