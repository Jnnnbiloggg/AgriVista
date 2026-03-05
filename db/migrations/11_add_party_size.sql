-- db/migrations/11_add_party_size.sql
-- Add party_size column to bookings, appointments, and training_registrations.
-- party_size represents how many people the user is bringing (solo = 1, family/group > 1).
-- Default is 1 for all existing rows.

-- ============================================
-- 1. ADD COLUMNS
-- ============================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1;

ALTER TABLE training_registrations
  ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1;

-- ============================================
-- 2. UPDATE APPOINTMENT SLOTS TRIGGERS
--    Now decrement/increment by party_size instead of 1.
-- ============================================

-- INSERT trigger: decrement available_slots by party_size
CREATE OR REPLACE FUNCTION trg_decrement_appointment_slots()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('pending', 'confirmed') THEN
    UPDATE appointment_slots
    SET available_slots = available_slots - NEW.party_size
    WHERE date = NEW.date AND time_slot = NEW.time_slot;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- UPDATE trigger: handle status changes with party_size
CREATE OR REPLACE FUNCTION trg_manage_appointment_slots_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed from pending/confirmed to cancelled → restore slots
  IF OLD.status IN ('pending', 'confirmed') AND NEW.status = 'cancelled' THEN
    UPDATE appointment_slots
    SET available_slots = available_slots + OLD.party_size
    WHERE date = OLD.date AND time_slot = OLD.time_slot;
  -- If status changed from cancelled to pending/confirmed → deduct slots
  ELSIF OLD.status = 'cancelled' AND NEW.status IN ('pending', 'confirmed') THEN
    UPDATE appointment_slots
    SET available_slots = available_slots - NEW.party_size
    WHERE date = NEW.date AND time_slot = NEW.time_slot;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DELETE trigger: restore slots by party_size
CREATE OR REPLACE FUNCTION trg_increment_appointment_slots_del()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('pending', 'confirmed') THEN
    UPDATE appointment_slots
    SET available_slots = available_slots + OLD.party_size
    WHERE date = OLD.date AND time_slot = OLD.time_slot;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create triggers (they reference the same functions, but just to be safe)
DROP TRIGGER IF EXISTS trg_appointments_insert ON appointments;
CREATE TRIGGER trg_appointments_insert
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trg_decrement_appointment_slots();

DROP TRIGGER IF EXISTS trg_appointments_update ON appointments;
CREATE TRIGGER trg_appointments_update
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_manage_appointment_slots_update();

DROP TRIGGER IF EXISTS trg_appointments_delete ON appointments;
CREATE TRIGGER trg_appointments_delete
  AFTER DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trg_increment_appointment_slots_del();
