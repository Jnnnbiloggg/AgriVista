-- Migration: Implement triggers to automatically manage appointment_slots.available_slots

-- Function to decrement available_slots when an appointment is created
CREATE OR REPLACE FUNCTION trg_decrement_appointment_slots()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('pending', 'confirmed') THEN
    UPDATE appointment_slots
    SET available_slots = available_slots - 1
    WHERE date = NEW.date AND time_slot = NEW.time_slot;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for INSERT (creation)
DROP TRIGGER IF EXISTS trg_appointments_insert ON appointments;
CREATE TRIGGER trg_appointments_insert
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trg_decrement_appointment_slots();

-- Function to update available_slots on update or delete
CREATE OR REPLACE FUNCTION trg_manage_appointment_slots_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed from pending/confirmed to cancelled
  IF OLD.status IN ('pending', 'confirmed') AND NEW.status = 'cancelled' THEN
    UPDATE appointment_slots
    SET available_slots = available_slots + 1
    WHERE date = OLD.date AND time_slot = OLD.time_slot;
  -- If status changed from cancelled to pending/confirmed
  ELSIF OLD.status = 'cancelled' AND NEW.status IN ('pending', 'confirmed') THEN
    UPDATE appointment_slots
    SET available_slots = available_slots - 1
    WHERE date = NEW.date AND time_slot = NEW.time_slot;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for UPDATE
DROP TRIGGER IF EXISTS trg_appointments_update ON appointments;
CREATE TRIGGER trg_appointments_update
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_manage_appointment_slots_update();

-- Function for DELETE (increment if deleted and it was active)
CREATE OR REPLACE FUNCTION trg_increment_appointment_slots_del()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('pending', 'confirmed') THEN
    UPDATE appointment_slots
    SET available_slots = available_slots + 1
    WHERE date = OLD.date AND time_slot = OLD.time_slot;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for DELETE
DROP TRIGGER IF EXISTS trg_appointments_delete ON appointments;
CREATE TRIGGER trg_appointments_delete
  AFTER DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trg_increment_appointment_slots_del();
