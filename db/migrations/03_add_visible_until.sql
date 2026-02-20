-- archived_at for activities (auto-calculated via trigger: event end + 12 hours)

-- Drop archived_at if it exists (to clear out any failed generation expressions)
ALTER TABLE activities DROP COLUMN IF EXISTS archived_at;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;


-- archived_at for trainings (auto-calculated via trigger: end_date_time + 12 hours)

-- Drop archived_at if it exists
ALTER TABLE trainings DROP COLUMN IF EXISTS archived_at;
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add visible_until to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS visible_until TIMESTAMPTZ;

-- Drop archived_at if it exists on appointments
ALTER TABLE appointments DROP COLUMN IF EXISTS archived_at;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Create function and trigger for activities and appointments
CREATE OR REPLACE FUNCTION set_archived_at_from_date_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.archived_at = (NEW.date + NEW.time) AT TIME ZONE 'Asia/Manila' + interval '12 hours';
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

-- Create function and trigger for trainings
CREATE OR REPLACE FUNCTION set_archived_at_from_end_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.archived_at = NEW.end_date_time + interval '12 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trainings_archived_at ON trainings;
CREATE TRIGGER trg_trainings_archived_at
BEFORE INSERT OR UPDATE ON trainings
FOR EACH ROW
EXECUTE FUNCTION set_archived_at_from_end_date();

-- Update existing rows to populate archived_at
UPDATE activities SET archived_at = (date + time) AT TIME ZONE 'Asia/Manila' + interval '12 hours';
UPDATE appointments SET archived_at = (date + time) AT TIME ZONE 'Asia/Manila' + interval '12 hours';
UPDATE trainings SET archived_at = end_date_time + interval '12 hours';
