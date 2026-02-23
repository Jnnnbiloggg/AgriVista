-- Migration: Add end_date and end_time columns to activities table
-- Date: 2026-02-23
-- Description: Adds optional end_date and end_time columns to track activity duration

-- Add end_date and end_time columns
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Update the archived_at trigger function to use end_date/end_time if available
CREATE OR REPLACE FUNCTION set_archived_at_from_date_time()
RETURNS TRIGGER AS $$
BEGIN
  -- If end_date and end_time are provided, use them for archived_at
  -- Otherwise, generate archived_at from date and time + 12 hours
  IF NEW.end_date IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.archived_at = (NEW.end_date + NEW.end_time) AT TIME ZONE 'Asia/Manila';
  ELSE
    NEW.archived_at = (NEW.date + NEW.time) AT TIME ZONE 'Asia/Manila' + interval '12 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger is already in place from the initial schema (activities.sql)
-- This just updates the function logic
