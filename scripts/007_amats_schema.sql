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

-- If you have existing rows with role = 'mechanical_lab', migrate them first:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE profiles SET role = 'AMaTS' WHERE role = 'mechanical_lab';
UPDATE dispatches SET created_by_role = 'AMaTS' WHERE created_by_role = 'mechanical_lab';

-- Update profiles role check to allow 'AMaTS'
-- NOTE: If your profiles table has a CHECK constraint on role, update it:
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('engineer', 'technician', 'admin_scheduler', 'AMaTS', 'viewer'));
