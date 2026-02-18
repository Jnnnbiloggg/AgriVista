-- Migration: Add date and time columns to activities table
-- Run this if you already have an existing activities table

-- Add date and time columns (nullable initially for backward compatibility)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS time TIME;

-- Update existing records with a default date/time (you may want to update these manually)
UPDATE activities 
SET date = CURRENT_DATE, 
    time = '09:00:00'
WHERE date IS NULL OR time IS NULL;

-- Make columns required after setting defaults
ALTER TABLE activities ALTER COLUMN date SET NOT NULL;
ALTER TABLE activities ALTER COLUMN time SET NOT NULL;

-- Add index on date for better query performance
CREATE INDEX IF NOT EXISTS activities_date_idx ON activities(date);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'activities' 
  AND column_name IN ('date', 'time');
