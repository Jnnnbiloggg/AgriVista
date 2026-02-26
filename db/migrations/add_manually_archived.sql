-- ============================================================
-- Migration: Add manual archiving support
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Add manually_archived column to each table
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS manually_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS manually_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS manually_archived BOOLEAN DEFAULT FALSE;


-- 2. Update the trainings archiving trigger:
--    Only recalculate archived_at when end_date_time changes (not on every update),
--    so that manually_archived updates don't reset the auto-archive timestamp.
CREATE OR REPLACE FUNCTION set_archived_at_from_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate archived_at on INSERT or when end_date_time actually changes.
  IF TG_OP = 'INSERT' OR OLD.end_date_time IS DISTINCT FROM NEW.end_date_time THEN
    NEW.archived_at = NEW.end_date_time + interval '12 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trainings_archived_at ON trainings;
CREATE TRIGGER trg_trainings_archived_at
BEFORE INSERT OR UPDATE ON trainings
FOR EACH ROW
EXECUTE FUNCTION set_archived_at_from_end_date();


-- 3. Update the activities/appointments archiving trigger similarly.
CREATE OR REPLACE FUNCTION set_archived_at_from_date_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate archived_at on INSERT or when relevant date/time columns change.
  IF TG_OP = 'INSERT'
     OR OLD.date IS DISTINCT FROM NEW.date
     OR OLD.time IS DISTINCT FROM NEW.time
     OR OLD.end_date IS DISTINCT FROM NEW.end_date
     OR OLD.end_time IS DISTINCT FROM NEW.end_time
  THEN
    IF NEW.end_date IS NOT NULL AND NEW.end_time IS NOT NULL THEN
      NEW.archived_at = (NEW.end_date + NEW.end_time) AT TIME ZONE 'Asia/Manila';
    ELSE
      NEW.archived_at = (NEW.date + NEW.time) AT TIME ZONE 'Asia/Manila' + interval '12 hours';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activities_archived_at ON activities;
CREATE TRIGGER trg_activities_archived_at
BEFORE INSERT OR UPDATE ON activities
FOR EACH ROW
EXECUTE FUNCTION set_archived_at_from_date_time();

DROP TRIGGER IF EXISTS trg_appointments_archived_at ON appointments;
CREATE TRIGGER trg_appointments_archived_at
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION set_archived_at_from_date_time();
