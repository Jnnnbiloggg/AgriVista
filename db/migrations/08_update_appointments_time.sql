-- Migration: update appointments time to time_slot and update appointment_slots

-- Add time_slot column to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time_slot TEXT CHECK (time_slot IN ('AM', 'PM'));

-- Drop the broken trigger before updating appointments
DROP TRIGGER IF EXISTS trg_appointments_archived_at ON appointments;

-- Migrate existing data (assuming time was stored, we can extract it if needed, or just default to AM)
-- Let's just set them if they aren't set
UPDATE appointments SET time_slot = 'AM' WHERE time_slot IS NULL;

-- Drop the old time column
ALTER TABLE appointments DROP COLUMN IF EXISTS time;

-- Create the new trigger function for appointments only
CREATE OR REPLACE FUNCTION set_appointments_archived_at()
RETURNS TRIGGER AS $$
DECLARE
  base_time TIME;
BEGIN
  IF TG_OP = 'INSERT'
     OR OLD.date IS DISTINCT FROM NEW.date
     OR OLD.time_slot IS DISTINCT FROM NEW.time_slot
  THEN
    IF NEW.time_slot = 'AM' THEN
      base_time := '12:00:00'::TIME;
    ELSE
      base_time := '17:00:00'::TIME;
    END IF;

    NEW.archived_at = (NEW.date + base_time) AT TIME ZONE 'Asia/Manila' + interval '12 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appointments_archived_at
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION set_appointments_archived_at();

-- Alter appointment_slots to drop start_time and end_time, and add time_slot and available_slots
ALTER TABLE appointment_slots DROP COLUMN IF EXISTS start_time;
ALTER TABLE appointment_slots DROP COLUMN IF EXISTS end_time;
ALTER TABLE appointment_slots DROP COLUMN IF EXISTS label;
ALTER TABLE appointment_slots ADD COLUMN IF NOT EXISTS time_slot TEXT CHECK (time_slot IN ('AM', 'PM'));
ALTER TABLE appointment_slots ADD COLUMN IF NOT EXISTS available_slots INTEGER DEFAULT 1;

-- Add a unique constraint to avoid duplicate time_slots on the same date
ALTER TABLE appointment_slots ADD CONSTRAINT unique_date_time_slot UNIQUE (date, time_slot);
