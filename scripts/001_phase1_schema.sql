-- ============================================================
-- AMTEC Calendar-Dispatch: Phase 1 Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─── 1. Add missing columns to dispatch_assignments ─────────────

-- Rename staff_id → profile_id for consistency with architecture
ALTER TABLE dispatch_assignments RENAME COLUMN staff_id TO profile_id;

-- Add assignment_type to distinguish engineers from technicians
ALTER TABLE dispatch_assignments
  ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'engineer';

-- Add override columns for workload/cooldown override tracking
ALTER TABLE dispatch_assignments
  ADD COLUMN IF NOT EXISTS is_override BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE dispatch_assignments
  ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- ─── 2. Migrate data from old tables into dispatch_assignments ──

-- Migrate engineers (skip duplicates)
INSERT INTO dispatch_assignments (id, dispatch_id, profile_id, assignment_type, created_at)
SELECT gen_random_uuid(), dispatch_id, profile_id, 'engineer', NOW()
FROM dispatch_engineers
WHERE NOT EXISTS (
  SELECT 1 FROM dispatch_assignments da
  WHERE da.dispatch_id = dispatch_engineers.dispatch_id
    AND da.profile_id = dispatch_engineers.profile_id
    AND da.assignment_type = 'engineer'
);

-- Migrate technicians (skip duplicates)
INSERT INTO dispatch_assignments (id, dispatch_id, profile_id, assignment_type, created_at)
SELECT gen_random_uuid(), dispatch_id, profile_id, 'technician', NOW()
FROM dispatch_technicians
WHERE NOT EXISTS (
  SELECT 1 FROM dispatch_assignments da
  WHERE da.dispatch_id = dispatch_technicians.dispatch_id
    AND da.profile_id = dispatch_technicians.profile_id
    AND da.assignment_type = 'technician'
);

-- ─── 3. Add status column to dispatches ─────────────────────────

ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';

-- Add lab column to dispatches (for lab-scoped management)
ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS lab TEXT;

-- Backfill status based on existing dates
UPDATE dispatches SET status = CASE
  WHEN date_from IS NULL OR date_to IS NULL THEN 'Pending'
  WHEN CURRENT_DATE < date_from THEN 'Scheduled'
  WHEN CURRENT_DATE > date_to THEN 'Done'
  ELSE 'Ongoing'
END;

-- ─── 4. Create dispatch_status_history ──────────────────────────

CREATE TABLE IF NOT EXISTS dispatch_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  remarks TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. Add lab and initials to profiles ────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lab TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS initials TEXT;

-- ─── 6. Update roles: scheduler/admin → admin_scheduler ─────────

-- First drop the old check constraint (it only allowed old role names)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Update existing roles to new names
UPDATE profiles SET role = 'admin_scheduler' WHERE role IN ('scheduler', 'admin');

-- Add a new check constraint with the full set of valid roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('engineer', 'technician', 'admin_scheduler', 'AMaTS', 'viewer'));

-- ─── Done! ──────────────────────────────────────────────────────
-- Old tables (dispatch_engineers, dispatch_technicians) are kept
-- as backup. They can be dropped later once everything is verified.
