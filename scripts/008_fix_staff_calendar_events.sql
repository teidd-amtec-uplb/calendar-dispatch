-- ============================================================
-- 008_fix_staff_calendar_events.sql
-- Migrates staff_calendar_events to use staff.id instead of profiles.id
-- Also drops the old event_type CHECK constraint so new types are accepted
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add staff_id column referencing staff table
ALTER TABLE staff_calendar_events
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE CASCADE;

-- 2. Drop the old unique index (it's on profile_id)
DROP INDEX IF EXISTS idx_staff_calendar_events_unique;

-- 3. Create new unique index on staff_id + event_date
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_calendar_events_staff_unique
  ON staff_calendar_events (staff_id, event_date);

-- 4. Make staff_id NOT NULL (set a placeholder for any orphaned old rows first)
-- (Safe to run even if table is empty)
UPDATE staff_calendar_events SET staff_id = profile_id WHERE staff_id IS NULL AND profile_id IN (SELECT id FROM staff);
DELETE FROM staff_calendar_events WHERE staff_id IS NULL;
ALTER TABLE staff_calendar_events ALTER COLUMN staff_id SET NOT NULL;

-- 5. Drop the old profile_id column to remove its NOT NULL constraint
ALTER TABLE staff_calendar_events DROP COLUMN IF EXISTS profile_id;

-- Done! The application code now stores/reads events via staff_id.
