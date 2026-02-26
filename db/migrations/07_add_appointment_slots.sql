-- Migration: Add appointment_slots table for admin-configurable available dates and time ranges

-- Appointment Slots Table
CREATE TABLE IF NOT EXISTS appointment_slots (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('AM', 'PM')),
  available_slots INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, time_slot)
);

-- Enable Row Level Security
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;

-- Everyone (authenticated) can view slots so users can see available dates/times
CREATE POLICY "Appointment slots viewable by all authenticated users"
  ON appointment_slots FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert slots
CREATE POLICY "Only admins can insert appointment slots"
  ON appointment_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.jwt() ->> 'email')
  );

-- Only admins can update slots
CREATE POLICY "Only admins can update appointment slots"
  ON appointment_slots FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.jwt() ->> 'email')
  );

-- Only admins can delete slots
CREATE POLICY "Only admins can delete appointment slots"
  ON appointment_slots FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.jwt() ->> 'email')
  );

-- Indexes for appointment_slots
CREATE INDEX IF NOT EXISTS appointment_slots_date_idx ON appointment_slots(date);
CREATE INDEX IF NOT EXISTS appointment_slots_date_time_slot_idx ON appointment_slots(date, time_slot);
